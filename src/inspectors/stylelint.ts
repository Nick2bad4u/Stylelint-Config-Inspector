import type { Config as StylelintConfig } from 'stylelint'
import type { FlatConfigItem, MatchedFile, Payload, RuleInfo, RulesRecord } from '../../shared/types'
import type { InspectorAdapter, InspectorReadResult, ReadConfigOptions, ResolveConfigPathOptions, ResolvedConfigPath } from './contracts'
import { readFile, stat } from 'node:fs/promises'
import process from 'node:process'
import c from 'ansis'
import { bundleRequire } from 'bundle-require'
import { findUp } from 'find-up'
import { basename, dirname, normalize, relative, resolve } from 'pathe'
import stylelint from 'stylelint'
import { glob } from 'tinyglobby'
import { isGeneralConfig, isIgnoreOnlyConfig, matchFile } from '../../shared/configs'
import { MARK_CHECK, MARK_INFO, stylelintConfigFilenames, stylelintLegacyConfigFilenames } from '../constants'
import { ConfigPathError } from '../errors'

const DEFAULT_TARGET_FILE = 'stylelint-inspector-target.css'
const DEFAULT_WORKSPACE_SCAN_GLOBS = ['**/*.{css,scss,sass,less,pcss,sss,styl,stylus,vue,svelte,astro,html}']
const DEFAULT_WORKSPACE_SCAN_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/dist/**',
  '**/coverage/**',
]
const MAX_WORKSPACE_MATCHED_FILES = 5000
const FILE_EXTENSION_RE = /\.[^.]+$/

interface StylelintConfigLike extends Record<string, unknown> {
  files?: unknown
  ignoreFiles?: unknown
  rules?: unknown
  plugins?: unknown
  extends?: unknown
  customSyntax?: unknown
  name?: unknown
  overrides?: unknown
}

interface ResolveConfigOptionsSubset {
  cwd?: string
  config?: StylelintConfig
  configBasedir?: string
  customSyntax?: string
}

const OMITTED_EXTRA_CONFIG_KEYS = new Set([
  'pluginFunctions',
  'processors',
  'result',
  'formatter',
])

function isNoConfigError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes('No configuration provided for')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isScalarValue(value: unknown): value is string | number | boolean | null {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
}

function isPlainSerializableObject(value: unknown): value is Record<string, string | number | boolean | null> {
  if (!isRecord(value))
    return false

  return Object.values(value).every(isScalarValue)
}

function isSerializableExtraValue(value: unknown): boolean {
  if (isScalarValue(value))
    return true

  if (Array.isArray(value))
    return value.every(isScalarValue)

  if (isPlainSerializableObject(value))
    return true

  return false
}

function sanitizeExtraConfigFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !OMITTED_EXTRA_CONFIG_KEYS.has(key))
      .filter(([, fieldValue]) => isSerializableExtraValue(fieldValue)),
  )
}

function getPackageNameFromPath(pathLike: string): string | undefined {
  const normalized = normalize(pathLike).replaceAll('\\', '/')
  const nodeModulesToken = '/node_modules/'
  const nodeModulesIndex = normalized.lastIndexOf(nodeModulesToken)

  if (nodeModulesIndex === -1)
    return undefined

  const packagePath = normalized.slice(nodeModulesIndex + nodeModulesToken.length)
  const parts = packagePath.split('/').filter(Boolean)
  if (!parts.length)
    return undefined

  if (parts[0]?.startsWith('@')) {
    const scope = parts[0]
    const name = parts[1]
    if (scope && name)
      return `${scope}/${name}`
  }

  return parts[0]
}

function sanitizePluginName(name: string): string {
  if (!name.includes('/') && !name.includes('\\'))
    return name

  const packageName = getPackageNameFromPath(name)
  if (packageName)
    return packageName

  const normalized = normalize(name).replaceAll('\\', '/')
  const stem = basename(normalized).replace(FILE_EXTENSION_RE, '')
  return stem || name
}

function toStringArray(value: unknown): string[] | undefined {
  if (typeof value === 'string')
    return [value]

  if (!Array.isArray(value))
    return undefined

  const items = value.filter((item): item is string => typeof item === 'string')
  return items.length ? items : undefined
}

function toRulesRecord(value: unknown): RulesRecord | undefined {
  if (!isRecord(value))
    return undefined
  return value
}

function getPluginName(entry: unknown, index: number): string {
  if (typeof entry === 'string')
    return sanitizePluginName(entry)

  if (typeof entry === 'function' && entry.name)
    return entry.name

  if (isRecord(entry) && typeof entry.ruleName === 'string')
    return entry.ruleName.split('/')[0] ?? entry.ruleName

  return `plugin-${index + 1}`
}

function toPluginRecord(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value))
    return undefined

  const entries = value
    .map((entry, index) => getPluginName(entry, index))
    .filter(Boolean)

  if (!entries.length)
    return undefined

  return Object.fromEntries(entries.map(name => [name, {}]))
}

function getRulePlugin(ruleName: string): string {
  return ruleName.includes('/')
    ? ruleName.split('/')[0] ?? 'stylelint'
    : 'stylelint'
}

function normalizeConfigItem(
  rawConfig: StylelintConfigLike,
  index: number,
  fallbackName: string,
): FlatConfigItem {
  const {
    files,
    ignoreFiles,
    rules,
    plugins,
    extends: extendsValue,
    customSyntax,
    overrides: _overrides,
    name,
    ...rest
  } = rawConfig

  const sanitizedExtraFields = sanitizeExtraConfigFields(rest)

  const config: FlatConfigItem = {
    index,
    name: typeof name === 'string' && name.length
      ? name
      : fallbackName,
    ...sanitizedExtraFields,
  }

  const fileGlobs = toStringArray(files)
  if (fileGlobs)
    config.files = fileGlobs

  const ignoreGlobs = toStringArray(ignoreFiles)
  if (ignoreGlobs)
    config.ignores = ignoreGlobs

  const normalizedRules = toRulesRecord(rules)
  if (normalizedRules)
    config.rules = normalizedRules

  const normalizedPlugins = toPluginRecord(plugins)
  if (normalizedPlugins)
    config.plugins = normalizedPlugins

  const normalizedExtends = toStringArray(extendsValue)
  if (normalizedExtends)
    config.extends = normalizedExtends

  if (typeof customSyntax === 'string')
    config.customSyntax = customSyntax

  return config
}

function extractConfigs(resolvedConfig: StylelintConfigLike): FlatConfigItem[] {
  const { overrides, ...rootConfig } = resolvedConfig

  const configs: FlatConfigItem[] = [
    normalizeConfigItem(rootConfig, 0, 'stylelint/resolved/root'),
  ]

  if (Array.isArray(overrides)) {
    overrides.forEach((override, index) => {
      if (!isRecord(override))
        return
      configs.push(normalizeConfigItem(override, index + 1, `stylelint/resolved/override-${index + 1}`))
    })
  }

  return configs
}

function buildRuleCatalog(configs: FlatConfigItem[]): Record<string, RuleInfo> {
  const ruleInfoMap = new Map<string, RuleInfo>()

  configs.forEach((config) => {
    Object.keys(config.rules ?? {}).forEach((name) => {
      if (ruleInfoMap.has(name))
        return

      ruleInfoMap.set(name, {
        name,
        plugin: getRulePlugin(name),
      })
    })
  })

  return Object.fromEntries(ruleInfoMap.entries())
}

function normalizeWorkspaceFilepath(path: string): string {
  return normalize(path).replaceAll('\\', '/')
}

function toWorkspaceScanGlobs(configs: FlatConfigItem[]): string[] {
  const fileGlobs = configs.flatMap(config => config.files ?? [])
  const positiveGlobs = fileGlobs.filter(glob => typeof glob === 'string' && !glob.startsWith('!'))
  return [...new Set(positiveGlobs)]
}

async function resolveMatchedFiles(
  configs: FlatConfigItem[],
  basePath: string,
): Promise<{ files: MatchedFile[], diagnostics: string[] }> {
  const diagnostics: string[] = []
  const configuredGlobs = toWorkspaceScanGlobs(configs)
  const scanGlobs = configuredGlobs.length ? configuredGlobs : DEFAULT_WORKSPACE_SCAN_GLOBS

  if (!configuredGlobs.length) {
    diagnostics.push(
      'No explicit `files` globs found in resolved config items; scanned common style-related extensions for workspace matching.',
    )
  }

  const discoveredFiles = await glob(scanGlobs, {
    cwd: basePath,
    onlyFiles: true,
    dot: true,
    ignore: DEFAULT_WORKSPACE_SCAN_IGNORES,
  })

  if (discoveredFiles.length > MAX_WORKSPACE_MATCHED_FILES) {
    diagnostics.push(
      `Workspace matching was truncated to the first ${MAX_WORKSPACE_MATCHED_FILES} files (found ${discoveredFiles.length}).`,
    )
  }

  const generalConfigIndexes = configs
    .filter(config => isGeneralConfig(config) && !isIgnoreOnlyConfig(config))
    .map(config => config.index)

  const files = discoveredFiles
    .slice(0, MAX_WORKSPACE_MATCHED_FILES)
    .map(normalizeWorkspaceFilepath)
    .map((filepath) => {
      const matched = matchFile(filepath, configs, basePath)
      if (matched.configs.length === 0 && matched.globs.length === 0 && generalConfigIndexes.length)
        matched.configs.push(...generalConfigIndexes)
      return matched
    })
    .filter(result => result.configs.length > 0)
    .toSorted((a, b) => a.filepath.localeCompare(b.filepath))

  return {
    files,
    diagnostics,
  }
}

function getRelativeFilepath(basePath: string, filePath: string): string {
  const result = relative(basePath, filePath).replaceAll('\\', '/')
  return result.length ? result : filePath
}

async function exists(path: string): Promise<boolean> {
  return await stat(path).then(() => true).catch(() => false)
}

async function loadConfigFromPath(configPath: string, basePath: string): Promise<{ config: StylelintConfig, dependencies: string[] }> {
  if (basename(configPath) === 'package.json') {
    const pkg = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(pkg) as unknown

    if (!isRecord(parsed) || !isRecord(parsed.stylelint)) {
      throw new Error(`No "stylelint" field found in ${configPath}`)
    }

    return {
      config: parsed.stylelint as StylelintConfig,
      dependencies: [configPath],
    }
  }

  const { mod, dependencies } = await bundleRequire({
    filepath: configPath,
    cwd: basePath,
    tsconfig: false,
  })

  const configValue = (mod.default ?? mod) as unknown
  if (!isRecord(configValue)) {
    throw new Error(`Expected Stylelint config object from ${configPath}`)
  }

  return {
    config: configValue as StylelintConfig,
    dependencies,
  }
}

async function findDiscoveredConfigPath(cwd: string): Promise<string | undefined> {
  const configFilePath = await findUp(stylelintConfigFilenames, { cwd })
  if (configFilePath)
    return normalize(configFilePath)

  const legacyFilePath = await findUp(stylelintLegacyConfigFilenames, { cwd })
  if (legacyFilePath)
    return normalize(legacyFilePath)

  const packageJsonPath = await findUp('package.json', { cwd })
  if (!packageJsonPath)
    return undefined

  const packageJsonContent = await readFile(packageJsonPath, 'utf-8').catch(() => undefined)
  if (!packageJsonContent)
    return undefined

  let packageJson: unknown
  try {
    packageJson = JSON.parse(packageJsonContent) as unknown
  }
  catch {
    return undefined
  }

  if (isRecord(packageJson) && isRecord(packageJson.stylelint))
    return normalize(packageJsonPath)

  return undefined
}

class StylelintInspectorAdapter implements InspectorAdapter {
  readonly engine = 'stylelint' as const

  async resolveConfigPath(options: ResolveConfigPathOptions): Promise<ResolvedConfigPath> {
    const {
      cwd,
      userConfigPath,
      userBasePath,
    } = options

    const resolvedUserBasePath = userBasePath
      ? normalize(resolve(cwd, userBasePath))
      : undefined
    const lookupBasePath = resolvedUserBasePath ?? cwd

    let configPath: string | undefined
    if (userConfigPath) {
      const candidate = normalize(resolve(cwd, userConfigPath))

      if (!await exists(candidate)) {
        throw new ConfigPathError(
          `${relative(cwd, dirname(candidate))}/`,
          stylelintConfigFilenames,
        )
      }

      configPath = candidate
    }
    else {
      configPath = await findDiscoveredConfigPath(lookupBasePath)
    }

    const basePath = normalize(
      resolvedUserBasePath
      ?? (userConfigPath
        ? cwd
        : (configPath ? dirname(configPath) : lookupBasePath)),
    )

    return {
      basePath,
      configPath,
    }
  }

  async readConfig(options: ReadConfigOptions): Promise<InspectorReadResult> {
    const {
      chdir = true,
      globMatchedFiles: shouldGlobMatchedFiles = true,
    } = options

    const { basePath, configPath } = await this.resolveConfigPath(options)
    const configPathRelative = configPath
      ? getRelativeFilepath(options.cwd, configPath)
      : ''

    if (chdir && basePath !== process.cwd())
      process.chdir(basePath)

    const targetFilePath = normalize(resolve(basePath, options.targetFilePath ?? DEFAULT_TARGET_FILE))
    const targetFilepathRelative = getRelativeFilepath(basePath, targetFilePath)

    console.log(MARK_INFO, `Resolving Stylelint config for`, c.blue(targetFilepathRelative))

    const dependencies = new Set<string>()
    let config: StylelintConfig | undefined

    if (options.userConfigPath && configPath) {
      const loaded = await loadConfigFromPath(configPath, basePath)
      config = loaded.config
      loaded.dependencies.forEach(dep => dependencies.add(dep))
    }
    else if (configPath) {
      dependencies.add(configPath)
    }

    const resolveOptions: ResolveConfigOptionsSubset = {
      cwd: basePath,
    }

    if (config) {
      resolveOptions.config = config
      resolveOptions.configBasedir = configPath ? dirname(configPath) : basePath
    }
    if (options.customSyntax)
      resolveOptions.customSyntax = options.customSyntax

    let resolved: StylelintConfig | undefined
    try {
      resolved = await stylelint.resolveConfig(targetFilePath, resolveOptions)
    }
    catch (error) {
      if (!isNoConfigError(error))
        throw error
    }

    const diagnostics: string[] = []

    if (options.userBasePath) {
      diagnostics.push(
        `Base path overridden to ${getRelativeFilepath(options.cwd, basePath)}.`,
      )
    }

    if (!resolved) {
      const payload: Payload = {
        configs: [],
        rules: {},
        diagnostics,
        meta: {
          engine: this.engine,
          lastUpdate: Date.now(),
          basePath,
          configPath: configPathRelative,
          targetFilePath: targetFilepathRelative,
          configNotFound: true,
        },
      }

      return {
        configs: [],
        payload,
        dependencies: [...dependencies],
      }
    }

    const configs = extractConfigs(resolved as StylelintConfigLike)
    const rules = buildRuleCatalog(configs)

    let files: MatchedFile[] | undefined
    if (shouldGlobMatchedFiles) {
      const resolvedFiles = await resolveMatchedFiles(configs, basePath)
      files = resolvedFiles.files
      diagnostics.push(...resolvedFiles.diagnostics)
    }

    console.log(MARK_CHECK, 'Loaded with', configs.length, 'config items and', Object.keys(rules).length, 'rules')

    const payload: Payload = {
      configs,
      rules,
      diagnostics,
      files,
      meta: {
        engine: this.engine,
        lastUpdate: Date.now(),
        basePath,
        configPath: configPathRelative,
        targetFilePath: targetFilepathRelative,
      },
    }

    return {
      configs,
      payload,
      dependencies: [...dependencies],
    }
  }
}

export function createStylelintInspectorAdapter(): InspectorAdapter {
  return new StylelintInspectorAdapter()
}
