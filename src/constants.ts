import c from 'ansis'

export const stylelintConfigFilenames = [
  'stylelint.config.js',
  'stylelint.config.mjs',
  'stylelint.config.cjs',
  'stylelint.config.ts',
  'stylelint.config.mts',
  'stylelint.config.cts',
]

export const stylelintLegacyConfigFilenames = [
  '.stylelintrc',
  '.stylelintrc.js',
  '.stylelintrc.mjs',
  '.stylelintrc.cjs',
  '.stylelintrc.yaml',
  '.stylelintrc.yml',
  '.stylelintrc.json',
]

export const configFilenames = stylelintConfigFilenames
export const legacyConfigFilenames = stylelintLegacyConfigFilenames

export const MARK_CHECK = c.green('✔')
export const MARK_INFO = c.blue('ℹ')
export const MARK_ERROR = c.red('✖')
