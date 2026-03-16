<script setup lang="ts">
import type { FiltersConfigsPage, FlatConfigItem } from '~~/shared/types'
import { computed, nextTick, ref, watchEffect } from 'vue'
import {
  getConfigRulePlugins,
  resolveConfigPluginFilter,
  ruleMatchesPluginFilters,
} from '~~/shared/config-plugin-filters'
import {
  getRuleLevel,
  getRuleOptions,
  getRulePrimaryOption,
} from '~~/shared/rules'
import { testIds } from '~~/shared/test-ids'
import { getPluginColor } from '~/composables/color'
import { payload } from '~/composables/payload'
import { stateStorage } from '~/composables/state'
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
const selectedPluginPackages = computed(() => props.filters?.plugins ?? [])
const selectedRulePlugins = computed(() => {
  const filters = new Set<string>()

  for (const pluginName of selectedPluginPackages.value) {
    if (!(pluginName in (props.config.plugins ?? {})))
      continue

    const filter = resolvePluginFilter(pluginName)
    if (filter)
      filters.add(filter)
  }

  return [...filters].toSorted((left, right) => left.localeCompare(right))
})
const configRuleListColumns
  = '40px_minmax(14rem,clamp(14rem,38vw,28rem))_5rem_minmax(0,1fr)'
const pluginEntries = computed(() => {
  return Object.keys(props.config.plugins ?? {}).map((name) => {
    const filter = resolvePluginFilter(name)

    return {
      name,
      filter,
      hasPluginScopedRules: filter.length > 0 && configRulePlugins.value.has(filter),
      isSelected: selectedPluginPackages.value.includes(name),
      style: {
        color: getPluginColor(name),
        borderColor: getPluginColor(name, 0.55),
        backgroundColor: getPluginColor(name, 0.1),
      },
    }
  })
})
const totalRuleCount = computed(() => Object.keys(props.config.rules ?? {}).length)
const filteredRuleCount = computed(() =>
  Object.keys(props.config.rules ?? {}).filter(ruleName =>
    ruleMatchesPluginFilters(ruleName, selectedRulePlugins.value),
  ).length,
)
const hasGlobalPluginFilter = computed(() => selectedPluginPackages.value.length > 0)
const hasActiveRuleScopedPluginFilter = computed(() => selectedRulePlugins.value.length > 0)
const isRootConfig = computed(() => {
  return props.config.name === 'stylelint/root'
    || props.config.name === 'stylelint/resolved/root'
})
const stylelintIgnoreInfo = computed(() =>
  isRootConfig.value ? payload.value.meta.stylelintIgnore : undefined,
)

const filesSectionEl = ref<HTMLElement>()
const pluginsSectionEl = ref<HTMLElement>()
const extendsSectionEl = ref<HTMLElement>()
const ignoresSectionEl = ref<HTMLElement>()
const stylelintIgnoreSectionEl = ref<HTMLElement>()
const stylelintIgnoreDetailsEl = ref<HTMLDetailsElement>()
const rulesSectionEl = ref<HTMLElement>()
const optionsSectionEl = ref<HTMLElement>()

function resolvePluginFilter(name: string): string {
  return resolveConfigPluginFilter(
    name,
    knownRulePlugins.value,
    configRulePlugins.value,
  )
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
    const filesLabel = props.config.files?.flat().join(', ')

    return {
      text: filesLabel || `Override #${override[1]}`,
      title: filesLabel || `Override #${override[1]}`,
      colorClass: 'text-amber6 dark:text-amber3',
      bgClass: 'bg-amber:10',
    }
  }

  return undefined
})

interface SummaryItemDescriptor {
  key: string
  icon: string
  number: number
  color: string
  title: string
  clickable: boolean
  section: 'files' | 'plugins' | 'extends' | 'ignores' | 'stylelintignore' | 'rules' | 'options'
  extraClass?: string
}

const summaryItems = computed<SummaryItemDescriptor[]>(() => {
  const optionsCount = Object.keys(extraConfigs.value).length
  const pluginCount = Object.keys(props.config.plugins ?? {}).length
  const extendsCount = props.config.extends?.length ?? 0
  const rulesCount = Object.keys(props.config.rules ?? {}).length
  const ignoresCount = props.config.ignores?.length ?? 0
  const stylelintIgnoreCount = stylelintIgnoreInfo.value?.patterns.length ?? 0
  return [
    {
      key: 'stylelintignore',
      icon: 'i-ph-file-x-duotone',
      number: stylelintIgnoreCount,
      color: 'text-fuchsia5 dark:text-fuchsia4',
      title: '.stylelintignore',
      clickable: stylelintIgnoreCount > 0,
      section: 'stylelintignore',
    },
    {
      key: 'ignores',
      icon: 'i-ph-eye-closed-duotone',
      number: ignoresCount,
      color: 'text-purple5 dark:text-purple4',
      title: 'ignoreFiles',
      clickable: ignoresCount > 0,
      section: 'ignores',
    },
    {
      key: 'options',
      icon: 'i-ph-sliders-duotone',
      number: optionsCount,
      color: 'text-green5',
      title: 'Options',
      clickable: optionsCount > 0,
      section: 'options',
    },
    {
      key: 'files',
      icon: 'i-ph-file-magnifying-glass-duotone',
      number: affectedFilesCount.value,
      color: 'text-yellow5',
      title: 'Files',
      clickable: affectedFilesCount.value > 0 || !!props.config.files,
      section: 'files',
    },
    {
      key: 'plugins',
      icon: 'i-ph-plug-duotone',
      number: pluginCount,
      color: 'text-teal5',
      title: 'Plugins',
      clickable: pluginCount > 0,
      section: 'plugins',
    },
    {
      key: 'extends',
      icon: 'i-ph-stack-plus-duotone',
      number: extendsCount,
      color: 'text-violet5',
      title: 'Extends',
      clickable: extendsCount > 0,
      section: 'extends',
    },
    {
      key: 'rules',
      icon: 'i-ph-list-dashes-duotone',
      number: rulesCount,
      color: 'text-blue5 dark:text-blue4',
      title: 'Rules',
      clickable: rulesCount > 0,
      section: 'rules',
      extraClass: 'mr-2',
    },
  ]
})

