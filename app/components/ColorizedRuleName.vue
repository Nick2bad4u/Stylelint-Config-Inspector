<script setup lang="ts">
import { computed } from 'vue'
import { getPluginColor } from '~/composables/color'

const props = defineProps<{
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
}>()

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

  if (parsed.value.scope === 'plugin' && props.prefix) {
    return props.prefix
  }

  return parsed.value.scope
})

const scopeColor = computed(() => getPluginColor(displayScope.value ?? ''))
</script>

<template>
  <component
    :is="as || 'div'"
    :title="props.name"
    of-hidden
    text-ellipsis
    ws-nowrap
    font-mono
    :class="[deprecated ? 'line-through' : '', borderless ? '' : 'badge']"
  >
    <span
      v-if="parsed.scope"
      :style="{ color: scopeColor }"
    >{{ displayScope }}</span>
    <span v-if="parsed.scope" op30>/</span>
    <br v-if="parsed.scope && props.break">
    <span op75>{{ parsed.name }}</span>
  </component>
</template>
