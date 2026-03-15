import type { Ref } from 'vue'
import { useState } from '#app/composables/state'
import { useMediaQuery } from '@vueuse/core'
import {
  computed,
  ref,
  watch,
} from 'vue'

export type UserTheme = 'auto' | 'light' | 'dark'

export type SearchMode = 'advanced' | 'native'

export type ViewFileMatchType = 'all' | 'configs' | 'merged'

export type ViewType = 'list' | 'grid'

export type ViewFilesTab = 'list' | 'group'

export type FontScale = 'sm' | 'md' | 'lg'

export type RuleStateFilter
  = ''
    | 'using'
    | 'unused'
    | 'off'
    | 'error'
    | 'warn'
    | 'off-only'
    | 'overloads'

export type RuleStatusFilter
  = ''
    | 'active'
    | 'recommended'
    | 'fixable'
    | 'deprecated'

export interface FiltersConfigsPage {
  filepath: string
  rule: string
  plugins: string[]
}

export interface FiltersRulesPage {
  state: RuleStateFilter
  status: RuleStatusFilter
  fixable: boolean | null
  search: string
  plugins: string[]
}

export interface ViewerStateStorage {
  theme: UserTheme
  fontScale: FontScale
  searchMode: SearchMode
  viewFileMatchType: ViewFileMatchType
  showSpecificOnly: boolean
  viewType: ViewType
  rulesViewType: ViewType
  viewFilesTab: ViewFilesTab
  dimDisabledRules: boolean
  filtersConfigs: FiltersConfigsPage
  filtersRules: FiltersRulesPage
}

const STATE_STORAGE_KEY = 'stateStorage'

const RULE_STATE_FILTER_VALUES: readonly RuleStateFilter[] = [
  '',
  'using',
  'unused',
  'off',
  'error',
  'warn',
  'off-only',
  'overloads',
]

const RULE_STATUS_FILTER_VALUES: readonly RuleStatusFilter[] = [
  '',
  'active',
  'recommended',
  'fixable',
  'deprecated',
]

const FONT_SCALE_VALUES: readonly FontScale[] = ['sm', 'md', 'lg']

const FONT_SCALE_MULTIPLIERS: Record<FontScale, string> = {
  sm: '0.9375',
  md: '1',
  lg: '1.125',
}

const DEFAULT_STATE_STORAGE: ViewerStateStorage = {
  theme: 'auto',
  fontScale: 'md',
  searchMode: 'advanced',
  viewFileMatchType: 'all',
  showSpecificOnly: false,
  viewType: 'grid',
  rulesViewType: 'list',
  viewFilesTab: 'group',
  dimDisabledRules: true,
  filtersConfigs: {
    filepath: '',
    rule: '',
    plugins: [],
  },
  filtersRules: {
    state: '',
    status: '',
    fixable: null,
    search: '',
    plugins: [],
  },
}

const VIEWER_STATE_STORAGE_KEYS = [
  'theme',
  'fontScale',
  'searchMode',
  'viewFileMatchType',
  'showSpecificOnly',
  'viewType',
  'rulesViewType',
  'viewFilesTab',
  'dimDisabledRules',
  'filtersConfigs',
  'filtersRules',
] as const satisfies readonly (keyof ViewerStateStorage)[]

const FILTERS_CONFIG_KEYS = [
  'filepath',
  'rule',
  'plugins',
] as const satisfies readonly (keyof FiltersConfigsPage)[]

const FILTERS_RULES_KEYS = [
  'state',
  'status',
  'fixable',
  'search',
  'plugins',
] as const satisfies readonly (keyof FiltersRulesPage)[]

function createDefaultFiltersConfigs(): FiltersConfigsPage {
  return {
    filepath: DEFAULT_STATE_STORAGE.filtersConfigs.filepath,
    rule: DEFAULT_STATE_STORAGE.filtersConfigs.rule,
    plugins: [...DEFAULT_STATE_STORAGE.filtersConfigs.plugins],
  }
}

function createDefaultFiltersRules(): FiltersRulesPage {
  return {
    state: DEFAULT_STATE_STORAGE.filtersRules.state,
    status: DEFAULT_STATE_STORAGE.filtersRules.status,
    fixable: DEFAULT_STATE_STORAGE.filtersRules.fixable,
    search: DEFAULT_STATE_STORAGE.filtersRules.search,
    plugins: [...DEFAULT_STATE_STORAGE.filtersRules.plugins],
  }
}

function getStoredStateStorage(): Partial<ViewerStateStorage> {
  if (!import.meta.client)
    return {}

  const raw = localStorage.getItem(STATE_STORAGE_KEY)
  if (!raw)
    return {}

  try {
    const parsed = JSON.parse(raw) as Partial<ViewerStateStorage>
    if (!parsed || typeof parsed !== 'object')
      return {}

    return parsed
  }
  catch {
    return {}
  }
}

