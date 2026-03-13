import type { Config as StylelintConfig } from 'stylelint'
import type {
  FlatConfigItem,
  MatchedFile,
  Payload,
  RuleDescriptionSource,
  RuleDocsUrlSource,
  RuleInfo,
  RulesRecord,
} from '../../shared/types'
import type {
  InspectorAdapter,
  InspectorReadResult,
  ReadConfigOptions,
  ResolveConfigPathOptions,
  ResolvedConfigPath,
} from './contracts'
import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import c from 'ansis'
import { bundleRequire } from 'bundle-require'
import { findUp } from 'find-up'
import { basename, dirname, normalize, relative, resolve } from 'pathe'
import stylelint from 'stylelint'
import { glob } from 'tinyglobby'
import {
  isGeneralConfig,
  isIgnoreOnlyConfig,
  matchFile,
} from '../../shared/configs'
import {
  MARK_CHECK,
  MARK_INFO,
  stylelintConfigFilenames,
  stylelintLegacyConfigFilenames,
} from '../constants'
import { ConfigPathError } from '../errors'

const DEFAULT_TARGET_FILE = 'stylelint-inspector-target.css'
const DEFAULT_WORKSPACE_SCAN_GLOBS = [
  '**/*.{css,scss,sass,less,pcss,sss,styl,stylus,vue,svelte,astro,html}',
]
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
const REGEXP_SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g
const AT_PREFIX_RE = /^@/
const STYLELINT_PLUGIN_PREFIX_RE = /^stylelint-plugin-/
const STYLELINT_PACKAGE_PREFIX_RE = /^stylelint-/
const SCOPED_STYLELINT_PLUGIN_PACKAGE_RE
  = /^(@[^/]+)\/stylelint-plugin(?:-(.+))?$/
const SCOPED_STYLELINT_PACKAGE_RE = /^(@[^/]+)\/stylelint-(.+)$/
const GENERIC_PLUGIN_PREFIXES = new Set([
  'plugin',
  'rule',
  'rules',
])
const UNSAFE_MESSAGE_DESCRIPTION_RE
  = /^Expected\s+"undefined"\s+to\s+be\s+one\s+of\s+"undefined"/i
const MESSAGE_PLACEHOLDER_RE = /%[a-z]/i
const MESSAGE_UNDEFINED_RE = /\bundefined\b/i
const TRAILING_RULE_REFERENCE_RE = /\s*\(([^()]+)\)\s*$/
const GIT_SUFFIX_RE = /\.git$/i
const GIT_PROTOCOL_PREFIX_RE = /^git\+/i
const MESSAGE_CALL_ARGS: readonly unknown[][] = [
  [],
  ['<value>'],
  ['<value>', '<value>'],
  [
    '<value>',
    '<value>',
    '<value>',
  ],
]
const PRIORITIZED_MESSAGE_KEYS = new Set([
  'rejected',
  'unexpected',
  'expected',
  'message',
  'default',
])

const require = createRequire(import.meta.url)

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
  recommended?: unknown
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

interface PluginRuleDefinitionSource {
  definition: RuleDefinitionLike
  sourcePlugin: string
  sourcePackageName?: string
  sourceDocsUrl?: string
  sourceDocsUrlSource?: RuleDocsUrlSource
}

interface RuleDescriptionResult {
  text: string
  missingDescription: boolean
  source: RuleDescriptionSource
}

interface PluginPackageDocsMetadata {
  packageName?: string
  docsUrl?: string
  docsUrlSource?: RuleDocsUrlSource
}

let _recommendedCoreRulesPromise: Promise<Set<string>> | undefined

const OMITTED_EXTRA_CONFIG_KEYS = new Set([
  'pluginFunctions',
  'processors',
  'result',
  'formatter',
])

