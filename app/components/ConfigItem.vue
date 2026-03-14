<script setup lang="ts">
import type { FiltersConfigsPage, FlatConfigItem } from '~~/shared/types'
import { useRouter } from '#app/composables/router'
import { computed, ref, watchEffect } from 'vue'
import {
  getRuleLevel,
  getRuleOptions,
  getRulePrimaryOption,
} from '~~/shared/rules'
import { getPluginColor } from '~/composables/color'
import { payload } from '~/composables/payload'
import { filtersRules, isGridView } from '~/composables/state'
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
const STYLELINT_PLUGIN_PREFIX_RE = /^stylelint-plugin-/
const STYLELINT_PACKAGE_PREFIX_RE = /^stylelint-/
const FILE_EXTENSION_SUFFIX_RE = /\.[^.]+$/
const SCOPED_STYLELINT_PLUGIN_RE = /^(@[^/]+)\/stylelint-plugin(?:-(.+))?$/
const SCOPED_STYLELINT_PACKAGE_RE = /^(@[^/]+)\/stylelint-(.+)$/

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

const router = useRouter()
const knownRulePlugins = computed(
  () => new Set(Object.values(payload.value.rules).map(rule => rule.plugin)),
)
const configRulePlugins = computed(() => {
  const rules = props.config.rules
  if (!rules)
    return new Set<string>()

  return new Set(
    Object.keys(rules)
      .filter(name => name.includes('/'))
      .map(name => name.split('/')[0]!)
      .filter(Boolean),
  )
})

