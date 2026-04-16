import c from 'ansis'

export const stylelintConfigFilenames: readonly string[] = [
  'stylelint.config.js',
  'stylelint.config.mjs',
  'stylelint.config.cjs',
  'stylelint.config.ts',
  'stylelint.config.mts',
  'stylelint.config.cts',
]

export const stylelintLegacyConfigFilenames: readonly string[] = [
  '.stylelintrc',
  '.stylelintrc.js',
  '.stylelintrc.mjs',
  '.stylelintrc.cjs',
  '.stylelintrc.yaml',
  '.stylelintrc.yml',
  '.stylelintrc.json',
]

export const configFilenames: readonly string[] = stylelintConfigFilenames
export const legacyConfigFilenames: readonly string[]
  = stylelintLegacyConfigFilenames
export const DEFAULT_TARGET_FILE = 'stylelint-inspector-target.css'

export const MARK_CHECK: string = c.green('✔')
export const MARK_INFO: string = c.blue('ℹ')
export const MARK_ERROR: string = c.red('✖')