function isRuleStateFilter(value: unknown): value is RuleStateFilter {
  return typeof value === 'string'
    && RULE_STATE_FILTER_VALUES.includes(value as RuleStateFilter)
}

function isRuleStatusFilter(value: unknown): value is RuleStatusFilter {
  return typeof value === 'string'
    && RULE_STATUS_FILTER_VALUES.includes(value as RuleStatusFilter)
}

function isFontScale(value: unknown): value is FontScale {
  return typeof value === 'string'
    && FONT_SCALE_VALUES.includes(value as FontScale)
}

function applyFontScale(scale: FontScale): void {
  if (!import.meta.client)
    return

  document.documentElement.style.setProperty(
    '--inspector-font-scale',
    FONT_SCALE_MULTIPLIERS[scale],
  )
}

function buildInitialStateStorage(): ViewerStateStorage {
  const stored = getStoredStateStorage()
  const storedFiltersConfigs = (stored.filtersConfigs ?? {}) as Partial<FiltersConfigsPage>
  const storedFiltersRules = (stored.filtersRules ?? {}) as Partial<FiltersRulesPage>

  const normalizedConfigPlugins = Array.isArray(storedFiltersConfigs.plugins)
    ? storedFiltersConfigs.plugins.filter(
        (value: unknown): value is string => typeof value === 'string' && value.length > 0,
      )
    : []

  const normalizedRulesPlugins = Array.isArray(storedFiltersRules.plugins)
    ? storedFiltersRules.plugins.filter(
        (value: unknown): value is string => typeof value === 'string' && value.length > 0,
      )
    : []

  return {
    theme:
      stored.theme === 'auto' || stored.theme === 'light' || stored.theme === 'dark'
        ? stored.theme
        : DEFAULT_STATE_STORAGE.theme,
    fontScale: isFontScale(stored.fontScale)
      ? stored.fontScale
      : DEFAULT_STATE_STORAGE.fontScale,
    searchMode:
      stored.searchMode === 'advanced' || stored.searchMode === 'native'
        ? stored.searchMode
        : DEFAULT_STATE_STORAGE.searchMode,
    viewFileMatchType:
      stored.viewFileMatchType === 'all'
      || stored.viewFileMatchType === 'configs'
      || stored.viewFileMatchType === 'merged'
        ? stored.viewFileMatchType
        : DEFAULT_STATE_STORAGE.viewFileMatchType,
    showSpecificOnly:
      typeof stored.showSpecificOnly === 'boolean'
        ? stored.showSpecificOnly
        : DEFAULT_STATE_STORAGE.showSpecificOnly,
    viewType:
      stored.viewType === 'list' || stored.viewType === 'grid'
        ? stored.viewType
        : DEFAULT_STATE_STORAGE.viewType,
    rulesViewType:
      stored.rulesViewType === 'list' || stored.rulesViewType === 'grid'
        ? stored.rulesViewType
        : DEFAULT_STATE_STORAGE.rulesViewType,
    viewFilesTab:
      stored.viewFilesTab === 'list' || stored.viewFilesTab === 'group'
        ? stored.viewFilesTab
        : DEFAULT_STATE_STORAGE.viewFilesTab,
    dimDisabledRules:
      typeof stored.dimDisabledRules === 'boolean'
        ? stored.dimDisabledRules
        : DEFAULT_STATE_STORAGE.dimDisabledRules,
    filtersConfigs: {
      filepath:
        typeof storedFiltersConfigs.filepath === 'string'
          ? storedFiltersConfigs.filepath
          : DEFAULT_STATE_STORAGE.filtersConfigs.filepath,
      rule:
        typeof storedFiltersConfigs.rule === 'string'
          ? storedFiltersConfigs.rule
          : DEFAULT_STATE_STORAGE.filtersConfigs.rule,
      plugins: normalizedConfigPlugins,
    },
    filtersRules: {
      state: isRuleStateFilter(storedFiltersRules.state)
        ? storedFiltersRules.state
        : DEFAULT_STATE_STORAGE.filtersRules.state,
      status: isRuleStatusFilter(storedFiltersRules.status)
        ? storedFiltersRules.status
        : DEFAULT_STATE_STORAGE.filtersRules.status,
      fixable:
        typeof storedFiltersRules.fixable === 'boolean'
          ? storedFiltersRules.fixable
          : DEFAULT_STATE_STORAGE.filtersRules.fixable,
      search:
        typeof storedFiltersRules.search === 'string'
          ? storedFiltersRules.search
          : DEFAULT_STATE_STORAGE.filtersRules.search,
      plugins: normalizedRulesPlugins,
    },
  }
}

