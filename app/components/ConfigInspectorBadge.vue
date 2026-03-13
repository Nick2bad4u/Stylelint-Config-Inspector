<script setup lang="ts">
import { version } from '~~/package.json'

withDefaults(
  defineProps<{
    showVersion?: boolean
  }>(),
  {
    showVersion: true,
  },
)
</script>

<template>
  <div class="flex flex-col gap-1">
    <a
      href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-3 border border-violet/25 rounded-2xl bg-violet/8 px-3 py-2 shadow-sm hover:border-violet/35 hover:bg-violet/12"
    >
      <span
        class="flex items-center justify-center border border-violet/30 rounded-full bg-violet/16 p-2"
      >
        <img
          src="/stylelint/stylelint-icon-black.svg"
          class="inline-block h-1.15em w-1.15em dark:brightness-185 dark:invert"
        >
      </span>

      <span class="flex flex-col gap-0.5">
        <span class="flex items-center gap-2">
          <img
            src="/stylelint/stylelint-text-black.svg"
            class="h-0.95em dark:brightness-185 dark:invert"
          >
          <span class="text-xs font-medium op70">Config Inspector</span>
        </span>
        <span class="text-xs font-medium op70"> Rule + config explorer </span>
      </span>
    </a>
    <a
      v-if="showVersion"
      class="ml-2 inline-block text-0.6em font-200 font-mono op55"
      :href="`https://github.com/Nick2bad4u/Stylelint-Config-Inspector/releases/tag/v${version}`"
      target="_blank"
      rel="noopener noreferrer"
    >
      v{{ version }}
    </a>
  </div>
</template>
