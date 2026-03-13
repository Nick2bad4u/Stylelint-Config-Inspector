import type { MinimatchOptions } from 'minimatch'
import type { FlatConfigItem, MatchedFile } from './types'
import { ConfigArray } from '@eslint/config-array'
import { Minimatch } from 'minimatch'

const minimatchOpts: MinimatchOptions = { dot: true }
const _matchInstances = new Map<string, Minimatch>()

function minimatch(file: string, pattern: string) {
  const normalizedPattern = pattern.startsWith('!')
    ? pattern.slice(1)
    : pattern

  let m = _matchInstances.get(normalizedPattern)
  if (!m) {
    m = new Minimatch(normalizedPattern, minimatchOpts)
    _matchInstances.set(normalizedPattern, m)
  }
  return m.match(file)
}

export function getMatchedGlobs(file: string, globs: string[]) {
  return globs.filter(glob => minimatch(file, glob))
}

function getParentDirectories(filepath: string): string[] {
  const parts = filepath.split('/').filter(Boolean)
  if (parts.length <= 1)
    return []

  const directories: string[] = []
  for (let i = 1; i < parts.length; i += 1)
    directories.push(`${parts.slice(0, i).join('/')}/`)

  return directories
}

function isIgnoredByGlobalIgnoreGlobs(filepath: string, globs: string[]): boolean {
  const parentDirectories = getParentDirectories(filepath)
  let isFileIgnored = false
  const ignoredDirectories = new Map<string, boolean>(
    parentDirectories.map(directory => [directory, false]),
  )

  for (const glob of globs) {
    const isUnignore = glob.startsWith('!')
    const nextIgnored = !isUnignore

    if (minimatch(filepath, glob))
      isFileIgnored = nextIgnored

    parentDirectories.forEach((directory) => {
      if (minimatch(directory, glob))
        ignoredDirectories.set(directory, nextIgnored)
    })
  }

  return isFileIgnored || [...ignoredDirectories.values()].some(Boolean)
}

function isIgnoredByConfigGlobs(filepath: string, globs: string[]): boolean {
  const matchedGlobs = getMatchedGlobs(filepath, globs)
  return matchedGlobs.length > 0
    && !matchedGlobs.at(-1)?.startsWith('!')
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
  void basePath

  const result: MatchedFile = {
    filepath,
    globs: [],
    configs: [],
  }

  const globalIgnoreGlobs = configs
    .filter(config => isIgnoreOnlyConfig(config))
    .flatMap(config => config.ignores ?? [])
  const isGloballyIgnored = isIgnoredByGlobalIgnoreGlobs(filepath, globalIgnoreGlobs)

  configs.forEach((config) => {
    if (isIgnoreOnlyConfig(config)) {
      result.globs.push(...getMatchedGlobs(filepath, config.ignores ?? []))
      return
    }

    const positive = getMatchedGlobs(filepath, config.files || [])
    const negative = getMatchedGlobs(filepath, config.ignores || [])
    const isIgnoredByConfig = isIgnoredByConfigGlobs(filepath, config.ignores ?? [])

    const hasNoFilesConstraint = !config.files?.length
    const matchesByFiles = hasNoFilesConstraint || positive.length > 0

    const isMatched = !isGloballyIgnored
      && matchesByFiles
      && !isIgnoredByConfig

    if (isMatched) {
      result.configs.push(config.index)

      // Push positive globs only when config is matched and has explicit files globs.
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
