import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { readConfig } from '../src/configs'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await rm(dir, { recursive: true, force: true })
    }),
  )
})

async function createTempProject(
  configContent?: string,
  extraFiles?: Record<string, string>,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'stylelint-config-inspector-'))
  tempDirs.push(dir)

  if (configContent) {
    await writeFile(join(dir, 'stylelint.config.mjs'), configContent, 'utf-8')
  }

  if (extraFiles) {
    await Promise.all(
      Object.entries(extraFiles).map(async ([name, content]) => {
        const filepath = join(dir, name)
        await mkdir(dirname(filepath), { recursive: true })
        await writeFile(filepath, content, 'utf-8')
      }),
    )
  }

  return dir
}

describe('stylelint adapter', () => {
  it('returns normalized payload when config is found', async () => {
    const cwd = await createTempProject(`
      export default {
        rules: {
          "color-no-invalid-hex": true,
          "alpha-value-notation": ["number", { "severity": "warning" }]
        },
      }
    `)

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.meta.engine).toBe('stylelint')
    expect(result.payload.meta.configNotFound).toBeUndefined()
    expect(result.payload.meta.targetFilePath).toBe('src/styles.css')
    expect(Object.keys(result.payload.rules)).toContain('color-no-invalid-hex')
    expect(Object.keys(result.payload.rules)).toContain('alpha-value-notation')
    expect(result.payload.rules['alpha-value-notation']).toMatchObject({
      name: 'alpha-value-notation',
      plugin: 'stylelint',
      fixable: true,
      docs: {
        description: expect.any(String),
        url: expect.stringContaining('alpha-value-notation'),
      },
    })
    expect(result.payload.configs[0]?.rules).toEqual({
      'color-no-invalid-hex': [true],
      'alpha-value-notation': ['number', { severity: 'warning' }],
    })
  })

  it('returns a structured not-found payload when no config exists', async () => {
    const cwd = await createTempProject()

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.meta.engine).toBe('stylelint')
    expect(result.payload.meta.configNotFound).toBe(true)
    expect(result.payload.configs).toEqual([])
    expect(result.payload.rules).toEqual({})
  })

  it('handles empty rules objects safely', async () => {
    const cwd = await createTempProject(`
      export default {
        rules: {}
      }
    `)

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.meta.configNotFound).toBeUndefined()
    expect(result.payload.configs[0]?.rules).toEqual({})
    expect(Object.keys(result.payload.rules).length).toBeGreaterThan(0)
  })

  it('normalizes extends, plugins, and customSyntax fields', async () => {
    const cwd = await createTempProject(`
      export default {
        extends: ["./stylelint.base.mjs"],
        plugins: [{
          ruleName: "local/demo-rule",
          rule: () => () => {}
        }],
        customSyntax: "postcss-scss",
        rules: {
          "color-no-invalid-hex": true
        }
      }
    `, {
      'stylelint.base.mjs': 'export default { rules: {} }',
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.scss',
    })

    expect(result.payload.meta.configNotFound).toBeUndefined()
    const rootConfig = result.payload.configs[0]
    if (rootConfig?.extends)
      expect(rootConfig.extends[0]).toContain('stylelint.base.mjs')
    expect(result.payload.configs[0]?.customSyntax).toBe('postcss-scss')
    expect(Object.keys(result.payload.configs[0]?.plugins ?? {})).toEqual(['local'])
    expect(result.payload.configs[0]).not.toHaveProperty('pluginFunctions')
    expect(result.payload.rules['color-no-invalid-hex']).toMatchObject({
      name: 'color-no-invalid-hex',
      plugin: 'stylelint',
      docs: {
        description: expect.any(String),
        url: expect.stringContaining('color-no-invalid-hex'),
      },
    })
  })

  it('resolves matched workspace files when globMatchedFiles is enabled', async () => {
    const cwd = await createTempProject(`
      export default {
        overrides: [
          {
            files: ["src/**/*.css"],
            rules: {
              "color-no-invalid-hex": true
            }
          }
        ]
      }
    `, {
      'src/demo.css': 'a { color: #123abc; }',
      'src/ignored.ts': 'export const x = 1',
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: true,
      targetFilePath: 'src/demo.css',
    })

    const matched = result.payload.files ?? []
    expect(result.payload.configs).toHaveLength(2)
    expect(result.payload.configs[1]).toMatchObject({
      name: 'stylelint/resolved/override-1 (src/**/*.css)',
      files: ['src/**/*.css'],
      rules: {
        'color-no-invalid-hex': true,
      },
    })
    expect(matched.some(file => file.filepath === 'src/demo.css')).toBe(true)
    expect(matched.some(file => file.filepath === 'src/ignored.ts')).toBe(false)
  })

  it('collects plugin rule metadata for configured plugin rules', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./demo-plugin.mjs"],
        rules: {
          "acme/demo-rule": true,
        },
      }
    `, {
      'demo-plugin.mjs': `
        export default [
          {
            ruleName: 'acme/demo-rule',
            rule: () => () => {},
            meta: {
              description: 'acme demo rule',
              fixable: false,
              deprecated: false,
              url: 'https://example.test/acme/demo-rule',
            },
          },
          {
            ruleName: 'acme/unused-rule',
            rule: () => () => {},
            meta: {
              description: 'acme unused rule',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['acme/demo-rule']).toMatchObject({
      name: 'acme/demo-rule',
      plugin: 'acme',
      fixable: false,
      deprecated: false,
      docs: {
        description: 'demo rule',
        descriptionSource: 'meta',
        url: 'https://example.test/acme/demo-rule',
        urlSource: 'meta',
      },
    })

    expect(result.payload.rules['acme/unused-rule']).toMatchObject({
      name: 'acme/unused-rule',
      plugin: 'acme',
      docs: {
        description: 'unused rule',
      },
    })
  })

  it('attributes generic plugin-prefixed rule names to the owning plugin package', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./stylelint-no-browser-hacks.mjs"],
        rules: {
          "plugin/no-browser-hacks": true,
        },
      }
    `, {
      'stylelint-no-browser-hacks.mjs': `
        export default [
          {
            ruleName: 'plugin/no-browser-hacks',
            rule: () => () => {},
            meta: {
              description: 'Unexpected <value> hack "<value>"',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['plugin/no-browser-hacks']?.plugin).toBe('no-browser-hacks')
  })

  it('uses plugin static messages as fallback rule descriptions when metadata description is missing', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./defensive-plugin.mjs"],
        rules: {
          "defensive-css/require-background-repeat": true,
        },
      }
    `, {
      'defensive-plugin.mjs': `
        export default [
          {
            ruleName: 'defensive-css/require-background-repeat',
            rule: () => () => {},
            messages: {
              rejected: 'Expected background-repeat to be declared when using background-image',
            },
            meta: {
              deprecated: false,
              fixable: false,
              url: 'https://github.com/yuschick/stylelint-plugin-defensive-css',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['defensive-css/require-background-repeat']).toMatchObject({
      plugin: 'defensive-css',
      docs: {
        description: 'Expected background-repeat to be declared when using background-image',
        descriptionSource: 'message',
        url: 'https://github.com/yuschick/stylelint-plugin-defensive-css',
        urlSource: 'meta',
      },
      messages: {
        rejected: 'Expected background-repeat to be declared when using background-image',
      },
    })
  })

  it('resolves function-based plugin messages into fallback descriptions when metadata description is missing', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./templated-plugin.mjs"],
        rules: {
          "acme/templated-rule": true,
        },
      }
    `, {
      'templated-plugin.mjs': `
        export default [
          {
            ruleName: 'acme/templated-rule',
            rule: () => () => {},
            messages: {
              rejected: value => 'Unexpected token "' + value + '" for acme/templated-rule',
            },
            meta: {
              fixable: false,
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['acme/templated-rule']?.docs?.description).toBe('Unexpected token "<value>" for acme/templated-rule')
    expect(result.payload.rules['acme/templated-rule']?.messages?.rejected).toBe('Unexpected token "<value>" for acme/templated-rule')
  })

  it('flags generated fallback descriptions when plugin metadata and messages are missing', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./minimal-plugin.mjs"],
        rules: {
          "acme/fallback-rule": true,
        },
      }
    `, {
      'minimal-plugin.mjs': `
        export default [
          {
            ruleName: 'acme/fallback-rule',
            rule: () => () => {},
            meta: {
              fixable: false,
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['acme/fallback-rule']?.docs).toMatchObject({
      description: 'fallback rule',
      descriptionMissing: true,
      descriptionSource: 'generated',
    })
  })

  it('infers plugin docs URL from package metadata when rule meta.url is missing', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["stylelint-no-url-plugin"],
        rules: {
          "plugin/no-url": true,
        },
      }
    `, {
      'node_modules/stylelint-no-url-plugin/package.json': JSON.stringify({
        name: 'stylelint-no-url-plugin',
        type: 'module',
        main: './index.mjs',
        homepage: 'https://example.test/stylelint-no-url-plugin',
      }, null, 2),
      'node_modules/stylelint-no-url-plugin/index.mjs': `
        export default [
          {
            ruleName: 'plugin/no-url',
            rule: () => () => {},
            meta: {
              description: 'forbid no-url patterns',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['plugin/no-url']).toMatchObject({
      plugin: 'no-url-plugin',
      docs: {
        description: 'forbid no-url patterns',
        descriptionSource: 'meta',
        url: 'https://example.test/stylelint-no-url-plugin',
        urlSource: 'inferred',
      },
    })
  })

  it('removes trailing rule-name references from message descriptions', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./sizes-plugin.mjs"],
        rules: {
          "scales/sizes": true,
        },
      }
    `, {
      'sizes-plugin.mjs': `
        export default [
          {
            ruleName: 'scales/sizes',
            rule: () => () => {},
            messages: {
              expected: 'Expected "<value>" to be one of "<value>" (scales/sizes)',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['scales/sizes']?.docs?.description).toBe('Expected "<value>" to be one of "<value>"')
  })

  it('marks plugin rules as recommended from plugin metadata even when not configured', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./recommended-plugin.mjs"],
        rules: {
          "acme/enabled-rule": true,
        },
      }
    `, {
      'recommended-plugin.mjs': `
        export default [
          {
            ruleName: 'acme/enabled-rule',
            rule: () => () => {},
            meta: {
              description: 'acme enabled rule',
            },
          },
          {
            ruleName: 'acme/recommended-unused-rule',
            rule: () => () => {},
            meta: {
              description: 'acme recommended unused rule',
              recommended: true,
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['acme/recommended-unused-rule']).toMatchObject({
      plugin: 'acme',
      docs: {
        description: 'recommended unused rule',
        recommended: true,
      },
    })
  })

  it('falls back to humanized rule name when plugin description is unsafe/noisy', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./scales-plugin.mjs"],
        rules: {
          "scales/alpha-values": true,
        },
      }
    `, {
      'scales-plugin.mjs': `
        export default [
          {
            ruleName: 'scales/alpha-values',
            rule: () => () => {},
            meta: {
              description: 'Expected "undefined" to be one of "undefined" (scales/alpha-values)',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['scales/alpha-values']?.docs?.description).toBe('alpha values')
  })

  it('strips scoped plugin prefixes from plugin rule descriptions', async () => {
    const cwd = await createTempProject(`
      export default {
        plugins: ["./stylistic-plugin.mjs"],
        rules: {
          "@stylistic/at-rule-name-case": ["lower"],
        },
      }
    `, {
      'stylistic-plugin.mjs': `
        export default [
          {
            ruleName: '@stylistic/at-rule-name-case',
            rule: () => () => {},
            meta: {
              description: '@stylistic at rule name case',
            },
          },
        ]
      `,
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.rules['@stylistic/at-rule-name-case']?.docs?.description).toBe('at rule name case')
  })

  it('matches style files for general configs without files globs', async () => {
    const cwd = await createTempProject(`
      export default {
        rules: {
          "color-no-invalid-hex": true
        }
      }
    `, {
      'src/general.css': 'a { color: #123abc; }',
      'src/not-style.ts': 'export const y = 2',
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: true,
      targetFilePath: 'src/general.css',
    })

    const matched = result.payload.files ?? []
    expect(matched.some(file => file.filepath === 'src/general.css')).toBe(true)
    expect(matched.some(file => file.filepath === 'src/not-style.ts')).toBe(false)
    expect(result.payload.diagnostics?.some(note => note.includes('No explicit `files` globs'))).toBe(true)
  })

  it('includes default style globs in workspace scan when general config coexists with explicit files globs', async () => {
    const cwd = await createTempProject(`
      export default {
        rules: {
          "color-no-invalid-hex": true,
        },
        overrides: [
          {
            files: ["**/*.{tsx,jsx,ts,js}"],
            rules: {
              "declaration-block-no-duplicate-properties": true,
            },
          },
        ],
      }
    `, {
      'src/app.ts': 'export const app = 1',
      'src/styles.css': 'a { color: #123abc; }',
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: true,
      targetFilePath: 'src/styles.css',
    })

    const matched = result.payload.files ?? []
    expect(matched.some(file => file.filepath === 'src/app.ts')).toBe(true)
    expect(matched.some(file => file.filepath === 'src/styles.css')).toBe(true)
    expect(result.payload.diagnostics?.some(note => note.includes('General config items were detected'))).toBe(true)
  })

  it('reports relative config path and base path override diagnostics', async () => {
    const cwd = await createTempProject(undefined, {
      'configs/stylelint.config.mjs': `
        export default {
          rules: {
            "color-no-invalid-hex": true
          }
        }
      `,
      'packages/web/src/app.css': 'a { color: #123abc; }',
    })

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      userConfigPath: 'configs/stylelint.config.mjs',
      userBasePath: 'packages/web',
      targetFilePath: 'src/app.css',
    })

    expect(result.payload.meta.configPath).toBe('configs/stylelint.config.mjs')
    expect(result.payload.meta.basePath.endsWith('/packages/web')).toBe(true)
    expect(result.payload.meta.targetFilePath).toBe('src/app.css')
    expect(result.payload.diagnostics?.some(note => note.includes('Base path overridden to packages/web'))).toBe(true)
  })

  it('uses override names that include compact files summaries', async () => {
    const cwd = await createTempProject(`
      export default {
        overrides: [
          {
            files: ["src/**/*.css", "src/**/*.scss", "src/**/*.pcss"],
            rules: {
              "color-no-invalid-hex": true
            }
          }
        ]
      }
    `)

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    expect(result.payload.configs[1]?.name).toBe('stylelint/resolved/override-1 (src/**/*.css +2)')
  })

  it('populates recommended metadata for core rules when recommended config package is available', async () => {
    const recommendedConfig = await import('stylelint-config-recommended').catch(() => undefined)

    const cwd = await createTempProject(`
      export default {
        rules: {
          "color-no-invalid-hex": true
        }
      }
    `)

    const result = await readConfig({
      cwd,
      chdir: false,
      globMatchedFiles: false,
      targetFilePath: 'src/styles.css',
    })

    const recommendedCount = Object.values(result.payload.rules)
      .filter(rule => rule.docs?.recommended)
      .length

    if (recommendedConfig) {
      expect(recommendedCount).toBeGreaterThan(0)
    }
    else {
      expect(recommendedCount).toBe(0)
    }
  })
})