function toPluginFilterCandidates(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed)
    return []

  const candidates = new Set<string>([trimmed])
  const scopedMatch = SCOPED_STYLELINT_PLUGIN_RE.exec(trimmed)
  if (scopedMatch) {
    const scope = scopedMatch[1]
    const suffix = scopedMatch[2]

    if (scope)
      candidates.add(scope)
    if (scope && suffix)
      candidates.add(`${scope}/${suffix}`)
    if (suffix)
      candidates.add(suffix)
  }

  const scopedPackageMatch = SCOPED_STYLELINT_PACKAGE_RE.exec(trimmed)
  if (scopedPackageMatch) {
    const scope = scopedPackageMatch[1]
    const suffix = scopedPackageMatch[2]
    if (scope)
      candidates.add(scope)
    if (scope && suffix)
      candidates.add(`${scope}/${suffix}`)
    if (suffix)
      candidates.add(suffix)
  }

  if (STYLELINT_PLUGIN_PREFIX_RE.test(trimmed))
    candidates.add(trimmed.replace(STYLELINT_PLUGIN_PREFIX_RE, ''))

  if (STYLELINT_PACKAGE_PREFIX_RE.test(trimmed) && trimmed !== 'stylelint')
    candidates.add(trimmed.replace(STYLELINT_PACKAGE_PREFIX_RE, ''))

  const tail = trimmed.split('/').at(-1)
  if (tail) {
    candidates.add(tail)
    const tailWithoutExt = tail.replace(FILE_EXTENSION_SUFFIX_RE, '')
    if (tailWithoutExt)
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

function resolvePluginFilter(name: string): string {
  const availablePlugins = knownRulePlugins.value
  const candidates = toPluginFilterCandidates(name)

  for (const candidate of candidates) {
    if (availablePlugins.has(candidate))
      return candidate
  }

  for (const candidate of candidates) {
    for (const configPlugin of configRulePlugins.value) {
      if (
        candidate === configPlugin
        || candidate.endsWith(`/${configPlugin}`)
        || candidate.endsWith(`-${configPlugin}`)
      ) {
        if (availablePlugins.has(configPlugin))
          return configPlugin
      }
    }
  }

  return ''
}

function gotoPlugin(name: string) {
  const pluginFilter = resolvePluginFilter(name)
  filtersRules.plugins = pluginFilter ? [pluginFilter] : []
  filtersRules.search = ''
  filtersRules.state = pluginFilter ? 'using' : ''
  filtersRules.status = ''
  filtersRules.fixable = null
  router.push('/rules')
}

const affectedFilesCount = computed(() => {
  const configToFiles = payload.value.filesResolved?.configToFiles
  if (!configToFiles)
    return props.config.files?.length || 0

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
            />
            <SummarizeItem
              icon="i-ph-eye-closed-duotone"
              :number="config.ignores?.length || 0"
              color="text-purple5 dark:text-purple4"
              title="Ignores"
            />
            <SummarizeItem
              icon="i-ph-sliders-duotone"
              :number="Object.keys(extraConfigs).length"
              color="text-green5"
              title="Options"
            />
            <SummarizeItem
              icon="i-ph-plug-duotone"
              :number="Object.keys(config.plugins || {}).length"
              color="text-teal5"
              title="Plugins"
            />
            <SummarizeItem
              icon="i-ph-stack-plus-duotone"
              :number="config.extends?.length || 0"
              color="text-violet5"
              title="Extends"
            />
            <SummarizeItem
              icon="i-ph-list-dashes-duotone"
              :number="Object.keys(config.rules || {}).length"
              color="text-blue5 dark:text-blue4"
              title="Rules"
              mr-2
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
      <div v-if="config.files" flex="~ gap-2 items-start">
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
      <div v-if="config.plugins" flex="~ gap-2 items-start">
        <div i-ph-plug-duotone my1 flex-none />
        <div flex="~ col gap-2">
          <div>Plugins ({{ Object.keys(config.plugins).length }})</div>
          <div flex="~ gap-2 items-center wrap">
            <button
              v-for="(name, idx) of Object.keys(config.plugins)"
              :key="idx"
              class="badge border border-transparent rounded-full px-2.5 py-0.5 text-sm leading-4"
              :style="{
                color: getPluginColor(name),
                borderColor: getPluginColor(name, 0.55),
                backgroundColor: getPluginColor(name, 0.1),
              }"
              font-mono
              @click="gotoPlugin(name)"
            >
              {{ name }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="config.extends?.length" flex="~ gap-2 items-start">
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
      <div v-if="config.ignores" flex="~ gap-2 items-start">
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
            Ignore
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
      <div v-if="config.rules && Object.keys(config.rules).length">
        <div flex="~ gap-2 items-center">
          <div i-ph-list-dashes-duotone my1 flex-none />
          <div>Rules ({{ Object.keys(config.rules).length }})</div>
        </div>
        <RuleList
          py2
          :class="isGridView ? 'pl6' : ''"
          :rules="config.rules"
          :filter="name => !filters?.rule || filters.rule === name"
          :get-bind="
            (name: string) => ({
              class:
                getRuleLevel(config.rules?.[name]) === 'off'
                  ? 'rule-muted-off'
                  : '',
            })
          "
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

      <div v-if="Object.keys(extraConfigs).length" flex="~ gap-2">
        <div i-ph-sliders-duotone my1 flex-none />

        <div flex="~ col gap-2" w-full>
          <button
            class="w-fit flex items-center gap-1 text-sm text-zinc-300 hover:text-zinc-100"
            @click="showAdditionalConfigs = !showAdditionalConfigs"
          >
            <span>Additional configurations ({{ Object.keys(extraConfigs).length }})</span>
            <span i-ph-caret-down-fill transition-transform :class="showAdditionalConfigs ? 'rotate-180' : ''" />
          </button>

          <div v-if="showAdditionalConfigs" class="grid grid-cols-[minmax(10rem,auto)_1fr] gap-x-2 gap-y-1.5">
            <template v-for="(value, key) in extraConfigs" :key="key">
              <span class="text-zinc-300 font-600">{{ key }}:</span>

              <template v-if="isPrimitiveExtraConfigValue(value)">
                <code class="break-all rounded bg-zinc-900/50 px1.5 py0.5 text-zinc-200">
                  {{ stringifyUnquoted(value) }}
                </code>
              </template>

              <template v-else>
                <code class="break-all rounded bg-zinc-900/35 px1.5 py0.5 text-zinc-300">
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