async function scrollToSection(
  section:
    | 'files'
    | 'plugins'
    | 'extends'
    | 'ignores'
    | 'stylelintignore'
    | 'rules'
    | 'options',
) {
  open.value = true
  if (section === 'options')
    showAdditionalConfigs.value = true
  if (section === 'stylelintignore' && stylelintIgnoreDetailsEl.value)
    stylelintIgnoreDetailsEl.value.open = true

  await nextTick()

  const target = {
    files: filesSectionEl.value,
    plugins: pluginsSectionEl.value,
    extends: extendsSectionEl.value,
    ignores: ignoresSectionEl.value,
    stylelintignore: stylelintIgnoreSectionEl.value,
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
              :title="sourceBadge.title ?? sourceBadge.text"
              class="max-w-[min(48vw,34rem)] of-hidden text-ellipsis ws-nowrap"
              px2
              py0.2
              text-xs
              :class="[sourceBadge.colorClass, sourceBadge.bgClass]"
            >
              {{ sourceBadge.text }}
            </code>
          </span>

          <div :data-testid="testIds.configs.summaryGrid" class="grid grid-cols-7 items-center justify-items-end gap-2">
            <SummarizeItem
              v-for="item of summaryItems"
              :key="item.key"
              :data-testid="testIds.configs.summaryItem"
              class="w-14 justify-between"
              :icon="item.icon"
              :number="item.number"
              :color="item.color"
              :title="item.title"
              :clickable="item.clickable"
              :class="item.extraClass"
              @click="scrollToSection(item.section)"
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
              variant="files"
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
          </div>
          <div v-if="!configRulePlugins.size" text-sm op65>
            No plugin-scoped rules are declared in this config item; these plugins likely augment core rules, syntax, or metadata.
          </div>
          <div flex="~ gap-2 items-center wrap">
            <code
              v-for="entry of pluginEntries"
              :key="entry.name"
              class="badge border border-transparent rounded-full px-2.5 py-0.5 text-sm leading-4"
              :class="[
                entry.hasPluginScopedRules ? 'ring-1 ring-teal/25 shadow-sm' : 'opacity-80',
                entry.isSelected ? 'ring-2 ring-violet/45 shadow-sm' : '',
              ]"
              :style="entry.style"
              font-mono
              :title="entry.hasPluginScopedRules
                ? `Plugin-scoped rules detected here under ${entry.filter}`
                : 'No plugin-scoped rule names detected in this config item'"
            >
              {{ entry.name }}
            </code>
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
              variant="ignore-files"
              :active="matchedGlobs?.includes(glob)"
            />
          </div>
        </div>
      </div>
      <details
        v-if="stylelintIgnoreInfo?.patterns.length"
        ref="stylelintIgnoreDetailsEl"
        class="border border-fuchsia/18 rounded-lg bg-fuchsia/5 p3"
      >
        <summary
          ref="stylelintIgnoreSectionEl"
          flex="~ gap-2 items-center wrap"
          cursor-pointer
          select-none
        >
          <div i-ph-file-x-duotone flex-none text-fuchsia5 />
          <span font-medium>.stylelintignore</span>
          <code class="rounded-full bg-fuchsia:10 px3 py0.5 text-fuchsia7 font-mono dark:text-fuchsia3">
            {{ stylelintIgnoreInfo.path }}
          </code>
          <span text-sm op60>
            {{ stylelintIgnoreInfo.patterns.length }} patterns
          </span>
          <div i-ph-caret-right class="[details[open]_&]:rotate-90" op50 transition />
        </summary>
        <div mt3 flex="~ gap-2 items-start">
          <div i-ph-eye-slash-duotone my1 flex-none text-fuchsia5 />
          <div flex="~ col gap-2">
            <div text-sm op65>
              Workspace-level ignore patterns loaded from <code>.stylelintignore</code>.
            </div>
            <div flex="~ gap-2 items-center wrap">
              <GlobItem
                v-for="(glob, idx) of stylelintIgnoreInfo.patterns"
                :key="idx"
                :glob="glob"
                variant="stylelintignore"
                :active="matchedGlobs?.includes(glob)"
              />
            </div>
          </div>
        </div>
      </details>
      <div v-if="config.rules && Object.keys(config.rules).length" ref="rulesSectionEl">
        <div flex="~ gap-2 items-center wrap">
          <div i-ph-list-dashes-duotone my1 flex-none />
          <div>
            Rules
            <template v-if="hasActiveRuleScopedPluginFilter">
              ({{ filteredRuleCount }} / {{ totalRuleCount }})
            </template>
            <template v-else>
              ({{ totalRuleCount }})
            </template>
          </div>
          <div v-if="hasActiveRuleScopedPluginFilter" text-sm op60>
            filtered by the page plugin filter
          </div>
          <div v-else-if="hasGlobalPluginFilter" text-sm op60>
            selected plugin package has no plugin-scoped rules here
          </div>
        </div>
        <RuleList
          py2
          :grid-view="false"
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
