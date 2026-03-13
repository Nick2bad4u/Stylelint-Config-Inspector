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
  if (parts.length === 1) {
    if (props.prefix) {
      return {
        scope: props.prefix,
        name: parts[0].replace(LEADING_SLASHES_RE, ''),
      }
    }

    return {
      scope: undefined,
      name: parts[0],
    }
  }

  return {
    scope: parts[0],
    name: parts.slice(1).join('/'),
  }
})

const scopeColorKey = computed(() => {
  if (!parsed.value.scope) {
    return undefined
  }

  if (parsed.value.scope === 'plugin' && props.prefix) {
    return props.prefix
  }

  return parsed.value.scope
})
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
      :style="{ color: getPluginColor(scopeColorKey) }"
    >{{ parsed.scope }}</span>
    <span v-if="parsed.scope" op30>/</span>
    <br v-if="parsed.scope && props.break">
    <span op75>{{ parsed.name }}</span>
  </component>
</template>
