<script setup lang="ts">
import type { FiltersConfigsPage, FlatConfigItem } from '~~/shared/types'
import { computed, nextTick, ref, watchEffect } from 'vue'
import {
  getConfigPluginFilters,
  getConfigRulePlugins,
  resolveConfigPluginFilter,
  ruleMatchesPluginFilters,
} from '~~/shared/config-plugin-filters'
import {
  getRuleLevel,
  getRuleOptions,
  getRulePrimaryOption,
} from '~~/shared/rules'
import { getPluginColor } from '~/composables/color'
import { payload } from '~/composables/payload'
import { isGridView, stateStorage } from '~/composables/state'
import { stringifyUnquoted } from '~/composables/strings'

const props = defineProps<{
  config: FlatConfigItem
  index: number
  filters?: FiltersConfigsPage
  active?: boolean
  matchedGlobs?: string[]
}>()

const emit = defineEmits<{
  badgeClick: [string]
}>()

/**
 * Fields that are considered metadata and not part of the configuration body.
 * @type {Set<string>}
 */
const META_FIELDS = new Set(['name'])

/**
 * Fields that are added to configs internally by config inspector.
 * @type {Set<string>}
 */
const CONFIG_INSPECTOR_FIELDS = new Set(['index'])
const STYLELINT_OVERRIDE_NAME_RE
  = /^stylelint\/override-(\d+)(?:\s+\(.+\))?$/

const open = defineModel('open', {
  default: true,
})

const hasShown = ref(open.value)
const showAdditionalConfigs = ref(false)
const selectedRulePlugins = ref<string[]>([])

if (!hasShown.value) {
  const stop = watchEffect(() => {
    if (open.value) {
      hasShown.value = true
      stop()
    }
  })
}

const knownRulePlugins = computed(
  () => new Set(Object.values(payload.value.rules).map(rule => rule.plugin).filter(Boolean)),
)
const configRulePlugins = computed(() => getConfigRulePlugins(props.config))
const configRuleListColumns
  = '40px_minmax(12rem,clamp(12rem,34vw,24rem))_5rem_minmax(0,1fr)'
const pluginEntries = computed(() => {
  return Object.keys(props.config.plugins ?? {}).map((name) => {
    const filter = resolvePluginFilter(name)

    return {
      name,
      filter,
      style: {
        color: getPluginColor(name),
        borderColor: getPluginColor(name, 0.55),
        backgroundColor: getPluginColor(name, 0.1),
      },
    }
  })
})
const filterablePlugins = computed(() =>
  getConfigPluginFilters(props.config, knownRulePlugins.value),
)
const totalRuleCount = computed(() => Object.keys(props.config.rules ?? {}).length)
const filteredRuleCount = computed(() =>
  Object.keys(props.config.rules ?? {}).filter(ruleName =>
    ruleMatchesPluginFilters(ruleName, selectedRulePlugins.value),
  ).length,
)
const hasLocalPluginFilter = computed(() => selectedRulePlugins.value.length > 0)
const selectedPluginLabels = computed(() =>
  selectedRulePlugins.value.map(
    pluginName => pluginEntries.value.find(entry => entry.filter === pluginName)?.name ?? pluginName,
  ),
)

const filesSectionEl = ref<HTMLElement>()
const pluginsSectionEl = ref<HTMLElement>()
const extendsSectionEl = ref<HTMLElement>()
const ignoresSectionEl = ref<HTMLElement>()
const rulesSectionEl = ref<HTMLElement>()
const optionsSectionEl = ref<HTMLElement>()

function resolvePluginFilter(name: string): string {
  return resolveConfigPluginFilter(
    name,
    knownRulePlugins.value,
    configRulePlugins.value,
  )
}

function isPluginSelected(pluginName: string): boolean {
  return selectedRulePlugins.value.includes(pluginName)
}

function togglePluginFilter(pluginName: string) {
  if (!pluginName)
    return

  const nextSelection = new Set(selectedRulePlugins.value)

  if (nextSelection.has(pluginName))
    nextSelection.delete(pluginName)
  else
    nextSelection.add(pluginName)

  selectedRulePlugins.value = [...nextSelection].toSorted((left, right) => left.localeCompare(right))
}

function clearPluginFilter() {
  selectedRulePlugins.value = []
}

function matchesSelectedRulePlugins(ruleName: string): boolean {
  return ruleMatchesPluginFilters(ruleName, selectedRulePlugins.value)
}

