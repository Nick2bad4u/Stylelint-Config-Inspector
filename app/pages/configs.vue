<script setup lang="ts">
import type { FuseResultMatch } from 'fuse.js'
import type { ComponentPublicInstance, PropType, VNode } from 'vue'
import type { FlatConfigItem, MatchedFile, RulesRecord } from '~~/shared/types'
import { useRoute } from '#app/composables/router'
import { debouncedWatch } from '@vueuse/core'
import Fuse from 'fuse.js'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onMounted,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from 'vue'
import {
} from '~~/shared/config-plugin-filters'
import { isIgnoreOnlyConfig, matchFile } from '~~/shared/configs'
import { getRuleLevel } from '~~/shared/rules'
import { getPluginColor } from '~/composables/color'
import { payload } from '~/composables/payload'
import {
  configsOpenState,
  filtersConfigs as filters,
  stateStorage,
} from '~/composables/state'

// TODO: fix the lint
// eslint-disable-next-line unimport/auto-insert
definePageMeta({
  scrollToTop(to) {
    return !('index' in to.query)
  },
})

const input = ref(filters.filepath)
const autoCompleteIndex = ref(0)
const autoCompleteOpen = ref(false)

function expandAll() {
  configsOpenState.value = configsOpenState.value.map(() => true)
}

function collapseAll() {
  configsOpenState.value = configsOpenState.value.map(() => false)
}

const filteredConfigs = shallowRef<FlatConfigItem[]>([])
const prePluginFilteredConfigs = shallowRef<FlatConfigItem[]>([])
const fileMatchResult = shallowRef<MatchedFile | null>(null)
watchEffect(() => {
  let configs = payload.value.configs

  if (filters.filepath) {
    fileMatchResult.value = matchFile(
      filters.filepath,
      payload.value.configs,
      payload.value.meta.basePath,
    )
    if (fileMatchResult.value.configs.length) {
      const deduplicatedConfigIndexes = new Set([
        ...fileMatchResult.value.configs,
        ...payload.value.configsGeneral
          .filter(i => !isIgnoreOnlyConfig(i))
          .map(i => i.index),
      ])

      configs = [...deduplicatedConfigIndexes]
        .toSorted((a, b) => a - b)
        .map(idx => payload.value.configs[idx]!)
    }
    else {
      configs = []
    }
  }
  else {
    fileMatchResult.value = null
  }

  if (filters.rule) {
    configs = configs.filter(config => filters.rule! in (config.rules || {}))
  }

  prePluginFilteredConfigs.value = configs
})

const configPluginNames = computed(() => {
  const pluginNames = new Set<string>()

  for (const config of prePluginFilteredConfigs.value) {
    for (const pluginName of Object.keys(config.plugins ?? {}))
      pluginNames.add(pluginName)
  }

  return [...pluginNames].toSorted((left, right) => left.localeCompare(right))
})

const pluginOptions = computed(() => {
  return configPluginNames.value.map(plugin => ({
    value: plugin,
    title: plugin,
    style: {
      color: getPluginColor(plugin),
      borderColor: getPluginColor(plugin, 0.55),
      backgroundColor: getPluginColor(plugin, 0.1),
    },
  }))
})

const hasSelectedPlugin = computed(() => filters.plugins.length > 0)
const hasActiveConfigFilters = computed(() =>
  !!(filters.filepath || filters.rule || filters.plugins.length),
)
const hasSummaryChips = computed(() => !!(filters.filepath || filters.rule))

function isPluginSelected(pluginName: string): boolean {
  return filters.plugins.includes(pluginName)
}

function togglePluginSelection(pluginName: string): void {
  const nextSelection = new Set(filters.plugins)

  if (nextSelection.has(pluginName))
    nextSelection.delete(pluginName)
  else
    nextSelection.add(pluginName)

  filters.plugins = [...nextSelection].toSorted((left, right) => left.localeCompare(right))
}

function clearPluginSelection(): void {
  filters.plugins = []
}

function clearFilepathFilter(): void {
  filters.filepath = ''
  input.value = ''
  autoCompleteOpen.value = false
  autoCompleteIndex.value = 0
}

function clearConfigFilters(): void {
  clearFilepathFilter()
  filters.rule = ''
  clearPluginSelection()
}

watchEffect(() => {
  const availablePlugins = new Set(configPluginNames.value)
  const normalizedSelectedPlugins = filters.plugins.filter(plugin => availablePlugins.has(plugin))

  if (normalizedSelectedPlugins.length !== filters.plugins.length)
    filters.plugins = normalizedSelectedPlugins
})

watchEffect(() => {
  let configs = prePluginFilteredConfigs.value

  if (filters.plugins.length) {
    configs = configs.filter(config =>
      filters.plugins.some(pluginName => pluginName in (config.plugins ?? {})),
    )
  }

  filteredConfigs.value = configs
})

