<script setup lang="ts">
import { useRouter } from '#app/composables/router'
import { useTimeAgo } from '@vueuse/core'
import { computed } from 'vue'
import { version } from '~~/package.json'
import { toggleDark } from '~/composables/dark'
import { isFetching, payload } from '~/composables/payload'
import { filtersRules as filters, stateStorage } from '~/composables/state'

const lastUpdate = useTimeAgo(() => payload.value.meta.lastUpdate)
const DEFAULT_TARGET_FILE = 'stylelint-inspector-target.css'
const showTargetFile = computed(() => {
  const target = payload.value.meta.targetFilePath
  if (!target)
    return false
  return !target.endsWith(DEFAULT_TARGET_FILE)
})

const rules = computed(() => Object.values(payload.value.rules))
const deprecatedUsing = computed(() =>
  rules.value.filter(
    rule =>
      rule.deprecated
      && payload.value.ruleToState.get(rule.name)?.some(i => i.level !== 'off'),
  ),
)

const router = useRouter()
function showDeprecated() {
  filters.status = 'deprecated'
  filters.plugins = []
  filters.state = 'using'
  filters.search = ''

  if (router.currentRoute.value.path !== '/rules')
    router.push('/rules')
}
</script>

<template>
  <div flex="~ col gap-3">
    <div flex="~ col gap-2 md:row md:items-start md:justify-between">
      <ConfigInspectorBadge text-3xl font-200 :show-version="false" />
      <div flex="~ col gap-1 items-start" md:items-end md:text-right>
        <a
          class="inline-block text-xs font-200 font-mono op55"
          :href="`https://github.com/Nick2bad4u/Stylelint-Config-Inspector/releases/tag/v${version}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          v{{ version }}
        </a>
        <div
          border="~ violet/20 rounded-full"
          inline-flex
          items-center
          gap-2
          bg-violet:8
          px3
          py1
          text-xs
          text-violet7
          dark:text-violet3
        >
          <img
            src="/stylelint/stylelint-icon-black.svg"
            h-4.5
            w-4.5
            dark:brightness-185
            dark:invert
          >
          <span>
            Built for the
            <a
              href="https://stylelint.io"
              target="_blank"
              rel="noopener noreferrer"
              hover:underline
            >Stylelint ecosystem</a>
            with best-effort metadata normalization.
          </span>
        </div>
      </div>
    </div>

    <div v-if="payload.meta.configPath" flex="~ gap-1 items-center" my1 text-sm>
      <span font-mono op35>{{ payload.meta.configPath }}</span>
    </div>
    <div v-if="showTargetFile" flex="~ gap-1 items-center" my1 text-sm>
      <span op50>Resolved using target file</span>
      <code font-mono op75>{{ payload.meta.targetFilePath }}</code>
    </div>
    <div flex="~ gap-1 items-center wrap" text-sm>
      <span op50>Composed with</span>
      <span font-bold>{{ payload.configs.length }}</span>
      <span op50>config items, updated</span>
      <span op75>{{ lastUpdate }}</span>
      <div
        v-if="isFetching"
        flex="~ gap-2 items-center"
        ml2
        animate-pulse
        text-green
      >
        <div i-svg-spinners-90-ring-with-bg flex-none text-sm />
        Fetching updates...
      </div>
    </div>
    <div flex="~ gap-3 items-center wrap" py4>
      <NuxtLink
        to="/configs"
        btn-action
        px3
        py1
        text-base
        active-class="btn-action-active"
      >
        <div i-ph-stack-duotone flex-none />
        Configs
      </NuxtLink>
      <NuxtLink
        to="/rules"
        btn-action
        px3
        py1
        text-base
        active-class="btn-action-active"
      >
        <div i-ph-list-dashes-duotone flex-none />
        Rules
      </NuxtLink>
      <NuxtLink
        to="/files"
        btn-action
        px3
        py1
        text-base
        active-class="btn-action-active"
      >
        <div i-ph-files-duotone flex-none />
        Files
        <span text-xs op60>(experimental)</span>
      </NuxtLink>
      <NuxtLink
        to="/dev"
        btn-action
        px3
        py1
        text-base
        active-class="btn-action-active"
      >
        <div i-ph-terminal-window-duotone flex-none />
        Dev
      </NuxtLink>
      <button
        :title="stateStorage.dimDisabledRules ? 'Disable dimming for disabled rules' : 'Enable dimming for disabled rules'"
        ml1
        text-xl
        op50
        hover:op75
        @click="stateStorage.dimDisabledRules = !stateStorage.dimDisabledRules"
      >
        <span
          :class="stateStorage.dimDisabledRules ? 'i-ph-eyes-closed-duotone' : 'i-ph-eye-duotone'"
        />
      </button>
      <button
        title="Toggle Dark Mode"
        i-ph-sun-dim-duotone
        dark:i-ph-moon-stars-duotone
        ml1
        text-xl
        op50
        hover:op75
        @click="toggleDark()"
      />
      <NuxtLink
        href="https://github.com/Nick2bad4u/Stylelint-Config-Inspector"
        target="_blank"
        i-carbon-logo-github
        text-lg
        op50
        hover:op75
      />
      <template v-if="deprecatedUsing.length">
        <div border="l base" ml3 mr2 h-5 w-1px />
        <button
          to="/configs"
          border="~ orange/20 rounded-full"
          flex="~ gap-2 items-center"
          bg-orange:5
          px3
          py1
          text-sm
          text-orange
          hover:bg-orange:10
          @click="showDeprecated"
        >
          <div i-ph-warning-duotone flex-none />
          Using {{ deprecatedUsing.length }} deprecated rules
        </button>
      </template>
    </div>
  </div>
</template>