function getRuleItemClass(ruleName: string): string {
  if (!stateStorage.dimDisabledRules)
    return ''

  return getRuleLevel(props.config.rules?.[ruleName]) === 'off'
    ? 'rule-muted-off'
    : ''
}

const affectedFilesCount = computed(() => {
  const configToFiles = payload.value.filesResolved?.configToFiles
  if (!configToFiles)
    return 0

  return configToFiles.get(props.config.index)?.size ?? 0
})

const extraConfigs = computed(() => {
  const ignoredKeys = [
    'files',
    'plugins',
    'ignores',
    'rules',
    'extends',
    'customSyntax',
    'name',
    'index',
  ]
  return Object.fromEntries(
    Object.entries(props.config).filter(([key]) => !ignoredKeys.includes(key)),
  )
})

function isPrimitiveExtraConfigValue(value: unknown): boolean {
  return (
    value == null
    || [
      'string',
      'number',
      'boolean',
    ].includes(typeof value)
  )
}

const sourceBadge = computed(() => {
  const name = props.config.name ?? ''

  if (name === 'stylelint/root' || name === 'stylelint/resolved/root') {
    return {
      text: 'Root',
      colorClass: 'text-sky6 dark:text-sky3',
      bgClass: 'bg-sky:8',
    }
  }

  const override = STYLELINT_OVERRIDE_NAME_RE.exec(name)
  if (override?.[1]) {
    return {
      text: `Override #${override[1]}`,
      colorClass: 'text-amber6 dark:text-amber3',
      bgClass: 'bg-amber:10',
    }
  }

  return undefined
})