const autoCompleteFuse = computed(() => {
  return new Fuse(payload.value.filesResolved?.list || [], {
    threshold: 0.3,
    includeMatches: true,
  })
})

const autoCompleteFiles = computed(() => {
  return autoCompleteFuse.value.search(filters.filepath || '')
})

function autoCompleteConfirm(idx = autoCompleteIndex.value) {
  if (!autoCompleteOpen.value)
    return
  input.value = filters.filepath
    = autoCompleteFiles.value[idx]?.item || filters.filepath
  autoCompleteOpen.value = false
}

function autoCompleteBlur() {
  setTimeout(() => {
    autoCompleteOpen.value = false
  }, 100)
}

function autoCompleteMove(delta: number) {
  if (!autoCompleteOpen.value)
    return
  autoCompleteIndex.value += delta
  if (autoCompleteIndex.value < 0)
    autoCompleteIndex.value += autoCompleteFiles.value.length
  if (autoCompleteIndex.value >= autoCompleteFiles.value.length)
    autoCompleteIndex.value -= autoCompleteFiles.value.length
}

const mergedRules = computed(() => {
  if (!filters.filepath || stateStorage.viewFileMatchType !== 'merged') {
    return {
      all: {},
      common: {},
      specific: {},
      specificDisabled: {},
      specificEnabled: {},
    }
  }
  const all: RulesRecord = {}
  const common: RulesRecord = {}
  const specific: RulesRecord = {}

  filteredConfigs.value.forEach((config) => {
    if (!config.rules)
      return
    Object.assign(all, config.rules)
    if (config.files)
      Object.assign(specific, config.rules)
    else Object.assign(common, config.rules)
  })
  const specificDisabled = Object.fromEntries(
    Object.entries(specific).filter(
      ([_, value]) => getRuleLevel(value) === 'off',
    ),
  )
  const specificEnabled = Object.fromEntries(
    Object.entries(specific).filter(
      ([_, value]) => getRuleLevel(value) !== 'off',
    ),
  )
  for (const key in all) {
    if (getRuleLevel(all[key]) === 'off')
      delete all[key]
  }
  return {
    all,
    common,
    specific,
    specificDisabled,
    specificEnabled,
  }
})

const HighlightMatch = defineComponent({
  props: {
    matches: Array as PropType<readonly FuseResultMatch[]>,
  },
  setup(props) {
    return () =>
      props.matches?.map((match) => {
        let start = 0
        const content = match.value || ''
        const array: VNode[] = []

        for (const [from, to] of match.indices) {
          if (start < from) {
            array.push(h('span', { class: 'op50' }, content.slice(start, from)))
          }
          array.push(
            h(
              'span',
              { class: 'text-purple font-bold' },
              content.slice(from, to + 1),
            ),
          )
          start = to + 1
        }
        if (start < content.length) {
          array.push(h('span', { class: 'op50' }, content.slice(start)))
        }
        return array
      })
  },
})

debouncedWatch(
  () => input.value,
  () => {
    filters.filepath = input.value
    autoCompleteIndex.value = 0
  },
  { debounce: 200 },
)

watch(
  () => filters.filepath,
  () => {
    if (filters.filepath !== input.value)
      input.value = filters.filepath
  },
  { flush: 'sync' },
)

const configEls = new Map<number, HTMLElement>()

