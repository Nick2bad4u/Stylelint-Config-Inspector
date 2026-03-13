<script setup lang="ts">
import { useRuntimeConfig } from '#app/nuxt'
import { errorInfo, init, isLoading } from '~/composables/payload'

import 'floating-vue/dist/style.css'
import './styles/global.css'
import './composables/dark'

const config = useRuntimeConfig()
init(config.app.baseURL)
</script>

<template>
  <div
    v-if="errorInfo"
    grid
    h-full
    w-full
    place-content-center
    whitespace-pre-line
    p4
  >
    <ConfigInspectorBadge mb6 text-xl font-200 />

    <div text-2xl text-red5 font-bold>
      Failed to resolve Stylelint config<br />
    </div>

    <div text-lg text-red font-mono>
      {{ errorInfo.error }}
    </div>

    <div mt6 op50>
      Note that
      <a
        href="https://stylelint.io/user-guide/configure"
        target="_blank"
        hover:underline
        >Stylelint configuration</a
      >
      must be discoverable for the selected target file.
    </div>
  </div>
  <div
    v-else-if="isLoading"
    flex="~ col"
    h-full
    w-full
    items-center
    justify-center
    p4
  >
    <div flex="~ gap-2 items-center" flex-auto animate-pulse text-xl>
      <div i-svg-spinners-90-ring-with-bg />
      Loading config...
    </div>
    <ConfigInspectorBadge mt6 text-xl font-200 :show-version="false" />
  </div>
  <div v-else px4 py6 lg:px14 lg:py10>
    <NavBar />
    <NuxtPage />
  </div>
</template>