async function scrollToSection(
  section:
    | 'files'
    | 'plugins'
    | 'extends'
    | 'ignores'
    | 'rules'
    | 'options',
) {
  open.value = true
  if (section === 'options')
    showAdditionalConfigs.value = true

  await nextTick()

  const target = {
    files: filesSectionEl.value,
    plugins: pluginsSectionEl.value,
    extends: extendsSectionEl.value,
    ignores: ignoresSectionEl.value,
    rules: rulesSectionEl.value,
    options: optionsSectionEl.value,
  }[section]

  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<template>
  <details
    class="flat-config-item"
    :open="open"
    border="~ rounded-lg"
    relative
    :class="active ? 'border-yellow:70' : 'border-base'"
    @toggle="open = ($event.target as any).open"
  >
    <summary block>
      <div
        class="absolute right-[calc(100%+10px)] top-1.5"
        text-right
        font-mono
        op35
        lt-lg:hidden
      >
        #{{ index + 1 }}
      </div>
      <div
        flex="~ gap-2 items-center"
        cursor-pointer
        select-none
        bg-hover
        px2
        py2
        text-sm
        font-mono
      >
        <div
          class="[details[open]_&]:rotate-90"
          i-ph-caret-right
          flex-none
          op50
          transition
        />
        <div flex flex-auto flex-col flex-wrap gap-3 md:flex-row md:justify-end>
          <span
            :class="config.name ? '' : 'op50 italic'"
            flex="~ gap-2 items-center"
            flex-1
          >
            <ColorizedConfigName v-if="config.name" :name="config.name" />
            <span v-else>anonymous #{{ index + 1 }}</span>
            <code
              v-if="sourceBadge"
              border="~ base rounded-full"
              px2
              py0.2
              text-xs
              :class="[sourceBadge.colorClass, sourceBadge.bgClass]"
            >
              {{ sourceBadge.text }}
            </code>
          </span>

          <div flex="~ gap-2 items-start">
            <SummarizeItem
              icon="i-ph-file-magnifying-glass-duotone"
              :number="affectedFilesCount"
              color="text-yellow5"
              title="Files"
              :clickable="affectedFilesCount > 0 || !!config.files"
              @click="scrollToSection('files')"
            />
            <SummarizeItem
              icon="i-ph-eye-closed-duotone"
              :number="config.ignores?.length || 0"
              color="text-purple5 dark:text-purple4"
              title="ignoreFiles"
              :clickable="!!config.ignores?.length"
              @click="scrollToSection('ignores')"
            />
            <SummarizeItem
              icon="i-ph-sliders-duotone"
              :number="Object.keys(extraConfigs).length"
              color="text-green5"
              title="Options"
              :clickable="Object.keys(extraConfigs).length > 0"
              @click="scrollToSection('options')"
            />
            <SummarizeItem
              icon="i-ph-plug-duotone"
              :number="Object.keys(config.plugins || {}).length"
              color="text-teal5"
              title="Plugins"
              :clickable="Object.keys(config.plugins || {}).length > 0"
              @click="scrollToSection('plugins')"
            />
            <SummarizeItem
              icon="i-ph-stack-plus-duotone"
              :number="config.extends?.length || 0"
              color="text-violet5"
              title="Extends"
              :clickable="!!config.extends?.length"
              @click="scrollToSection('extends')"
            />
            <SummarizeItem
              icon="i-ph-list-dashes-duotone"
              :number="Object.keys(config.rules || {}).length"
              color="text-blue5 dark:text-blue4"
              title="Rules"
              :clickable="!!Object.keys(config.rules || {}).length"
              mr-2
              @click="scrollToSection('rules')"
            />
          </div>
        </div>
      </div>
    </summary>

    <div
      pointer-events-none
      absolute
      right-2
      top-2
      text-right
      text-5em
      font-mono
      op5
    >
      #{{ index + 1 }}
    </div>

    <div v-if="hasShown" flex="~ col gap-4" of-auto px4 py3>
      <div v-if="config.files" ref="filesSectionEl" flex="~ gap-2 items-start">
        <div i-ph-file-magnifying-glass-duotone my1 flex-none />
        <div flex="~ col gap-2">
          <div>Applies to files matching</div>
          <div flex="~ gap-2 items-center wrap">
            <GlobItem
              v-for="(glob, idx) of config.files?.flat()"
              :key="idx"
              :glob="glob"
              popup="files"
              :active="matchedGlobs?.includes(glob)"
            />
          </div>
        </div>
      </div>
      <div
        v-else-if="config.rules || Object.keys(extraConfigs).length"
        flex="~ gap-2 items-center"
      >
        <div i-ph-files-duotone flex-none />
        <div>Generally applies to all files</div>
      </div>
      <div v-if="config.plugins" ref="pluginsSectionEl" flex="~ gap-2 items-start">
        <div i-ph-plug-duotone my1 flex-none />
        <div flex="~ col gap-2">
          <div flex="~ gap-2 items-center wrap">
            <span>Plugins ({{ pluginEntries.length }})</span>
            <button
              v-if="hasLocalPluginFilter"
              btn-action-sm
              @click="clearPluginFilter"
            >
              <div i-ph-x />
              Clear local rule filter
            </button>
          </div>
          <div flex="~ gap-2 items-center wrap">
            <button
              v-if="filterablePlugins.length"
              class="badge border border-base px-2 py-0.5 text-xs transition"
              :class="[
                !hasLocalPluginFilter
                  ? 'bg-violet-100 text-violet-800 dark:bg-zinc-700/45 dark:text-zinc-100'
                  : 'bg-white/65 text-zinc-700 hover:bg-black/6 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
              ]"
              @click="clearPluginFilter"
            >
              All plugins
            </button>
            <button
              v-for="entry of pluginEntries"
              :key="entry.name"
              class="badge border border-transparent rounded-full px-2.5 py-0.5 text-sm leading-4"
              :class="[
                entry.filter && isPluginSelected(entry.filter)
                  ? 'ring-1 ring-violet/40 shadow-sm'
                  : hasLocalPluginFilter
                    ? 'opacity-55 hover:opacity-85'
                    : '',
              ]"
              :style="entry.style"
              font-mono
              :title="entry.filter
                ? `Filter this config item to ${entry.filter} rules`
                : 'No plugin-scoped rules detected in this config item'"
              @click="togglePluginFilter(entry.filter)"
            >
              {{ entry.name }}
            </button>
          </div>
          <div
            v-if="hasLocalPluginFilter"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <span op60>Showing plugin rules for</span>
            <code
              v-for="pluginLabel in selectedPluginLabels"
              :key="pluginLabel"
              class="config-plugin-filter-pill"
            >
              {{ pluginLabel }}
            </code>
            <span op60>in this config item only</span>
          </div>
        </div>
      </div>
      <div v-if="config.extends?.length" ref="extendsSectionEl" flex="~ gap-2 items-start">
        <div i-ph-stack-plus-duotone my1 flex-none />
        <div flex="~ col gap-2">
          <div>Extends ({{ config.extends.length }})</div>
          <div flex="~ gap-2 items-center wrap">
            <code
              v-for="(entry, idx) of config.extends"
              :key="idx"
              border="~ base rounded-full"
              bg-violet:8
              px3
              py0.5
              text-violet7
              font-mono
              dark:text-violet3
            >
              {{ entry }}
            </code>
          </div>
        </div>
      </div>
      <div v-if="config.customSyntax" flex="~ gap-2 items-start">
        <div i-ph-file-code-duotone my1 flex-none />
        <div flex="~ col gap-2">
          <div>Custom syntax</div>
          <code
            border="~ base rounded-full"
            bg-emerald:8
            px3
            py0.5
            text-emerald7
            font-mono
            dark:text-emerald3
          >
            {{ config.customSyntax }}
          </code>
        </div>
      </div>
      <div v-if="config.ignores" ref="ignoresSectionEl" flex="~ gap-2 items-start">
        <div i-ph-eye-closed-duotone my1 flex-none />
        <div flex="~ col gap-2">
          <div
            v-if="
              Object.keys(config).some(
                key =>
                  key !== 'ignores'
                  && !CONFIG_INSPECTOR_FIELDS.has(key)
                  && !META_FIELDS.has(key),
              ) === false
            "
          >
            Ignore files globally
          </div>
          <div v-else>
            ignoreFiles
          </div>
          <div text-sm op65>
            This shows config-level <code>ignoreFiles</code> patterns, not entries from <code>.stylelintignore</code>.
          </div>
          <div flex="~ gap-2 items-center wrap">
            <GlobItem
              v-for="(glob, idx) of config.ignores"
              :key="idx"
              :glob="glob"
              :active="matchedGlobs?.includes(glob)"
            />
          </div>
        </div>
      </div>
      <div v-if="config.rules && Object.keys(config.rules).length" ref="rulesSectionEl">
        <div flex="~ gap-2 items-center wrap">
          <div i-ph-list-dashes-duotone my1 flex-none />
          <div>
            Rules
            <template v-if="hasLocalPluginFilter">
              ({{ filteredRuleCount }} / {{ totalRuleCount }})
            </template>
            <template v-else>
              ({{ totalRuleCount }})
            </template>
          </div>
          <div v-if="hasLocalPluginFilter" text-sm op60>
            filtered locally by plugin
          </div>
        </div>
        <RuleList
          py2
          :class="isGridView ? 'pl6' : ''"
          :list-columns="configRuleListColumns"
          :rules="config.rules"
          :filter="name => (!filters?.rule || filters.rule === name) && matchesSelectedRulePlugins(name)"
          :get-bind="(name: string) => ({ class: getRuleItemClass(name) })"
        >
          <template #popup="{ ruleName, value }">
            <RuleStateItem
              border="t base"
              :is-local="true"
              :state="{
                name: ruleName,
                level: getRuleLevel(value)!,
                configIndex: index,
                primaryOption: getRulePrimaryOption(value),
                options: getRuleOptions(value),
              }"
            />
          </template>
          <template #popup-actions="{ ruleName }">
            <button
              v-close-popper
              btn-action-sm
              @click="emit('badgeClick', ruleName)"
            >
              <div i-ph-funnel-duotone />
              Filter by this rule
            </button>
          </template>
        </RuleList>
        <div>
          <button v-if="filters?.rule" ml8 op50 @click="emit('badgeClick', '')">
            ...{{
              Object.keys(config.rules).filter(r => r !== filters?.rule).length
            }}
            others rules are hidden
          </button>
        </div>
      </div>

      <div v-if="Object.keys(extraConfigs).length" ref="optionsSectionEl" flex="~ gap-2">
        <div i-ph-sliders-duotone my1 flex-none />

        <div flex="~ col gap-2" w-full>
          <button
            class="w-fit flex items-center gap-1 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
            @click="showAdditionalConfigs = !showAdditionalConfigs"
          >
            <span>Additional configurations ({{ Object.keys(extraConfigs).length }})</span>
            <span i-ph-caret-down-fill transition-transform :class="showAdditionalConfigs ? 'rotate-180' : ''" />
          </button>

          <div v-if="showAdditionalConfigs" class="grid gap-x-2 gap-y-1.5 md:grid-cols-[minmax(9rem,auto)_1fr]">
            <template v-for="(value, key) in extraConfigs" :key="key">
              <span class="text-zinc-700 font-600 dark:text-zinc-300">{{ key }}:</span>

              <template v-if="isPrimitiveExtraConfigValue(value)">
                <code class="break-all rounded bg-black:8 px1.5 py0.5 text-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
                  {{ stringifyUnquoted(value) }}
                </code>
              </template>

              <template v-else>
                <code class="break-all rounded bg-black:6 px1.5 py0.5 text-zinc-700 dark:bg-zinc-900/35 dark:text-zinc-300">
                  {{ JSON.stringify(value) }}
                </code>
              </template>
            </template>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>
