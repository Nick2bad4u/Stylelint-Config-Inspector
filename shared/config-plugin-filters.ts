import type { FlatConfigItem } from './types'

const FILE_EXTENSION_SUFFIX_RE = /\.[^.]+$/
const STYLELINT_PLUGIN_PREFIX_RE = /^stylelint-plugin-/
const STYLELINT_PACKAGE_PREFIX_RE = /^stylelint-/
const SCOPED_STYLELINT_PLUGIN_RE = /^(@[^/]+)\/stylelint-plugin(?:-(.+))?$/
const SCOPED_STYLELINT_PACKAGE_RE = /^(@[^/]+)\/stylelint-(.+)$/

function normalizePluginSet(plugins: Iterable<string>): Set<string> {
  return new Set(
    [...plugins].filter(
      (plugin): plugin is string => typeof plugin === 'string' && plugin.length > 0,
    ),
  )
}

export function getRulePluginName(ruleName: string): string {
  const segments = ruleName.split('/').filter(Boolean)
  if (!segments.length)
    return ''

  if (segments[0]?.startsWith('@') === true) {
    const scope = segments[0]
    const plugin = segments[1]

    return typeof plugin === 'string' && plugin.length > 0
      ? `${scope}/${plugin}`
      : (scope ?? '')
  }

  return segments[0] ?? ''
}

export function getConfigRulePlugins(
  config: Pick<FlatConfigItem, 'rules'>,
): Set<string> {
  const rules = config.rules
  if (!rules)
    return new Set<string>()

  return new Set(
    Object.keys(rules)
      .filter(name => name.includes('/'))
      .map(name => getRulePluginName(name))
      .filter(Boolean),
  )
}

export function toPluginFilterCandidates(name: string): string[] {
  const trimmed = name.trim()
  if (trimmed.length === 0)
    return []

  const candidates = new Set<string>([trimmed])
  const scopedPluginMatch = SCOPED_STYLELINT_PLUGIN_RE.exec(trimmed)
  if (scopedPluginMatch) {
    const scope = scopedPluginMatch[1]
    const suffix = scopedPluginMatch[2]

    if (typeof scope === 'string' && scope.length > 0) {
      candidates.add(scope)
    }
    if (
      typeof scope === 'string'
      && scope.length > 0
      && typeof suffix === 'string'
      && suffix.length > 0
    ) {
      candidates.add(`${scope}/${suffix}`)
    }
    if (typeof suffix === 'string' && suffix.length > 0) {
      candidates.add(suffix)
    }
  }

  const scopedPackageMatch = SCOPED_STYLELINT_PACKAGE_RE.exec(trimmed)
  if (scopedPackageMatch) {
    const scope = scopedPackageMatch[1]
    const suffix = scopedPackageMatch[2]
    if (typeof scope === 'string' && scope.length > 0) {
      candidates.add(scope)
    }
    if (
      typeof scope === 'string'
      && scope.length > 0
      && typeof suffix === 'string'
      && suffix.length > 0
    ) {
      candidates.add(`${scope}/${suffix}`)
    }
    if (typeof suffix === 'string' && suffix.length > 0) {
      candidates.add(suffix)
    }
  }

  if (STYLELINT_PLUGIN_PREFIX_RE.test(trimmed))
    candidates.add(trimmed.replace(STYLELINT_PLUGIN_PREFIX_RE, ''))

  if (STYLELINT_PACKAGE_PREFIX_RE.test(trimmed) && trimmed !== 'stylelint')
    candidates.add(trimmed.replace(STYLELINT_PACKAGE_PREFIX_RE, ''))

  const tail = trimmed.split('/').at(-1)
  if (typeof tail === 'string' && tail.length > 0) {
    candidates.add(tail)
    const tailWithoutExt = tail.replace(FILE_EXTENSION_SUFFIX_RE, '')
    if (tailWithoutExt.length > 0)
      candidates.add(tailWithoutExt)
    if (STYLELINT_PLUGIN_PREFIX_RE.test(tail))
      candidates.add(tail.replace(STYLELINT_PLUGIN_PREFIX_RE, ''))
    if (STYLELINT_PLUGIN_PREFIX_RE.test(tailWithoutExt)) {
      candidates.add(tailWithoutExt.replace(STYLELINT_PLUGIN_PREFIX_RE, ''))
    }
    if (STYLELINT_PACKAGE_PREFIX_RE.test(tail) && tail !== 'stylelint')
      candidates.add(tail.replace(STYLELINT_PACKAGE_PREFIX_RE, ''))
    if (
      STYLELINT_PACKAGE_PREFIX_RE.test(tailWithoutExt)
      && tailWithoutExt !== 'stylelint'
    ) {
      candidates.add(tailWithoutExt.replace(STYLELINT_PACKAGE_PREFIX_RE, ''))
    }
  }

  return [...candidates]
}

export function resolveConfigPluginFilter(
  name: string,
  knownRulePlugins: Iterable<string>,
  configRulePlugins: Iterable<string> = [],
): string {
  const availablePlugins = normalizePluginSet(knownRulePlugins)
  const configPlugins = normalizePluginSet(configRulePlugins)
  const candidates = toPluginFilterCandidates(name)

  for (const candidate of candidates) {
    if (availablePlugins.has(candidate))
      return candidate
  }

  for (const candidate of candidates) {
    for (const configPlugin of configPlugins) {
      if (
        candidate === configPlugin
        || candidate.endsWith(`/${configPlugin}`)
        || candidate.endsWith(`-${configPlugin}`)
      ) {
        return configPlugin
      }
    }
  }

  return ''
}

export function getConfigPluginFilters(
  config: FlatConfigItem,
  knownRulePlugins: Iterable<string>,
): string[] {
  const filters = new Set<string>()
  const configRulePlugins = getConfigRulePlugins(config)

  for (const configRulePlugin of configRulePlugins)
    filters.add(configRulePlugin)

  for (const pluginName of Object.keys(config.plugins ?? {})) {
    const filter = resolveConfigPluginFilter(
      pluginName,
      knownRulePlugins,
      configRulePlugins,
    )
    if (filter.length > 0)
      filters.add(filter)
  }

  return [...filters].toSorted((left, right) => left.localeCompare(right))
}

export function configMatchesPluginFilters(
  config: FlatConfigItem,
  selectedPlugins: readonly string[],
  knownRulePlugins: Iterable<string>,
): boolean {
  if (!selectedPlugins.length)
    return true

  const configPlugins = new Set(getConfigPluginFilters(config, knownRulePlugins))
  return selectedPlugins.some(selectedPlugin => configPlugins.has(selectedPlugin))
}

export function ruleMatchesPluginFilters(
  ruleName: string,
  selectedPlugins: readonly string[],
): boolean {
  if (!selectedPlugins.length)
    return true

  const rulePluginName = getRulePluginName(ruleName)
  return selectedPlugins.includes(rulePluginName)
}
