<script setup lang="ts">
import type { RuleConfigStates, RuleInfo, RuleLevel } from '~~/shared/types'
import { useClipboard } from '@vueuse/core'
import { vTooltip } from 'floating-vue'
import { computed } from 'vue'
import {
  getRuleLevel,
  getRuleOptions,
  getRulePrimaryOption,
} from '~~/shared/rules'
import { deepCompareOptions } from '~/composables/options'
import { getRuleDefaultOptions } from '~/composables/payload'

const props = defineProps<{
  rule: RuleInfo
  ruleStates?: RuleConfigStates
  value?: any
  class?: string
  gridView?: boolean
  dimDisabled?: boolean
}>()

const emit = defineEmits<{
  badgeClick: [MouseEvent]
  stateClick: [RuleLevel]
}>()

const PLACEHOLDER_CONTEXT_RE
  = /no more than|at most|at least|specificity|match pattern|to be one of|must be|should be|allowed list|disallowed list/
const PLACEHOLDER_VALUE_RE = /<value>|‹([^›]+)›/gu
const DEFAULT_PLACEHOLDER_EXAMPLE = 'foo'

interface DescriptionSegment {
  type: 'text' | 'token'
  value: string
}

function redundantOptions(options: any) {
  const { hasRedundantOptions } = deepCompareOptions(
    options ?? [],
    getRuleDefaultOptions(props.rule.name),
  )
  return hasRedundantOptions
}

const { copy } = useClipboard()

function capitalize(str?: string) {
  if (!str)
    return str
  return str[0]!.toUpperCase() + str.slice(1)
}

function stringifyInline(value: unknown): string {
  if (typeof value === 'string')
    return value

  const serialized = JSON.stringify(value)
  return serialized === undefined ? String(value) : serialized
}

function isScalarDisplayValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

function shouldReplacePlaceholderByContext(
  description: string,
  index: number,
): boolean {
  const lookBehind = description
    .slice(Math.max(0, index - 56), index)
    .toLowerCase()
  return PLACEHOLDER_CONTEXT_RE.test(lookBehind)
}

function applyPlaceholderGuesses(
  description: string,
  configuredValue: unknown,
): string {
  if (!description.includes('<value>'))
    return description

  if (!isScalarDisplayValue(configuredValue))
    return description

  const renderValue = stringifyInline(configuredValue)
  if (!renderValue.length)
    return description

  const placeholder = '<value>'
  const indices: number[] = []
  let start = description.indexOf(placeholder)
  while (start !== -1) {
    indices.push(start)
    start = description.indexOf(placeholder, start + placeholder.length)
  }

  if (!indices.length)
    return description

  if (indices.length === 1) {
    if (!shouldReplacePlaceholderByContext(description, indices[0]!))
      return description
    return description.replace(placeholder, renderValue)
  }

  const parts: string[] = []
  let cursor = 0
  let replaced = false
  for (const index of indices) {
    parts.push(description.slice(cursor, index))
    if (shouldReplacePlaceholderByContext(description, index)) {
      parts.push(renderValue)
      replaced = true
    }
    else {
      parts.push(placeholder)
    }
    cursor = index + placeholder.length
  }
  parts.push(description.slice(cursor))

  return replaced ? parts.join('') : description
}

const effectiveState = computed(() => {
  const states = props.ruleStates
  if (!states?.length)
    return undefined

  return (
    states.toReversed().find(state => state.level !== 'off') ?? states.at(-1)
  )
})

const localConfiguredValue = computed(() => {
  if (props.value === undefined)
    return undefined

  return getRulePrimaryOption(props.value) ?? getRuleOptions(props.value)?.[0]
})

const effectiveConfiguredValue = computed(() => {
  if (localConfiguredValue.value !== undefined)
    return localConfiguredValue.value

  const state = effectiveState.value
  if (!state)
    return undefined

  return state.primaryOption ?? state.options?.[0]
})

const isOffOnlyState = computed(() => {
  const states = props.ruleStates
  if (!states?.length)
    return false

  return states.every(state => state.level === 'off')
})

const resolvedDescription = computed(() => {
  if (props.rule.invalid)
    return 'Invalid rule has no description'

  const rawDescription = props.rule.docs?.description
  const baseDescription
    = capitalize(rawDescription) ?? 'No description available'
  const configuredValue = effectiveConfiguredValue.value
  if (configuredValue === undefined)
    return baseDescription

  return applyPlaceholderGuesses(baseDescription, configuredValue)
})

