import type { Config as StylelintConfig } from 'stylelint'
import type { FlatConfigItem, MatchedFile, Payload, RuleInfo, RulesRecord } from '../../shared/types'
import type { InspectorAdapter, InspectorReadResult, ReadConfigOptions, ResolveConfigPathOptions, ResolvedConfigPath } from './contracts'
import { readFile, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
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

interface RuleMetaLike extends Record<string, unknown> {
  url?: unknown
  fixable?: unknown
  deprecated?: unknown
  description?: unknown
}

interface RuleFunctionLike {
  (...args: unknown[]): unknown
  ruleName?: unknown
  meta?: unknown
  messages?: unknown
  primaryOptionArray?: unknown
}

interface RuleDefinitionLike {
  ruleName: string
  meta?: RuleMetaLike
  messages?: Record<string, unknown>
  primaryOptionArray?: unknown[]
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

function toUnknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value)
    ? value
    : undefined
}

function toUnknownRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value)
    ? value
    : undefined
}

function toRuleMeta(value: unknown): RuleMetaLike | undefined {
  return isRecord(value)
    ? value
    : undefined
}

function toRuleFunction(value: unknown): RuleFunctionLike | undefined {
  return typeof value === 'function'
    ? value as RuleFunctionLike
    : undefined
}

function getRuleNameFromUnknown(value: unknown): string | undefined {
  if (isRecord(value) && typeof value.ruleName === 'string')
    return value.ruleName

  if (typeof value === 'function' && typeof value.ruleName === 'string')
    return value.ruleName

  return undefined
}

function toRuleDefinition(value: unknown, fallbackRuleName?: string): RuleDefinitionLike | undefined {
  const functionValue = toRuleFunction(value)
  if (functionValue) {
    const ruleName = typeof functionValue.ruleName === 'string'
      ? functionValue.ruleName
      : fallbackRuleName

    if (!ruleName)
      return undefined

    return {
      ruleName,
      meta: toRuleMeta(functionValue.meta),
      messages: toUnknownRecord(functionValue.messages),
      primaryOptionArray: toUnknownArray(functionValue.primaryOptionArray),
    }
  }

  if (!isRecord(value))
    return undefined

  const nestedRule = toRuleFunction(value.rule)
  const ruleName = typeof value.ruleName === 'string'
    ? value.ruleName
    : (typeof nestedRule?.ruleName === 'string' ? nestedRule.ruleName : fallbackRuleName)

  if (!ruleName)
    return undefined

  return {
    ruleName,
    meta: toRuleMeta(value.meta) ?? toRuleMeta(nestedRule?.meta),
    messages: toUnknownRecord(value.messages) ?? toUnknownRecord(nestedRule?.messages),
    primaryOptionArray: toUnknownArray(value.primaryOptionArray) ?? toUnknownArray(nestedRule?.primaryOptionArray),
  }
}

function resolveMessageText(message: unknown): string | undefined {
  if (typeof message === 'string')
    return message

  if (typeof message !== 'function')
    return undefined

  try {
    const args = Array.from({ length: Math.max(message.length, 0) }).fill('…')
    const value = message(...args)
    return typeof value === 'string'
      ? value
      : undefined
  }
  catch {
    return undefined
  }
}

function normalizeRuleMessages(messages: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!messages)
    return undefined

  const entries = Object.entries(messages)
    .map(([key, value]) => {
      const text = resolveMessageText(value)
      return text
        ? [key, text] as const
        : undefined
    })
    .filter((entry): entry is readonly [string, string] => entry !== undefined)

  return entries.length
    ? Object.fromEntries(entries)
    : undefined
}

function humanizeRuleName(ruleName: string): string {
  return ruleName
    .replaceAll('/', ' ')
    .replaceAll('-', ' ')
}

function getRuleDescription(
  ruleName: string,
  meta: RuleMetaLike | undefined,
  messages: Record<string, string> | undefined,
): string {
  if (typeof meta?.description === 'string' && meta.description.trim().length > 0)
    return meta.description

  const firstMessage = messages
    ? Object.values(messages).find(message => message.trim().length > 0)
    : undefined

  return firstMessage ?? humanizeRuleName(ruleName)
}

function normalizeRuleDeprecated(deprecated: unknown): RuleInfo['deprecated'] | undefined {
  if (typeof deprecated === 'boolean')
    return deprecated

  if (isRecord(deprecated))
    return deprecated as Exclude<RuleInfo['deprecated'], boolean | undefined>

  return undefined
}

function normalizeRuleFixable(fixable: unknown): RuleInfo['fixable'] | undefined {
  if (typeof fixable === 'boolean' || typeof fixable === 'string')
    return fixable
  return undefined
}

function buildRuleInfo(
  name: string,
  definition: RuleDefinitionLike | undefined,
): RuleInfo {
  const plugin = getRulePlugin(name)
  const meta = definition?.meta
  const messages = normalizeRuleMessages(definition?.messages)
  const docsUrl = typeof meta?.url === 'string' && meta.url.length
    ? meta.url
    : undefined
  const description = getRuleDescription(name, meta, messages)

  const info: RuleInfo = {
    name,
    plugin,
    docs: {
      description,
      ...(docsUrl ? { url: docsUrl } : {}),
    },
  }

  if (messages)
    info.messages = messages

  const defaultOptions = definition?.primaryOptionArray
  if (defaultOptions)
    info.defaultOptions = defaultOptions

  const fixable = normalizeRuleFixable(meta?.fixable)
  if (fixable !== undefined)
    info.fixable = fixable

  const deprecated = normalizeRuleDeprecated(meta?.deprecated)
  if (deprecated !== undefined)
    info.deprecated = deprecated

  return info
}

