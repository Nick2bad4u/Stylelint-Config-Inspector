<script setup lang="ts">
import { computed } from 'vue'
import { getPluginColor } from '~/composables/color'

const props = withDefaults(defineProps<{
  name: string
  prefix?: string
  url?: string
  as?: string
  deprecated?:
    | boolean
    | {
      message?: string
      url?: string
    }
  borderless?: boolean
  break?: boolean
  hoverReveal?: boolean
  hideCorePrefix?: boolean
}>(), {
  hideCorePrefix: true,
})

const LEADING_SLASHES_RE = /^\/+/

const parsed = computed(() => {
  const parts = props.name.split('/')
  const firstPart = parts[0] ?? ''

  if (parts.length === 1) {
    if (props.prefix) {
      return {
        scope: props.prefix,
        name: firstPart.replace(LEADING_SLASHES_RE, ''),
      }
    }

    return {
      scope: undefined,
      name: firstPart,
    }
  }

  return {
    scope: firstPart,
    name: parts.slice(1).join('/'),
  }
})

const displayScope = computed(() => {
  if (!parsed.value.scope) {
    return undefined
  }

  if (props.hideCorePrefix && parsed.value.scope === 'stylelint')
    return undefined

  return parsed.value.scope
})

const scopeColorKey = computed(() => {
  if (!parsed.value.scope)
    return ''

  return parsed.value.scope === 'plugin' && props.prefix
    ? props.prefix
    : parsed.value.scope
})

const scopeColor = computed(() => getPluginColor(scopeColorKey.value))
</script>

<template>
  <component
    :is="as || 'div'"
    :title="props.name"
    class="colorized-rule-name"
    :class="[
      as === 'button' ? 'colorized-rule-name--button' : '',
      deprecated ? 'line-through' : '',
      borderless ? '' : 'badge',
      hoverReveal ? 'colorized-rule-name--hoverable' : '',
    ]"
  >
    <span
      v-if="displayScope"
      class="flex-none"
      :style="{ color: scopeColor }"
    >{{ displayScope }}</span>
    <span v-if="displayScope" class="flex-none" op30>/</span>
    <br v-if="displayScope && props.break">
    <span class="colorized-rule-name__name" op75>{{ parsed.name }}</span>
  </component>
</template>

<style scoped>
.colorized-rule-name {
  display: inline-flex;
  align-items: baseline;
  inline-size: 100%;
  max-inline-size: 100%;
  min-inline-size: 0;
  overflow: hidden;
  position: relative;
  white-space: nowrap;
}

.colorized-rule-name--button {
  appearance: none;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
}

.colorized-rule-name__name {
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.colorized-rule-name--hoverable:hover,
.colorized-rule-name--hoverable:focus-visible {
  inline-size: max-content;
  max-inline-size: min(72ch, calc(100vw - 8rem));
  overflow: visible;
  z-index: 20;
}

.colorized-rule-name--hoverable:hover .colorized-rule-name__name,
.colorized-rule-name--hoverable:focus-visible .colorized-rule-name__name {
  overflow: visible;
  text-overflow: clip;
}
</style>