function isNoConfigError(error: unknown): boolean {
  return (
    error instanceof Error
    && error.message.includes('No configuration provided for')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isScalarValue(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  )
}

function isPlainSerializableObject(
  value: unknown,
): value is Record<string, string | number | boolean | null> {
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

function sanitizeExtraConfigFields(
  value: Record<string, unknown>,
): Record<string, unknown> {
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

  const packagePath = normalized.slice(
    nodeModulesIndex + nodeModulesToken.length,
  )
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

function normalizePluginPackageName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed)
    return trimmed

  if (trimmed === 'stylelint')
    return trimmed

  const scopedPluginMatch = SCOPED_STYLELINT_PLUGIN_PACKAGE_RE.exec(trimmed)
  if (scopedPluginMatch) {
    const scope = scopedPluginMatch[1]
    const suffix = scopedPluginMatch[2]
    if (!scope)
      return trimmed
    return suffix ? `${scope}/${suffix}` : scope
  }

  const scopedStylelintMatch = SCOPED_STYLELINT_PACKAGE_RE.exec(trimmed)
  if (scopedStylelintMatch) {
    const scope = scopedStylelintMatch[1]
    const suffix = scopedStylelintMatch[2]
    if (!scope)
      return trimmed
    return suffix ? `${scope}/${suffix}` : scope
  }

  if (STYLELINT_PLUGIN_PREFIX_RE.test(trimmed))
    return trimmed.replace(STYLELINT_PLUGIN_PREFIX_RE, '')

  if (STYLELINT_PACKAGE_PREFIX_RE.test(trimmed))
    return trimmed.replace(STYLELINT_PACKAGE_PREFIX_RE, '')

  return trimmed
}

function isBareModuleSpecifier(specifier: string): boolean {
  return (
    !isAbsolute(specifier)
    && !specifier.startsWith('.')
    && !specifier.startsWith('file:')
  )
}

function toPackageNameFromSpecifier(specifier: string): string | undefined {
  if (!isBareModuleSpecifier(specifier))
    return undefined

  const trimmed = specifier.trim()
  if (!trimmed)
    return undefined

  const parts = trimmed.split('/').filter(Boolean)
  if (!parts.length)
    return undefined

  if (parts[0]?.startsWith('@')) {
    const scope = parts[0]
    const name = parts[1]
    return scope && name ? `${scope}/${name}` : undefined
  }

  return parts[0]
}

function getPackageRootFromResolvedPath(
  resolvedPath: string,
): string | undefined {
  const normalized = normalize(resolvedPath).replaceAll('\\', '/')
  const nodeModulesToken = '/node_modules/'
  const nodeModulesIndex = normalized.lastIndexOf(nodeModulesToken)
  if (nodeModulesIndex === -1)
    return undefined

  const modulesRoot = normalized.slice(
    0,
    nodeModulesIndex + nodeModulesToken.length,
  )
  const packagePath = normalized.slice(
    nodeModulesIndex + nodeModulesToken.length,
  )
  const parts = packagePath.split('/').filter(Boolean)
  if (!parts.length)
    return undefined

  if (parts[0]?.startsWith('@')) {
    const scope = parts[0]
    const name = parts[1]
    if (!scope || !name)
      return undefined
    return resolve(modulesRoot, scope, name)
  }

  const packageName = parts[0]
  return packageName ? resolve(modulesRoot, packageName) : undefined
}

function normalizeAbsoluteUrl(value: string | undefined): string | undefined {
  if (!value)
    return undefined

  const trimmed = value.trim()
  if (!trimmed)
    return undefined

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
    return trimmed

  if (trimmed.startsWith('//'))
    return `https:${trimmed}`

  return undefined
}

function normalizeRepositoryUrl(repository: unknown): string | undefined {
  const raw = (() => {
    if (typeof repository === 'string')
      return repository

    if (isRecord(repository) && typeof repository.url === 'string')
      return repository.url

    return undefined
  })()

  if (!raw)
    return undefined

  const trimmed = raw.trim()
  if (!trimmed)
    return undefined

  if (trimmed.startsWith('github:'))
    return `https://github.com/${trimmed.slice('github:'.length)}`

  if (trimmed.startsWith('git@github.com:'))
    return `https://github.com/${trimmed.slice('git@github.com:'.length).replace(GIT_SUFFIX_RE, '')}`

  const withoutGitPrefix = trimmed.replace(GIT_PROTOCOL_PREFIX_RE, '')
  const normalized
    = withoutGitPrefix.startsWith('http://')
      || withoutGitPrefix.startsWith('https://')
      ? withoutGitPrefix
      : undefined

  if (!normalized)
    return undefined

  return normalized.replace(GIT_SUFFIX_RE, '')
}

async function readPluginPackageDocsMetadata(
  pluginEntry: string,
): Promise<PluginPackageDocsMetadata | undefined> {
  const resolvedPluginEntry = (() => {
    if (isAbsolute(pluginEntry))
      return pluginEntry

    if (!isBareModuleSpecifier(pluginEntry))
      return undefined

    try {
      return require.resolve(pluginEntry, { paths: [process.cwd()] })
    }
    catch {
      return undefined
    }
  })()

  const packageName = (() => {
    const fromSpecifier = toPackageNameFromSpecifier(pluginEntry)
    if (fromSpecifier)
      return fromSpecifier

    if (!resolvedPluginEntry)
      return undefined

    return getPackageNameFromPath(resolvedPluginEntry)
  })()

  if (!packageName)
    return undefined

  const packageRoot = resolvedPluginEntry
    ? getPackageRootFromResolvedPath(resolvedPluginEntry)
    : undefined

  const packageJsonPath = packageRoot
    ? resolve(packageRoot, 'package.json')
    : undefined

  const packageJsonContent = packageJsonPath
    ? await readFile(packageJsonPath, 'utf-8').catch(() => undefined)
    : undefined

  if (!packageJsonContent) {
    return {
      packageName,
      docsUrl: `https://www.npmjs.com/package/${packageName}`,
      docsUrlSource: 'inferred',
    }
  }

  let packageJson: unknown
  try {
    packageJson = JSON.parse(packageJsonContent)
  }
  catch {
    packageJson = undefined
  }

  const homepageUrl = normalizeAbsoluteUrl(
    isRecord(packageJson) && typeof packageJson.homepage === 'string'
      ? packageJson.homepage
      : undefined,
  )
  const repositoryUrl = normalizeRepositoryUrl(
    isRecord(packageJson) ? packageJson.repository : undefined,
  )
  const docsUrl
    = homepageUrl
      ?? repositoryUrl
      ?? `https://www.npmjs.com/package/${packageName}`

  return {
    packageName,
    docsUrl,
    docsUrlSource: 'inferred',
  }
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
    ? (ruleName.split('/')[0] ?? 'stylelint')
    : 'stylelint'
}

function getDisplayPluginName(ruleName: string, sourcePlugin?: string): string {
  const rulePlugin = getRulePlugin(ruleName)
  if (!sourcePlugin)
    return rulePlugin

  return GENERIC_PLUGIN_PREFIXES.has(rulePlugin) ? sourcePlugin : rulePlugin
}

function toUnknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

function toUnknownRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function toRuleMeta(value: unknown): RuleMetaLike | undefined {
  return isRecord(value) ? value : undefined
}

function toRuleFunction(value: unknown): RuleFunctionLike | undefined {
  return typeof value === 'function' ? (value as RuleFunctionLike) : undefined
}

function getRuleNameFromUnknown(value: unknown): string | undefined {
  if (isRecord(value) && typeof value.ruleName === 'string')
    return value.ruleName

  const functionValue = toRuleFunction(value)
  if (typeof functionValue?.ruleName === 'string')
    return functionValue.ruleName

  return undefined
}

function toRuleDefinition(
  value: unknown,
  fallbackRuleName?: string,
): RuleDefinitionLike | undefined {
  const functionValue = toRuleFunction(value)
  if (functionValue) {
    const ruleName
      = typeof functionValue.ruleName === 'string'
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
  const ruleName
    = typeof value.ruleName === 'string'
      ? value.ruleName
      : typeof nestedRule?.ruleName === 'string'
        ? nestedRule.ruleName
        : fallbackRuleName

  if (!ruleName)
    return undefined

  return {
    ruleName,
    meta: toRuleMeta(value.meta) ?? toRuleMeta(nestedRule?.meta),
    messages:
      toUnknownRecord(value.messages) ?? toUnknownRecord(nestedRule?.messages),
    primaryOptionArray:
      toUnknownArray(value.primaryOptionArray)
      ?? toUnknownArray(nestedRule?.primaryOptionArray),
  }
}

function resolveMessageText(message: unknown): string | undefined {
  if (typeof message === 'string')
    return message

  if (typeof message === 'function') {
    const resolvedCandidates: string[] = []

    for (const args of MESSAGE_CALL_ARGS) {
      try {
        const resolved = message(...args)
        if (typeof resolved === 'string' && resolved.trim().length > 0)
          resolvedCandidates.push(resolved.trim())
      }
      catch {
        // Ignore plugin message invocation failures and continue trying alternatives.
      }
    }

    if (resolvedCandidates.length > 0) {
      return resolvedCandidates.toSorted((a, b) => {
        const scoreA = getMessageDescriptionScore('message', a)
        const scoreB = getMessageDescriptionScore('message', b)
        if (scoreA !== scoreB)
          return scoreA - scoreB

        if (a.length !== b.length)
          return a.length - b.length

        return a.localeCompare(b)
      })[0]
    }
  }

  return undefined
}

function normalizeRuleMessages(
  messages: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!messages)
    return undefined

  const entries = Object.entries(messages)
    .map(([key, value]) => {
      const text = resolveMessageText(value)
      return text ? ([key, text] as const) : undefined
    })
    .filter((entry): entry is readonly [string, string] => entry !== undefined)

  return entries.length ? Object.fromEntries(entries) : undefined
}

function humanizeRuleName(ruleName: string): string {
  const shortName = ruleName.includes('/')
    ? (ruleName.split('/').at(-1) ?? ruleName)
    : ruleName

  return shortName.replaceAll('-', ' ')
}

function toDescriptionPrefixCandidates(
  ruleName: string,
  plugin: string,
): string[] {
  const unscopedPlugin = plugin.replace(AT_PREFIX_RE, '')
  const shortRuleName = ruleName.split('/').at(-1) ?? ruleName
  const candidates = [
    plugin,
    unscopedPlugin,
    ruleName,
    shortRuleName,
  ].filter(Boolean)

  const deduplicatedCandidates = [...new Set(candidates)]
  return deduplicatedCandidates
}

function isUnsafeGeneratedDescription(description: string): boolean {
  return UNSAFE_MESSAGE_DESCRIPTION_RE.test(description)
}

function escapeRegExp(value: string): string {
  return value.replace(REGEXP_SPECIAL_CHARS_RE, '\\$&')
}

function sanitizeDescription(ruleName: string, description: string): string {
  const plugin = getRulePlugin(ruleName)
  const sanitized = description.trim()
  if (!sanitized.length)
    return humanizeRuleName(ruleName)

  if (isUnsafeGeneratedDescription(sanitized))
    return humanizeRuleName(ruleName)

  const prefixCandidates = toDescriptionPrefixCandidates(ruleName, plugin)
  const withoutPrefix = prefixCandidates.reduce((acc, candidate) => {
    if (!acc.length)
      return acc

    return acc
      .replace(new RegExp(`^${escapeRegExp(candidate)}[\\s:/-]+`, 'i'), '')
      .trim()
  }, sanitized)

  if (!withoutPrefix.length)
    return humanizeRuleName(ruleName)

  const lower = withoutPrefix.toLowerCase()
  if (
    lower === ruleName.toLowerCase()
    || lower === humanizeRuleName(ruleName).toLowerCase()
  ) {
    return humanizeRuleName(ruleName)
  }

  const shortRuleName = ruleName.split('/').at(-1) ?? ruleName
  const trailingRuleReference = withoutPrefix.match(TRAILING_RULE_REFERENCE_RE)
  if (trailingRuleReference?.[1]) {
    const referencedRule = trailingRuleReference[1].trim().toLowerCase()
    if (
      referencedRule === ruleName.toLowerCase()
      || referencedRule === shortRuleName.toLowerCase()
    ) {
      return withoutPrefix.slice(0, trailingRuleReference.index).trim()
    }
  }

  return withoutPrefix
}

function getMessageDescriptionScore(key: string, description: string): number {
  let score = PRIORITIZED_MESSAGE_KEYS.has(key) ? 0 : 10

  if (MESSAGE_PLACEHOLDER_RE.test(description))
    score += 20

  if (MESSAGE_UNDEFINED_RE.test(description))
    score += 40

  if (isUnsafeGeneratedDescription(description))
    score += 100

  if (description.length < 8)
    score += 5

  return score
}

function getDescriptionFromMessages(
  ruleName: string,
  messages: Record<string, string> | undefined,
): string | undefined {
  if (!messages)
    return undefined

  const fallbackDescription = humanizeRuleName(ruleName)
  const candidates = Object.entries(messages)
    .map(([key, value]) => ({ key, value: value.trim() }))
    .filter(candidate => candidate.value.length > 0)
    .toSorted((a, b) => {
      const scoreDiff
        = getMessageDescriptionScore(a.key, a.value)
          - getMessageDescriptionScore(b.key, b.value)
      if (scoreDiff !== 0)
        return scoreDiff

      if (a.value.length !== b.value.length)
        return a.value.length - b.value.length

      return a.key.localeCompare(b.key)
    })

  for (const candidate of candidates) {
    const description = sanitizeDescription(ruleName, candidate.value)
    if (description !== fallbackDescription)
      return description
  }

  return undefined
}

function getRuleDescription(
  ruleName: string,
  meta: RuleMetaLike | undefined,
  messages: Record<string, string> | undefined,
): RuleDescriptionResult {
  const fallbackDescription = humanizeRuleName(ruleName)

  if (
    typeof meta?.description === 'string'
    && meta.description.trim().length > 0
  ) {
    const description = sanitizeDescription(ruleName, meta.description)
    return {
      text: description,
      missingDescription: false,
      source: 'meta',
    }
  }

  const messageDescription = getDescriptionFromMessages(ruleName, messages)
  if (messageDescription) {
    return {
      text: messageDescription,
      missingDescription: false,
      source: 'message',
    }
  }

  return {
    text: fallbackDescription,
    missingDescription: true,
    source: 'generated',
  }
}

function normalizeRuleDeprecated(
  deprecated: unknown,
): RuleInfo['deprecated'] | undefined {
  if (typeof deprecated === 'boolean')
    return deprecated

  if (isRecord(deprecated)) {
    return deprecated as Exclude<RuleInfo['deprecated'], boolean | undefined>
  }

  return undefined
}

function normalizeRuleFixable(
  fixable: unknown,
): RuleInfo['fixable'] | undefined {
  if (typeof fixable === 'boolean' || typeof fixable === 'string')
    return fixable
  return undefined
}

function buildRuleInfo(
  name: string,
  definition: RuleDefinitionLike | undefined,
  recommendedRuleNames: Set<string>,
  configuredRuleNames: Set<string>,
  sourcePlugin?: string,
  sourceDocsUrl?: string,
  sourceDocsUrlSource?: RuleDocsUrlSource,
): RuleInfo {
  const plugin = getDisplayPluginName(name, sourcePlugin)
  const meta = definition?.meta
  const messages = normalizeRuleMessages(definition?.messages)
  const metaDocsUrl
    = typeof meta?.url === 'string' && meta.url.length ? meta.url : undefined
  const docsUrl = metaDocsUrl ?? sourceDocsUrl
  const docsUrlSource: RuleDocsUrlSource | undefined = metaDocsUrl
    ? 'meta'
    : sourceDocsUrlSource
  const description = getRuleDescription(name, meta, messages)
  const isRecommended
    = recommendedRuleNames.has(name) || meta?.recommended === true

  const info: RuleInfo = {
    name,
    plugin,
    docs: {
      description: description.text,
      descriptionSource: description.source,
      ...(description.missingDescription ? { descriptionMissing: true } : {}),
      ...(isRecommended ? { recommended: true } : {}),
      ...(docsUrl ? { url: docsUrl } : {}),
      ...(docsUrl && docsUrlSource ? { urlSource: docsUrlSource } : {}),
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

  if (!definition && configuredRuleNames.has(name))
    info.invalid = true

  return info
}

function resolveCoreRuleNames(): string[] {
  const rules = stylelint.rules as Record<string, unknown>
  return Object.keys(rules)
}

async function resolveRecommendedCoreRuleNames(): Promise<Set<string>> {
  if (_recommendedCoreRulesPromise)
    return await _recommendedCoreRulesPromise

  _recommendedCoreRulesPromise = (async () => {
    try {
      const moduleValue = await import('stylelint-config-recommended')
      const configValue = (moduleValue.default ?? moduleValue) as unknown
      if (!isRecord(configValue) || !isRecord(configValue.rules))
        return new Set<string>()

      return new Set(Object.keys(configValue.rules))
    }
    catch {
      return new Set<string>()
    }
  })()

  return await _recommendedCoreRulesPromise
}

async function resolveCoreRuleDefinition(
  ruleName: string,
): Promise<RuleDefinitionLike | undefined> {
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

async function resolvePluginRuleDefinitions(
  plugins: unknown,
): Promise<Map<string, PluginRuleDefinitionSource>> {
  const definitions = new Map<string, PluginRuleDefinitionSource>()

  if (!Array.isArray(plugins))
    return definitions

  const loaded = await Promise.all(
    plugins.map(async (pluginEntry, index) => {
      const sourcePlugin = normalizePluginPackageName(
        getPluginName(pluginEntry, index),
      )
      try {
        if (typeof pluginEntry === 'string') {
          const packageDocsMetadata
            = await readPluginPackageDocsMetadata(pluginEntry)
          return {
            sourcePlugin,
            module: await importPluginModule(pluginEntry),
            packageDocsMetadata,
          }
        }

        return {
          sourcePlugin,
          module: pluginEntry,
          packageDocsMetadata: undefined,
        }
      }
      catch {
        return undefined
      }
    }),
  )

  loaded.forEach((pluginLoaded) => {
    if (!pluginLoaded)
      return

    const { sourcePlugin, module, packageDocsMetadata } = pluginLoaded

    collectPluginRuleDefinitions(module).forEach((definition) => {
      definitions.set(definition.ruleName, {
        definition,
        sourcePlugin,
        sourcePackageName: packageDocsMetadata?.packageName,
        sourceDocsUrl: packageDocsMetadata?.docsUrl,
        sourceDocsUrlSource: packageDocsMetadata?.docsUrlSource,
      })
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
    name: typeof name === 'string' && name.length ? name : fallbackName,
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
    normalizeConfigItem(rootConfig, 0, 'stylelint/root'),
  ]

  const overrideSource = Array.isArray(sourceConfig?.overrides)
    ? sourceConfig.overrides
    : _resolvedOverrides

  if (Array.isArray(overrideSource)) {
    overrideSource.forEach((override, index) => {
      if (!isRecord(override))
        return

      const overrideFiles = toStringArray(override.files)
      const firstGlob = overrideFiles?.[0]
      const filesSummary = firstGlob
        ? overrideFiles.length > 1
          ? `${firstGlob} +${overrideFiles.length - 1}`
          : firstGlob
        : undefined

      const fallbackName = filesSummary
        ? `stylelint/override-${index + 1} (${filesSummary})`
        : `stylelint/override-${index + 1}`

      configs.push(normalizeConfigItem(override, index + 1, fallbackName))
    })
  }

  return configs
}

async function buildRuleCatalog(
  configs: FlatConfigItem[],
  resolvedConfig: StylelintConfigLike,
): Promise<Record<string, RuleInfo>> {
  const configuredRuleNames = new Set(
    configs.flatMap(config => Object.keys(config.rules ?? {})),
  )
  const pluginRuleDefinitions = await resolvePluginRuleDefinitions(
    resolvedConfig.plugins,
  )
  const coreRuleNames = resolveCoreRuleNames()
  const recommendedCoreRuleNames = await resolveRecommendedCoreRuleNames()
  const recommendedPluginRuleNames = Array.from(
    pluginRuleDefinitions.values(),
    entry => entry.definition,
  )
    .filter(definition => definition.meta?.recommended === true)
    .map(definition => definition.ruleName)
  const recommendedRuleNames = new Set<string>([
    ...recommendedCoreRuleNames,
    ...recommendedPluginRuleNames,
  ])

  const ruleNames = [
    ...new Set([
      ...configuredRuleNames,
      ...coreRuleNames,
      ...pluginRuleDefinitions.keys(),
    ]),
  ]
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
    const pluginDefinition = pluginRuleDefinitions.get(ruleName)
    const definition
      = getRulePlugin(ruleName) === 'stylelint'
        ? coreRuleDefinitions.get(ruleName)
        : pluginDefinition?.definition

    return [
      ruleName,
      buildRuleInfo(
        ruleName,
        definition,
        recommendedRuleNames,
        configuredRuleNames,
        pluginDefinition?.sourcePlugin,
        pluginDefinition?.sourceDocsUrl,
        pluginDefinition?.sourceDocsUrlSource,
      ),
    ] as const
  })

  return Object.fromEntries(ruleInfoEntries)
}

function normalizeWorkspaceFilepath(path: string): string {
  return normalize(path).replaceAll('\\', '/')
}

function toWorkspaceScanGlobs(configs: FlatConfigItem[]): string[] {
  const fileGlobs = configs.flatMap(config => config.files ?? [])
  const positiveGlobs = fileGlobs.filter(
    glob => typeof glob === 'string' && !glob.startsWith('!'),
  )
  return [...new Set(positiveGlobs)]
}

async function resolveMatchedFiles(
  configs: FlatConfigItem[],
  basePath: string,
): Promise<{ files: MatchedFile[], diagnostics: string[] }> {
  const diagnostics: string[] = []
  const configuredGlobs = toWorkspaceScanGlobs(configs)
  const hasGeneralConfig = configs.some(
    config => isGeneralConfig(config) && !isIgnoreOnlyConfig(config),
  )
  const scanGlobs = configuredGlobs.length
    ? [
        ...new Set(
          hasGeneralConfig
            ? [...configuredGlobs, ...DEFAULT_WORKSPACE_SCAN_GLOBS]
            : configuredGlobs,
        ),
      ]
    : DEFAULT_WORKSPACE_SCAN_GLOBS

  if (!configuredGlobs.length) {
    diagnostics.push(
      'No explicit `files` globs found in resolved config items; scanned common style-related extensions for workspace matching.',
    )
  }
  else if (hasGeneralConfig) {
    diagnostics.push(
      'General config items were detected; included common style-related extensions in workspace scan alongside configured `files` globs.',
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
      if (
        matched.configs.length === 0
        && matched.globs.length === 0
        && generalConfigIndexes.length
      ) {
        matched.configs.push(...generalConfigIndexes)
      }
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
  return await stat(path)
    .then(() => true)
    .catch(() => false)
}

async function loadConfigFromPath(
  configPath: string,
  basePath: string,
): Promise<{ config: StylelintConfig, dependencies: string[] }> {
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

async function findDiscoveredConfigPath(
  cwd: string,
): Promise<string | undefined> {
  const configFilePath = await findUp(stylelintConfigFilenames, { cwd })
  if (configFilePath)
    return normalize(configFilePath)

  const legacyFilePath = await findUp(stylelintLegacyConfigFilenames, {
    cwd,
  })
  if (legacyFilePath)
    return normalize(legacyFilePath)

  const packageJsonPath = await findUp('package.json', { cwd })
  if (!packageJsonPath)
    return undefined

  const packageJsonContent = await readFile(packageJsonPath, 'utf-8').catch(
    () => undefined,
  )
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

  async resolveConfigPath(
    options: ResolveConfigPathOptions,
  ): Promise<ResolvedConfigPath> {
    const { cwd, userConfigPath, userBasePath } = options

    const resolvedUserBasePath = userBasePath
      ? normalize(resolve(cwd, userBasePath))
      : undefined
    const lookupBasePath = resolvedUserBasePath ?? cwd

    let configPath: string | undefined
    if (userConfigPath) {
      const candidate = normalize(resolve(cwd, userConfigPath))

      if (!(await exists(candidate))) {
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
        : configPath
          ? dirname(configPath)
          : lookupBasePath),
    )

    return {
      basePath,
      configPath,
    }
  }

  async readConfig(options: ReadConfigOptions): Promise<InspectorReadResult> {
    const { chdir = true, globMatchedFiles: shouldGlobMatchedFiles = true }
      = options

    const { basePath, configPath } = await this.resolveConfigPath(options)
    const configPathRelative = configPath
      ? getRelativeFilepath(options.cwd, configPath)
      : ''

    if (chdir && basePath !== process.cwd())
      process.chdir(basePath)

    const targetFilePath = normalize(
      resolve(basePath, options.targetFilePath ?? DEFAULT_TARGET_FILE),
    )
    const targetFilepathRelative = getRelativeFilepath(basePath, targetFilePath)

    console.log(
      MARK_INFO,
      `Resolving Stylelint config for`,
      c.blue(targetFilepathRelative),
    )

    const dependencies = new Set<string>()
    const diagnostics: string[] = []
    let config: StylelintConfig | undefined

    if (configPath) {
      try {
        const loaded = await loadConfigFromPath(configPath, basePath)
        config = loaded.config

        if (options.userConfigPath)
          loaded.dependencies.forEach(dep => dependencies.add(dep))
        else dependencies.add(configPath)
      }
      catch (error) {
        if (options.userConfigPath)
          throw error

        dependencies.add(configPath)
        diagnostics.push(
          'Could not parse discovered config directly; using resolved output only for config item extraction.',
        )
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
    const rules = await buildRuleCatalog(
      configs,
      resolved as StylelintConfigLike,
    )

    let files: MatchedFile[] | undefined
    if (shouldGlobMatchedFiles) {
      const resolvedFiles = await resolveMatchedFiles(configs, basePath)
      files = resolvedFiles.files
      diagnostics.push(...resolvedFiles.diagnostics)
    }

    console.log(
      MARK_CHECK,
      'Loaded with',
      configs.length,
      'config items and',
      Object.keys(rules).length,
      'rules',
    )

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