async function resolveCoreRuleDefinition(ruleName: string): Promise<RuleDefinitionLike | undefined> {
  const rules = stylelint.rules as Record<string, unknown>
  const ruleEntry = rules[ruleName]
  if (!ruleEntry)
    return undefined

  const resolvedRule = await Promise.resolve(ruleEntry).catch(() => undefined)
  return toRuleDefinition(resolvedRule, ruleName)
}

async function importPluginModule(pluginPath: string): Promise<unknown> {
  const specifier = isAbsolute(pluginPath)
    ? pathToFileURL(pluginPath).href
    : pluginPath

  const moduleValue = await import(specifier)
  return moduleValue.default ?? moduleValue
}

function collectPluginRuleDefinitions(value: unknown): RuleDefinitionLike[] {
  const queue: unknown[] = []
  const seen = new Set<unknown>()

  function enqueue(candidate: unknown) {
    if (candidate === undefined || candidate === null)
      return
    if (seen.has(candidate))
      return
    seen.add(candidate)
    queue.push(candidate)
  }

  enqueue(value)

  const definitions = new Map<string, RuleDefinitionLike>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined)
      continue

    if (Array.isArray(current)) {
      current.forEach(enqueue)
      continue
    }

    const definition = toRuleDefinition(current)
    if (definition)
      definitions.set(definition.ruleName, definition)

    if (!isRecord(current))
      continue

    if (isRecord(current.rules))
      Object.values(current.rules).forEach(enqueue)

    Object.values(current).forEach((entry) => {
      if (getRuleNameFromUnknown(entry))
        enqueue(entry)
    })
  }

  return [...definitions.values()]
}

async function resolvePluginRuleDefinitions(plugins: unknown): Promise<Map<string, RuleDefinitionLike>> {
  const definitions = new Map<string, RuleDefinitionLike>()

  if (!Array.isArray(plugins))
    return definitions

  const loaded = await Promise.all(
    plugins.map(async (pluginEntry) => {
      try {
        if (typeof pluginEntry === 'string')
          return await importPluginModule(pluginEntry)

        return pluginEntry
      }
      catch {
        return undefined
      }
    }),
  )

  loaded.forEach((pluginModule) => {
    if (pluginModule === undefined)
      return

    collectPluginRuleDefinitions(pluginModule).forEach((definition) => {
      definitions.set(definition.ruleName, definition)
    })
  })

  return definitions
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

function extractConfigs(
  resolvedConfig: StylelintConfigLike,
  sourceConfig?: StylelintConfigLike,
): FlatConfigItem[] {
  const { overrides: _resolvedOverrides, ...rootConfig } = resolvedConfig

  const configs: FlatConfigItem[] = [
    normalizeConfigItem(rootConfig, 0, 'stylelint/resolved/root'),
  ]

  const overrideSource = Array.isArray(sourceConfig?.overrides)
    ? sourceConfig.overrides
    : _resolvedOverrides

  if (Array.isArray(overrideSource)) {
    overrideSource.forEach((override, index) => {
      if (!isRecord(override))
        return
      configs.push(normalizeConfigItem(override, index + 1, `stylelint/resolved/override-${index + 1}`))
    })
  }

  return configs
}

async function buildRuleCatalog(
  configs: FlatConfigItem[],
  resolvedConfig: StylelintConfigLike,
): Promise<Record<string, RuleInfo>> {
  const ruleNames = [...new Set(configs.flatMap(config => Object.keys(config.rules ?? {})))]
  const pluginRuleDefinitions = await resolvePluginRuleDefinitions(resolvedConfig.plugins)
  const coreRuleDefinitions = new Map<string, RuleDefinitionLike>()

  await Promise.all(
    ruleNames
      .filter(ruleName => getRulePlugin(ruleName) === 'stylelint')
      .map(async (ruleName) => {
        const definition = await resolveCoreRuleDefinition(ruleName)
        if (definition)
          coreRuleDefinitions.set(ruleName, definition)
      }),
  )

  const ruleInfoEntries = ruleNames.map((ruleName) => {
    const definition = getRulePlugin(ruleName) === 'stylelint'
      ? coreRuleDefinitions.get(ruleName)
      : pluginRuleDefinitions.get(ruleName)

    return [ruleName, buildRuleInfo(ruleName, definition)] as const
  })

  return Object.fromEntries(ruleInfoEntries)
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
    const diagnostics: string[] = []
    let config: StylelintConfig | undefined

    if (configPath) {
      try {
        const loaded = await loadConfigFromPath(configPath, basePath)
        config = loaded.config

        if (options.userConfigPath)
          loaded.dependencies.forEach(dep => dependencies.add(dep))
        else
          dependencies.add(configPath)
      }
      catch (error) {
        if (options.userConfigPath)
          throw error

        dependencies.add(configPath)
        diagnostics.push('Could not parse discovered config directly; using resolved output only for config item extraction.')
      }
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

    const configs = extractConfigs(
      resolved as StylelintConfigLike,
      config as StylelintConfigLike | undefined,
    )
    const rules = await buildRuleCatalog(configs, resolved as StylelintConfigLike)

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