const descriptionSegments = computed<DescriptionSegment[]>(() => {
  const description = resolvedDescription.value
  const segments: DescriptionSegment[] = []
  let cursor = 0

  for (const match of description.matchAll(PLACEHOLDER_VALUE_RE)) {
    const index = match.index ?? 0
    if (cursor < index) {
      segments.push({
        type: 'text',
        value: description.slice(cursor, index),
      })
    }

    segments.push({
      type: 'token',
      value: match[1] ?? DEFAULT_PLACEHOLDER_EXAMPLE,
    })
    cursor = index + match[0].length
  }

  if (cursor < description.length) {
    segments.push({
      type: 'text',
      value: description.slice(cursor),
    })
  }

  return segments.length
    ? segments
    : [{ type: 'text', value: description }]
})

const isMissingDescription = computed(
  () => !!props.rule.docs?.descriptionMissing && !props.rule.invalid,
)
const descriptionSource = computed(() => props.rule.docs?.descriptionSource)
const isMessageDerivedDescription = computed(
  () => descriptionSource.value === 'message' && !isMissingDescription.value,
)
const isInferredDocsUrl = computed(
  () => props.rule.docs?.urlSource === 'inferred',
)
const docsTooltip = computed(() => {
  if (isInferredDocsUrl.value)
    return 'Docs (inferred from plugin package metadata)'
  return 'Docs'
})

const isDimmedRule = computed(() => {
  if (!(props.dimDisabled ?? true))
    return false

  if (props.value !== undefined)
    return getRuleLevel(props.value) === 'off'

  return isOffOnlyState.value
})

const dimRuleClass = computed(() =>
  isDimmedRule.value ? 'op55 hover:op100 transition-opacity' : '',
)

const hasRuleStates = computed(() => (props.ruleStates?.length ?? 0) > 0)
const hasLocalValue = computed(() => props.value !== undefined)

const pluginPackageName = computed(() => {
  if (props.rule.pluginPackageName)
    return props.rule.pluginPackageName

  if (props.rule.plugin)
    return `stylelint-${props.rule.plugin}`

  return undefined
})

const pluginPrefixHint = computed(() => {
  const [scope] = props.rule.name.split('/')
  if (scope !== 'plugin')
    return undefined

  if (!pluginPackageName.value) {
    return 'This rule uses a generic plugin/ prefix from its upstream plugin package.'
  }

  return `This rule is published with a generic plugin/ prefix by ${pluginPackageName.value}. Use ${props.rule.name} in config.`
})

const ruleNameTooltip = computed(() => {
  if (!pluginPrefixHint.value)
    return `Rule name: ${props.rule.name}`

  return [
    `Rule name: ${props.rule.name}`,
    pluginPrefixHint.value,
  ].join('\n')
})
</script>

