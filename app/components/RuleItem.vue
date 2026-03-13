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
}>()

const emit = defineEmits<{
  badgeClick: [MouseEvent]
  stateClick: [RuleLevel]
}>()

const PLACEHOLDER_CONTEXT_RE =
  /no more than|at most|at least|specificity|match pattern|to be one of|must be|should be|allowed list|disallowed list/

function redundantOptions(options: any) {
  const { hasRedundantOptions } = deepCompareOptions(
    options ?? [],
    getRuleDefaultOptions(props.rule.name),
  )
  return hasRedundantOptions
}

const { copy } = useClipboard()

function capitalize(str?: string) {
  if (!str) return str
  return str[0]!.toUpperCase() + str.slice(1)
}

function stringifyInline(value: unknown): string {
  if (typeof value === 'string') return value

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
  if (!description.includes('<value>')) return description

  if (!isScalarDisplayValue(configuredValue)) return description

  const renderValue = stringifyInline(configuredValue)
  if (!renderValue.length) return description

  const placeholder = '<value>'
  const indices: number[] = []
  let start = description.indexOf(placeholder)
  while (start !== -1) {
    indices.push(start)
    start = description.indexOf(placeholder, start + placeholder.length)
  }

  if (!indices.length) return description

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
    } else {
      parts.push(placeholder)
    }
    cursor = index + placeholder.length
  }
  parts.push(description.slice(cursor))

  return replaced ? parts.join('') : description
}

const effectiveState = computed(() => {
  const states = props.ruleStates
  if (!states?.length) return undefined

  return (
    states.toReversed().find(state => state.level !== 'off') ?? states.at(-1)
  )
})

const localConfiguredValue = computed(() => {
  if (props.value === undefined) return undefined

  return getRulePrimaryOption(props.value) ?? getRuleOptions(props.value)?.[0]
})

const effectiveConfiguredValue = computed(() => {
  if (localConfiguredValue.value !== undefined)
    return localConfiguredValue.value

  const state = effectiveState.value
  if (!state) return undefined

  return state.primaryOption ?? state.options?.[0]
})

const resolvedDescription = computed(() => {
  if (props.rule.invalid) return 'Invalid rule has no description'

  const rawDescription = props.rule.docs?.description
  const baseDescription =
    capitalize(rawDescription) ?? 'No description available'
  const configuredValue = effectiveConfiguredValue.value
  if (configuredValue === undefined) return baseDescription

  return applyPlaceholderGuesses(baseDescription, configuredValue)
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
</script>

<template>
  <div
    v-if="ruleStates"
    flex="~ items-center gap-0.5 justify-end"
    text-lg
    :class="gridView ? 'absolute top-2 right-2 flex-col' : ''"
  >
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

  <div
    v-if="value !== undefined"
    :class="[props.class, gridView ? 'absolute top-2 right-2 flex-col' : '']"
  >
    <RuleLevelIcon
      :level="getRuleLevel(value)"
      :has-options="
        getRulePrimaryOption(value) !== undefined
        || !!getRuleOptions(value)?.length
      "
      :has-redundant-options="redundantOptions(getRuleOptions(value))"
    />
  </div>

  <div :class="props.class" min-w-0>
    <VDropdown inline-block>
      <ColorizedRuleName
        v-tooltip="{ content: rule.name }"
        :name="rule.name"
        :prefix="rule.plugin"
        :deprecated="rule.deprecated"
        :borderless="gridView"
        :break="gridView"
        :title="rule.name"
        text-start
        as="button"
        @click="(e: MouseEvent) => emit('badgeClick', e)"
      />
      <template #popper="{ shown }">
        <div v-if="shown" max-h="50vh">
          <div flex="~ items-center gap-2" p3>
            <NuxtLink
              v-if="!rule.invalid && rule.docs?.url"
              v-tooltip="docsTooltip"
              btn-action-sm
              :to="rule.docs?.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="docsTooltip"
            >
              <div i-ph-book-duotone />
              Docs
              <div v-if="isInferredDocsUrl" i-ph-magic-wand-duotone op60 />
            </NuxtLink>
            <button btn-action-sm title="Copy" @click="copy(rule.name)">
              <div i-ph-copy-duotone />
              Copy name
            </button>
            <slot name="popup-actions" />
          </div>
          <slot name="popup" />
        </div>
      </template>
    </VDropdown>
  </div>

  <div v-if="!gridView" :class="props.class" mx2 min-w-0 flex justify-center>
    <div
      grid="~ cols-[repeat(4,1.1rem)]"
      min-h-5
      items-center
      justify-items-center
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

  <div :class="props.class" min-w-0 flex="~ gap-2 items-center" of-hidden>
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
      {{ resolvedDescription }}
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
