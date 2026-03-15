<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  icon: string
  number: number
  color: string
  title: string
  clickable?: boolean
}>(), {
  clickable: false,
})

const emit = defineEmits<{
  click: []
}>()

const rootTag = computed(() => (props.clickable ? 'button' : 'div'))
</script>

<template>
  <component
    :is="rootTag"
    v-tooltip="`${props.number} ${props.title}`"
    flex="~ gap-2"
    :class="[
      props.number ? props.color : 'op25',
      props.clickable ? 'cursor-pointer transition hover:op100' : '',
    ]"
    @click="emit('click')"
  >
    <div :class="props.icon" />
    <span min-w-6 :class="props.color">{{ props.number || '' }}</span>
  </component>
</template>
