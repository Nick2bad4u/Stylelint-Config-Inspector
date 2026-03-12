import type { MinimatchOptions } from 'minimatch'
import type { FlatConfigItem, MatchedFile } from './types'
import { ConfigArray } from '@eslint/config-array'
import { Minimatch } from 'minimatch'

const minimatchOpts: MinimatchOptions = { dot: true, flipNegate: true }
const _matchInstances = new Map<string, Minimatch>()

function minimatch(file: string, pattern: string) {
  let m = _matchInstances.get(pattern)
  if (!m) {
    m = new Minimatch(pattern, minimatchOpts)
    _matchInstances.set(pattern, m)
  }
  return m.match(file)
}

export function getMatchedGlobs(file: string, globs: string[]) {
  return globs.filter(glob => minimatch(file, glob))
}

const META_KEYS = new Set(['name', 'index'])

/**
 * Config with only `ignores` property
 */
export function isIgnoreOnlyConfig(config: FlatConfigItem) {
  const keys = Object.keys(config).filter(i => !META_KEYS.has(i))
  return keys.length === 1 && keys[0] === 'ignores'
}

/**
 * Config without `files` and `ignores` properties or with only `ignores` property
 */
export function isGeneralConfig(config: FlatConfigItem) {
  return (!config.files && !config.ignores) || isIgnoreOnlyConfig(config)
}

export function matchFile(
  filepath: string,
  configs: FlatConfigItem[],
  basePath: string,
): MatchedFile {
  const result: MatchedFile = {
    filepath,
    globs: [],
    configs: [],
  }

  const {
    config: globalMatchedConfig = {},
    status: globalMatchStatus,
  } = buildConfigArray(configs, basePath).getConfigWithStatus(filepath)
  configs.forEach((config) => {
    const positive = getMatchedGlobs(filepath, config.files || [])
    const negative = getMatchedGlobs(filepath, config.ignores || [])

    if (globalMatchStatus === 'matched' && globalMatchedConfig.index?.includes(config.index) && positive.length > 0) {
      result.configs.push(config.index)
      // push positive globs only when there are configs matched
      result.globs.push(...positive)
    }

    result.globs.push(...negative)
  })

  result.globs = [...new Set(result.globs)]

  return result
}

const NOOP_SCHEMA = {
  merge: 'replace',
  validate() {},
}

const FLAT_CONFIG_NOOP_SCHEMA = {
  settings: NOOP_SCHEMA,
  linterOptions: NOOP_SCHEMA,
  language: NOOP_SCHEMA,
  languageOptions: NOOP_SCHEMA,
  processor: NOOP_SCHEMA,
  plugins: NOOP_SCHEMA,
  extends: NOOP_SCHEMA,
  customSyntax: NOOP_SCHEMA,
  overrides: NOOP_SCHEMA,
  ignoreFiles: NOOP_SCHEMA,
  defaultSeverity: NOOP_SCHEMA,
  processors: NOOP_SCHEMA,
  reportDescriptionlessDisables: NOOP_SCHEMA,
  reportInvalidScopeDisables: NOOP_SCHEMA,
  reportNeedlessDisables: NOOP_SCHEMA,
  reportUnscopedDisables: NOOP_SCHEMA,
  configurationComment: NOOP_SCHEMA,
  ignoreDisables: NOOP_SCHEMA,
  allowEmptyInput: NOOP_SCHEMA,
  cache: NOOP_SCHEMA,
  fix: NOOP_SCHEMA,
  formatter: NOOP_SCHEMA,
  index: {
    ...NOOP_SCHEMA,
    // accumulate the matched config index to an array
    merge(v1: number | number[], v2: number | number[]) {
      return [...[v1].flat(), ...[v2].flat()]
    },
  },
  rules: NOOP_SCHEMA,
}

export function buildConfigArray(configs: Array<Record<string, unknown>>, basePath: string) {
  return new ConfigArray(configs, {
    basePath,
    schema: FLAT_CONFIG_NOOP_SCHEMA as unknown as never,
  }).normalizeSync()
}