interface StateRefs {
  stateStorageRef: Ref<ViewerStateStorage>
  configsOpenStateRef: Ref<boolean[]>
  fileGroupsOpenStateRef: Ref<boolean[]>
}

let cachedStateRefs: StateRefs | null = null

function ensureStateRefs(): StateRefs {
  if (cachedStateRefs !== null)
    return cachedStateRefs

  const stateStorageRef = useState<ViewerStateStorage>('stateStorage', buildInitialStateStorage)
  const configsOpenStateRef = useState<boolean[]>('configsOpenState', () => [])
  const fileGroupsOpenStateRef = useState<boolean[]>('fileGroupsOpenState', () => [])

  if (import.meta.client) {
    watch(
      stateStorageRef,
      (value) => {
        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(value))
      },
      { deep: true },
    )

    watch(
      () => stateStorageRef.value.fontScale,
      (fontScale) => {
        applyFontScale(fontScale)
      },
      { immediate: true },
    )
  }

  cachedStateRefs = {
    stateStorageRef,
    configsOpenStateRef,
    fileGroupsOpenStateRef,
  }

  return cachedStateRefs
}

function defineLazyAccessor<TTarget extends object, TKey extends keyof TTarget>(
  host: Record<TKey, TTarget[TKey]>,
  key: TKey,
  resolveTarget: () => TTarget,
): void {
  Object.defineProperty(host, key, {
    configurable: false,
    enumerable: true,
    get: () => resolveTarget()[key],
    set: (value: TTarget[TKey]) => {
      resolveTarget()[key] = value
    },
  })
}

function createLazyStateAccessors<
  TTarget extends object,
  const TKeys extends readonly (keyof TTarget)[],
>(
  resolveTarget: () => TTarget,
  keys: TKeys,
): Pick<TTarget, TKeys[number]> {
  const accessors = {} as Pick<TTarget, TKeys[number]>

  for (const key of keys) {
    defineLazyAccessor(
      accessors as Record<typeof key, TTarget[typeof key]>,
      key,
      resolveTarget,
    )
  }

  return accessors
}

export const stateStorage = createLazyStateAccessors(
  () => ensureStateRefs().stateStorageRef.value,
  VIEWER_STATE_STORAGE_KEYS,
)

export const filtersConfigs = createLazyStateAccessors(
  () => ensureStateRefs().stateStorageRef.value.filtersConfigs,
  FILTERS_CONFIG_KEYS,
)

export const filtersRules = createLazyStateAccessors(
  () => ensureStateRefs().stateStorageRef.value.filtersRules,
  FILTERS_RULES_KEYS,
)

export const isGridView = computed<boolean>({
  get: () => ensureStateRefs().stateStorageRef.value.rulesViewType === 'grid',
  set: (value) => {
    ensureStateRefs().stateStorageRef.value.rulesViewType = value ? 'grid' : 'list'
  },
})

export const bpSm = import.meta.client
  ? useMediaQuery('(min-width: 640px)')
  : ref(false)

export const configsOpenState = computed<boolean[]>({
  get: () => ensureStateRefs().configsOpenStateRef.value,
  set: (value) => {
    ensureStateRefs().configsOpenStateRef.value = value
  },
})

export const fileGroupsOpenState = computed<boolean[]>({
  get: () => ensureStateRefs().fileGroupsOpenStateRef.value,
  set: (value) => {
    ensureStateRefs().fileGroupsOpenStateRef.value = value
  },
})

export function useStateStorage() {
  return {
    stateStorage,
    filtersConfigs,
    filtersRules,
  }
}

export function useStateFilters() {
  return computed(() => ({
    configs: filtersConfigs,
    rules: filtersRules,
  }))
}

export function setStateFilters(
  page: 'configs',
  key: keyof FiltersConfigsPage,
  value: FiltersConfigsPage[keyof FiltersConfigsPage],
): void

export function setStateFilters(
  page: 'rules',
  key: keyof FiltersRulesPage,
  value: FiltersRulesPage[keyof FiltersRulesPage],
): void

export function setStateFilters(
  page: 'configs' | 'rules',
  key: string,
  value: unknown,
): void {
  if (page === 'configs') {
    if (key in filtersConfigs) {
      ;(filtersConfigs as Record<string, unknown>)[key] = value as unknown
    }

    return
  }

  if (key in filtersRules)
    filtersRules[key as keyof FiltersRulesPage] = value as never
}

export function resetStateFilters(page: 'configs' | 'rules'): void {
  if (page === 'configs') {
    Object.assign(filtersConfigs, createDefaultFiltersConfigs())
    return
  }

  Object.assign(filtersRules, createDefaultFiltersRules())
}

export function useRuleGridMode() {
  return isGridView
}