const route = useRoute()
onMounted(async () => {
  if (route.query.index != null) {
    const index = Number(route.query.index) - 1
    configsOpenState.value = configsOpenState.value.map(
      (_, idx) => idx === index,
    )
    await nextTick()
    configEls.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
</script>

<template>
  <div>
    <div flex="~ col gap-3" py4>
      <div relative flex>
        <input
          v-model="input"
          placeholder="Test matching with filepath..."
          border="~ base rounded-full"
          :class="input ? 'font-mono' : ''"
          w-full
          bg-transparent
          px3
          py2
          pl10
          outline-none
          @focus="autoCompleteOpen = true"
          @click="autoCompleteOpen = true"
          @blur="autoCompleteBlur"
          @keydown.esc="autoCompleteOpen = false"
          @keydown.down.prevent="autoCompleteMove(1)"
          @keydown.up.prevent="autoCompleteMove(-1)"
          @keydown.enter.prevent="autoCompleteConfirm()"
        >
        <div
          absolute
          bottom-0
          left-0
          top-0
          flex="~ items-center justify-center"
          p4
          op50
        >
          <div i-ph-magnifying-glass-duotone />
        </div>
        <div
          v-show="autoCompleteOpen && autoCompleteFiles.length"
          pos="absolute left-8 right-8 top-1/1"
          border="~ base rounded"
          flex="~ col"
          z-1
          mt--1
          max-h-80
          of-auto
          bg-glass
          py1
          shadow
        >
          <button
            v-for="(file, idx) of autoCompleteFiles"
            :key="file.item"
            :class="idx === autoCompleteIndex ? 'bg-active' : ''"
            px3
            py0.5
            text-left
            font-mono
            hover:bg-active
            @click="autoCompleteConfirm(idx)"
          >
            <template v-if="file.matches">
              <HighlightMatch :matches="file.matches" />
            </template>
            <template v-else>
              {{ file.item }}
            </template>
          </button>
        </div>
      </div>
      <div
        v-if="hasSummaryChips"
        flex="~ gap-2 items-center wrap"
        mb2
      >
        <div v-if="filters.filepath">
          <div
            flex="~ gap-2 items-center wrap"
            border="~ purple/20 rounded-full"
            bg-purple:10
            px3
            py1
            :class="{ 'saturate-0': !filteredConfigs.length }"
          >
            <div i-ph-file-dotted-duotone text-purple />
            <span op50>Filepath</span>
            <code>{{ filters.filepath }}</code>

            <template v-if="!filteredConfigs.length">
              <span op50>is not included or has been ignored</span>
            </template>
            <template v-else-if="stateStorage.viewFileMatchType === 'configs'">
              <span op50>matched with</span>
              <span>{{ filteredConfigs.length }} /
                {{ payload.configs.length }}</span>
              <span op50>config items</span>
            </template>
            <template v-else>
              <span op50>matched with total </span>
              <span>{{ Object.keys(mergedRules.all).length }}</span>
              <span op50>rules, </span>
              <span>{{ Object.keys(mergedRules.specific).length }}</span>
              <span op50>of them are specific to the file</span>
            </template>
            <button
              i-ph-x
              text-sm
              op25
              hover:op100
              @click="clearFilepathFilter()"
            />
          </div>
        </div>
        <div v-if="filters.rule">
          <div
            flex="~ gap-2 items-center"
            border="~ blue/20 rounded-full"
            bg-violet:10
            px3
            py1
          >
            <div i-ph-funnel-duotone />
            <span op50>Filtered by</span>
            <ColorizedRuleName :name="filters.rule" />
            <span op50>rule</span>
            <button
              i-ph-x
              text-sm
              op25
              hover:op100
              @click="filters.rule = ''"
            />
          </div>
        </div>
      </div>
      <div
        v-if="pluginOptions.length"
        grid="~ cols-[max-content_1fr] gap-2"
        my2
        items-center
      >
        <div text-right text-sm op50>
          Plugin rules
        </div>
        <div class="space-y-2">
          <div class="text-xs text-zinc-600 font-semibold tracking-wide uppercase dark:text-zinc-300/85">
            Filter all configs by plugin-scoped rules
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="plugin-filter-button badge border border-base px-2 py-0.5 text-xs transition"
              :class="[
                !hasSelectedPlugin
                  ? 'bg-violet-100 text-violet-800 dark:bg-zinc-700/45 dark:text-zinc-100'
                  : 'bg-white/65 text-zinc-700 hover:bg-black/6 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
              ]"
              @click="clearPluginSelection"
            >
              All plugins
            </button>
            <button
              v-for="pluginOption in pluginOptions"
              :key="pluginOption.value"
              type="button"
              class="plugin-filter-button badge border border-base px-2 py-0.5 text-xs transition"
              :class="[
                isPluginSelected(pluginOption.value)
                  ? 'bg-violet-100 text-violet-800 opacity-100 dark:bg-zinc-700/45 dark:text-zinc-100'
                  : hasSelectedPlugin
                    ? 'bg-white/65 text-zinc-700 opacity-55 hover:opacity-85 dark:bg-zinc-900/30 dark:text-zinc-300 dark:opacity-45 dark:hover:opacity-80'
                    : 'bg-white/65 text-zinc-700 hover:bg-black/6 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
              ]"
              :style="pluginOption.style"
              @click="togglePluginSelection(pluginOption.value)"
            >
              {{ pluginOption.title }}
            </button>
          </div>
        </div>
      </div>
      <div flex="~ gap-2 items-center wrap">
        <template v-if="filters.filepath">
          <div border="~ base rounded" flex>
            <button
              :class="
                stateStorage.viewFileMatchType === 'configs'
                  ? 'btn-action-active'
                  : 'op50'
              "
              btn-action
              border-none
              @click="
                stateStorage.viewFileMatchType
                  = stateStorage.viewFileMatchType === 'configs'
                    ? 'merged'
                    : 'configs'
              "
            >
              <div i-ph-stack-duotone />
              <span>Matched Config Items</span>
            </button>
            <div border="l base" />
            <button
              :class="
                stateStorage.viewFileMatchType !== 'configs'
                  ? 'btn-action-active'
                  : 'op50'
              "
              btn-action
              border-none
              @click="
                stateStorage.viewFileMatchType
                  = stateStorage.viewFileMatchType === 'configs'
                    ? 'merged'
                    : 'configs'
              "
            >
              <div i-ph-film-script-duotone />
              <span>Merged Rules</span>
            </button>
          </div>
        </template>

        <label
          v-if="
            filters.filepath && stateStorage.viewFileMatchType === 'configs'
          "
          flex="~ gap-2 items-center"
          ml2
          select-none
        >
          <input
            :checked="stateStorage.showSpecificOnly"
            type="checkbox"
            @change="
              stateStorage.showSpecificOnly = !!($event.target as any).checked
            "
          >
          <span op50>Show Specific Rules Only</span>
        </label>
        <div flex-auto />
        <div flex="~ items-center gap-1">
          <button
            v-if="hasActiveConfigFilters"
            btn-action
            px3
            @click="clearConfigFilters"
          >
            <div i-ph-funnel-duotone />
            Clear filters
          </button>
          <div flex="~ gap-1">
            <button
              btn-action
              :class="{
                'btn-action-active': stateStorage.viewType === 'list',
              }"
              @click="stateStorage.viewType = 'list'"
            >
              <div i-ph-list-duotone />
              List
            </button>
            <button
              btn-action
              :class="{
                'btn-action-active': stateStorage.viewType === 'grid',
              }"
              @click="stateStorage.viewType = 'grid'"
            >
              <div i-ph-grid-four-duotone />
              Grid
            </button>
          </div>
        </div>
        <button btn-action px3 @click="expandAll">
          Expand All
        </button>
        <button btn-action px3 @click="collapseAll">
          Collapse All
        </button>
      </div>

      <template v-if="!filteredConfigs.length">
        <div mt5 italic op50>
          No matched config items.
        </div>
        <template v-if="fileMatchResult?.globs.length">
          <div>Ignored by globs:</div>
          <div flex="~ gap-2 items-center wrap">
            <GlobItem
              v-for="(glob, idx) of fileMatchResult.globs"
              :key="idx"
              :glob="glob"
              popup="configs"
            />
          </div>
        </template>
      </template>
      <template v-else>
        <!-- Merged Rules -->
        <template
          v-if="filters.filepath && stateStorage.viewFileMatchType === 'merged'"
        >
          <details class="flat-config-item" border="~ base rounded-lg" relative>
            <summary block>
              <div
                flex="~ gap-2 items-start"
                cursor-pointer
                select-none
                bg-hover
                px2
                py2
                text-sm
                font-mono
                op75
              >
                <div
                  i-ph-caret-right
                  class="[details[open]_&]:rotate-90"
                  transition
                />
                Merged Rules: Common to every file ({{
                  Object.keys(mergedRules.common).length
                }}
                rules)
              </div>
            </summary>
            <RuleList m4 :rules="mergedRules.common" :grid-view="false" />
          </details>
          <details
            class="flat-config-item"
            border="~ base rounded-lg"
            open
            relative
          >
            <summary block>
              <div
                flex="~ gap-2 items-start"
                cursor-pointer
                select-none
                bg-hover
                px2
                py2
                text-sm
                font-mono
                op75
              >
                <div
                  i-ph-caret-right
                  class="[details[open]_&]:rotate-90"
                  transition
                />
                Merged Rules: Specific to matched file ({{
                  Object.keys(mergedRules.specific).length
                }}
                rules)
              </div>
            </summary>
            <template v-if="Object.keys(mergedRules.specificDisabled).length">
              <div px4 pt4>
                Disables ({{
                  Object.keys(mergedRules.specificDisabled).length
                }})
              </div>
              <RuleList
                m4
                :grid-view="false"
                :get-bind="(name: string) => ({ class: 'op50' })"
                :rules="mergedRules.specificDisabled"
              />
            </template>
            <template v-if="Object.keys(mergedRules.specificEnabled).length">
              <div px4 pt4>
                Enables ({{ Object.keys(mergedRules.specificEnabled).length }})
              </div>
              <RuleList m4 :rules="mergedRules.specificEnabled" :grid-view="false" />
            </template>
          </details>
        </template>

        <!-- Config Items -->
        <template v-else>
          <template v-for="(config, idx) in payload.configs" :key="idx">
            <ConfigItem
              v-show="
                filteredConfigs.includes(config)
                  && (!filters.filepath
                    || !stateStorage.showSpecificOnly
                    || config.files)
              "
              :ref="
                el => {
                  configEls.set(idx, (el as ComponentPublicInstance)?.$el)
                }
              "
              v-model:open="configsOpenState[idx]"
              :config
              :index="idx"
              :filters="filters"
              :active="!!(filters.filepath && config.files)"
              :matched-globs="fileMatchResult?.globs"
              @badge-click="e => (filters.rule = e)"
            />
          </template>
        </template>
      </template>
    </div>
  </div>
</template>
