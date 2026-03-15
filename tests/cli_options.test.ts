import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeCliInspectorOptions } from '../src/cli-options'
import { DEFAULT_TARGET_FILE } from '../src/constants'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('normalizeCliInspectorOptions', () => {
  it('uses the synthetic default target when no target input is provided', () => {
    expect(normalizeCliInspectorOptions({}).target).toBe(DEFAULT_TARGET_FILE)
  })

  it('treats --file as an alias for --target', () => {
    expect(
      normalizeCliInspectorOptions({
        file: 'src/styles/app.css',
      }).target,
    ).toBe('src/styles/app.css')
  })

  it('keeps explicit target over file alias input', () => {
    expect(
      normalizeCliInspectorOptions({
        target: 'src/explicit.css',
        file: 'src/alias.css',
      }).target,
    ).toBe('src/explicit.css')
  })

  it('uses Stylelint env vars when CLI values are absent', () => {
    vi.stubEnv('STYLELINT_CONFIG', 'stylelint.config.mjs')
    vi.stubEnv('STYLELINT_BASE_PATH', 'packages/web')
    vi.stubEnv('STYLELINT_TARGET', 'src/env.css')

    expect(normalizeCliInspectorOptions({})).toMatchObject({
      config: 'stylelint.config.mjs',
      basePath: 'packages/web',
      target: 'src/env.css',
    })
  })

  it('prefers CLI file over env target fallback', () => {
    vi.stubEnv('STYLELINT_TARGET', 'src/from-env.css')

    expect(
      normalizeCliInspectorOptions({
        file: 'src/from-file.css',
      }).target,
    ).toBe('src/from-file.css')
  })

  it('supports legacy ESLint env vars for compatibility', () => {
    vi.stubEnv('ESLINT_TARGET', 'src/legacy.css')

    expect(normalizeCliInspectorOptions({}).target).toBe('src/legacy.css')
  })
})