<template>
  <div
    :class="[
      props.class,
      dimRuleClass,
      gridView
        ? 'absolute top-2 right-2 flex justify-end items-start'
        : 'w-full flex items-center justify-end',
    ]"
    text-lg
  >
    <template v-if="hasRuleStates">
      <div flex="~ items-center gap-0.5 justify-end" :class="gridView ? 'flex-col' : ''">
        <template v-for="(s, idx) of ruleStates" :key="idx">
          <VDropdown>
            <RuleLevelIcon
              :level="s.level"
              :config-index="s.configIndex"
              :has-options="s.primaryOption !== undefined || !!s.options?.length"
              :has-redundant-options="redundantOptions(s.options)"
            />
            <template #popper="{ shown }">
              <RuleStateItem v-if="shown" :state="s" />
            </template>
          </VDropdown>
        </template>
      </div>
    </template>
    <template v-else-if="hasLocalValue">
      <RuleLevelIcon
        :level="getRuleLevel(value)"
        :has-options="
          getRulePrimaryOption(value) !== undefined
            || !!getRuleOptions(value)?.length
        "
        :has-redundant-options="redundantOptions(getRuleOptions(value))"
      />
    </template>
    <div v-else-if="!gridView" h-5 w-5 op0 />
  </div>

  <div :class="[props.class, dimRuleClass]" relative min-w-0 pr2>
    <VDropdown>
      <div min-w-0 w-full inline-flex items-center gap-1>
        <button
          v-if="pluginPrefixHint"
          v-tooltip="pluginPrefixHint"
          class="flex-none rounded-full p0.5 text-violet6 transition hover:bg-violet:12 dark:text-violet3"
          type="button"
          title="Plugin prefix note"
        >
          <span i-ph-info-duotone text-sm />
        </button>
        <ColorizedRuleName
          v-tooltip="{ content: ruleNameTooltip }"
          :name="rule.name"
          :prefix="rule.plugin"
          :deprecated="rule.deprecated"
          :borderless="true"
          :break="gridView"
          :hover-reveal="false"
          :title="rule.name"
          class="min-w-0"
          text-start
          as="button"
          @click="(e: MouseEvent) => emit('badgeClick', e)"
        />
      </div>
      <template #popper="{ shown }">
        <div v-if="shown" max-h="50vh" min-w="min(32rem,82vw)">
          <div flex="~ items-center gap-2" p3>
            <NuxtLink
              v-if="!rule.invalid && rule.docs?.url"
              v-tooltip="docsTooltip"
              class="inline-flex items-center gap-1.5 border border-base rounded-full bg-black/8 px3 py1.5 text-sm text-inherit no-underline transition dark:bg-white/6 hover:bg-black/14 dark:hover:bg-white/12"
              :to="rule.docs?.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="docsTooltip"
            >
              <div i-ph-book-duotone />
              Docs
              <div v-if="isInferredDocsUrl" i-ph-magic-wand-duotone op60 />
            </NuxtLink>
            <button
              class="inline-flex items-center gap-1.5 border border-base rounded-full bg-black/8 px3 py1.5 text-sm text-inherit transition dark:bg-white/6 hover:bg-black/14 dark:hover:bg-white/12"
              title="Copy"
              @click="copy(rule.name)"
            >
              <div i-ph-copy-duotone />
              Copy name
            </button>
            <slot name="popup-actions" />
          </div>
          <div border="t base" px3 pb2 pt2 text-xs>
            <div flex="~ items-center gap-1.5 wrap">
              <span op65>Rule name</span>
              <code font-mono>
                {{ rule.name }}
              </code>
            </div>
            <div
              v-if="pluginPrefixHint"
              class="mt1 inline-flex items-start gap-1.5 text-xs op75"
            >
              <span i-ph-info-duotone mt0.25 text-sm />
              <span>
                Published by <code>{{ pluginPackageName ?? 'unknown package' }}</code> with a generic <code>plugin/</code> prefix.
              </span>
            </div>
          </div>
          <slot name="popup" />
        </div>
      </template>
    </VDropdown>
  </div>

  <div
    v-if="!gridView"
    :class="[props.class, dimRuleClass]"
    mx2
    min-w-0
    flex
    justify-center
  >
    <div
      grid="~ cols-[repeat(4,1.15rem)]"

      min-h-5 items-center justify-items-center gap-x-1.5
    >
      <div
        v-if="rule.invalid"
        v-tooltip="'❌ Invalid rule'"
        class="col-start-1"
        i-ph-seal-warning-duotone
        text-red5
        op80
      />
      <div
        v-if="rule.docs?.recommended"
        v-tooltip="'✅ Recommended'"
        class="col-start-2"
        i-ph-check-square-duotone
        text-green6
        op70
      />
      <div
        v-if="rule.fixable"
        v-tooltip="'🔧 Fixable'"
        class="col-start-3"
        i-ph-wrench-duotone
        text-amber6
        op70
      />
      <div
        v-if="rule.deprecated"
        v-tooltip="'🪦 Deprecated'"
        class="col-start-4"
        i-ph-prohibit-inset-duotone
        op60
      />
    </div>
  </div>

  <div :class="[props.class, dimRuleClass]" min-w-0 flex="~ gap-2 items-center" of-hidden>
    <div
      :title="resolvedDescription"
      :class="[
        rule.deprecated ? 'line-through' : '',
        rule.invalid ? 'text-red' : '',
        gridView
          ? 'op55 text-sm leading-5'
          : 'op75 text-sm ws-nowrap of-hidden text-ellipsis line-clamp-1',
      ]"
    >
      <template v-for="(segment, index) of descriptionSegments" :key="index">
        <span v-if="segment.type === 'text'">{{ segment.value }}</span>
        <code
          v-else
          class="mx-0.5 inline text-[0.94em] text-violet7 font-mono dark:text-violet3"
        >
          {{ segment.value }}
        </code>
      </template>
    </div>
    <div
      v-if="isMissingDescription"
      v-tooltip="
        'No description metadata found for this rule; showing a generated fallback.'
      "
      i-ph-asterisk
      text-2.5
      text-amber5
      op55
    />
    <div
      v-else-if="isMessageDerivedDescription"
      v-tooltip="
        'Description derived from plugin message templates because dedicated metadata is missing.'
      "
      i-ph-chat-centered-text-duotone
      text-3
      text-violet5
      op55
    />
  </div>

  <div
    v-if="
      gridView
        && (rule.invalid
          || rule.deprecated
          || rule.fixable
          || rule.docs?.recommended)
    "
    flex
    flex-auto
    flex-col
    items-start
    justify-end
  >
    <div flex="~ gap-2" mt1>
      <RuleDeprecatedInfo
        v-if="rule.invalid || rule.deprecated"
        :deprecated="rule.deprecated"
        :invalid="rule.invalid"
      />
      <div
        v-if="rule.docs?.recommended"
        v-tooltip="'✅ Recommended'"
        i-ph-check-square-duotone
        op50
      />
      <div
        v-if="rule.fixable"
        v-tooltip="'🔧 Fixable'"
        i-ph-wrench-duotone
        op50
      />
    </div>
  </div>
</template>
