<script setup lang="ts">
import type { RuleInfo, RulesRecord } from '~~/shared/types'
import { computed, defineComponent, Fragment, h } from 'vue'
import { getRuleFromName, payload } from '~/composables/payload'
import { isGridView } from '../composables/state'

const props = defineProps<{
  rules: Partial<RulesRecord> | RuleInfo[]
  getBind?: (ruleName: string) => Record<string, any>
  filter?: (ruleName: string) => boolean
  listColumns?: string
  dimDisabled?: boolean
  showRuleStates?: boolean
  gridView?: boolean
}>()
const defaultListColumns
  = '42px_minmax(12rem,clamp(12rem,32vw,24rem))_5rem_minmax(0,1fr)'

const resolvedGridView = computed(() => props.gridView ?? isGridView.value)

const names = computed(() =>
  Array.isArray(props.rules)
    ? props.rules.map(i => i.name)
    : Object.keys(props.rules),
)

const dimDisabled = computed(() => props.dimDisabled ?? true)
function getRule(name: string) {
  return Array.isArray(props.rules)
    ? props.rules.find(i => i.name === name)!
    : getRuleFromName(name)!
}
function getValue(name: string) {
  return Array.isArray(props.rules) ? undefined : props.rules[name]
}

const containerClass = computed(() => {
  if (resolvedGridView.value) {
    return 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,350px),1fr))] gap-2'
  }
  else {
    return 'grid max-w-full min-w-0 gap-x-2 gap-y-2 items-center'
  }
})

const containerStyle = computed(() => {
  if (resolvedGridView.value)
    return undefined

  const columns = props.listColumns || defaultListColumns
  return {
    gridTemplateColumns: columns.replaceAll('_', ' '),
  }
})

const Wrapper = defineComponent({
  setup(_, { slots }) {
    return () =>
      resolvedGridView.value
        ? h(
            'div',
            {
              class:
                'relative border border-base max-w-full rounded-lg p4 py3 flex flex-col gap-2 of-hidden justify-start',
            },
            slots.default?.(),
          )
        : h(Fragment, slots.default?.())
  },
})
</script>

<template>
  <div :class="containerClass" :style="containerStyle">
    <template v-for="name in names" :key="name">
      <Wrapper v-if="props.filter?.(name) !== false">
        <RuleItem
          :rule="getRule(name)"
          :rule-states="
            props.showRuleStates !== false && Array.isArray(rules)
              ? payload.ruleToState.get(name) || []
              : undefined
          "
          :grid-view="resolvedGridView"
          :value="getValue(name)"
          v-bind="getBind?.(name)"
          :dim-disabled="dimDisabled"
        >
          <template #popup>
            <slot name="popup" :rule-name="name" :value="getValue(name)">
              <RuleStateItem
                v-for="(state, idx) of payload.ruleToState.get(name) || []"
                :key="idx"
                border="t base"
                :state="state"
              />
            </slot>
          </template>
          <template #popup-actions>
            <slot name="popup-actions" :rule-name="name" />
          </template>
        </RuleItem>
      </Wrapper>
    </template>
  </div>
</template>
