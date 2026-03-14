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
  plugin: string
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
  searchMode: SearchMode
  viewFileMatchType: ViewFileMatchType
  showSpecificOnly: boolean
  viewType: ViewType
  gridViewRules: boolean
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

const DEFAULT_STATE_STORAGE: ViewerStateStorage = {
  theme: 'auto',
  searchMode: 'advanced',
  viewFileMatchType: 'all',
  showSpecificOnly: false,
  viewType: 'grid',
  gridViewRules: true,
  viewFilesTab: 'group',
  dimDisabledRules: true,
  filtersConfigs: {
    filepath: '',
    rule: '',
    plugin: '',
  },
  filtersRules: {
    state: '',
    status: '',
    fixable: null,
    search: '',
    plugins: [],
  },
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

function buildInitialStateStorage(): ViewerStateStorage {
  const stored = getStoredStateStorage()
  const storedFiltersConfigs = (stored.filtersConfigs ?? {}) as Partial<FiltersConfigsPage>
  const storedFiltersRules = (stored.filtersRules ?? {}) as Partial<FiltersRulesPage>

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
    gridViewRules:
      typeof stored.gridViewRules === 'boolean'
        ? stored.gridViewRules
        : DEFAULT_STATE_STORAGE.gridViewRules,
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
      plugin:
        typeof storedFiltersConfigs.plugin === 'string'
          ? storedFiltersConfigs.plugin
          : DEFAULT_STATE_STORAGE.filtersConfigs.plugin,
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
  if (cachedStateRefs)
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
      () => stateStorageRef.value.viewType,
      (viewType) => {
        stateStorageRef.value.gridViewRules = viewType === 'grid'
      },
      { immediate: true },
    )

    watch(
      () => stateStorageRef.value.gridViewRules,
      (grid) => {
        const next: ViewType = grid ? 'grid' : 'list'
        if (stateStorageRef.value.viewType !== next)
          stateStorageRef.value.viewType = next
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

function createLazyStateProxy<T extends object>(resolveTarget: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      return Reflect.get(resolveTarget(), property)
    },
    set(_target, property, value) {
      return Reflect.set(resolveTarget(), property, value)
    },
    has(_target, property) {
      return Reflect.has(resolveTarget(), property)
    },
  })
}
export const stateStorage = createLazyStateProxy<ViewerStateStorage>(
  () => ensureStateRefs().stateStorageRef.value,
)

export const filtersConfigs = createLazyStateProxy<FiltersConfigsPage>(
  () => ensureStateRefs().stateStorageRef.value.filtersConfigs,
)

export const filtersRules = createLazyStateProxy<FiltersRulesPage>(
  () => ensureStateRefs().stateStorageRef.value.filtersRules,
)

export const isGridView = computed<boolean>({
  get: () => ensureStateRefs().stateStorageRef.value.gridViewRules,
  set: (value) => {
    ensureStateRefs().stateStorageRef.value.gridViewRules = value
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
  value: string,
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
    if (key in filtersConfigs)
      filtersConfigs[key as keyof FiltersConfigsPage] = value as string

    return
  }

  if (key in filtersRules)
    filtersRules[key as keyof FiltersRulesPage] = value as never
}

export function resetStateFilters(page: 'configs' | 'rules'): void {
  if (page === 'configs') {
    Object.assign(filtersConfigs, DEFAULT_STATE_STORAGE.filtersConfigs)
    return
  }

  Object.assign(filtersRules, DEFAULT_STATE_STORAGE.filtersRules)
}

export function useRuleGridMode() {
  return isGridView
}
