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
    expect(Object.keys(result.payload.rules)).toEqual([
      'color-no-invalid-hex',
      'alpha-value-notation',
    ])
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
    expect(result.payload.rules).toEqual({})
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
      name: 'stylelint/resolved/override-1',
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
              description: 'Demo plugin rule',
              fixable: false,
              deprecated: false,
              url: 'https://example.test/acme/demo-rule',
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
        description: 'Demo plugin rule',
        url: 'https://example.test/acme/demo-rule',
      },
    })
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
})
