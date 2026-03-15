<script setup lang="ts">
import { computed } from 'vue'
import { payload } from '~/composables/payload'
import { stateStorage } from '~/composables/state'

const rules = computed(() => Object.values(payload.value.rules))
const diagnostics = computed(() => payload.value.diagnostics ?? [])
const configs = computed(() => payload.value.configs)
const filesResolved = computed(() => payload.value.filesResolved)

const configSummary = computed(() => {
  const items = configs.value
  return {
    total: items.length,
    general: payload.value.configsGeneral.length,
    ignoreOnly: payload.value.configsIgnoreOnly.length,
    overrides: items.filter(config => config.name?.startsWith('stylelint/override-')).length,
    root: items.filter(config => config.name === 'stylelint/root').length,
    withExtends: items.filter(config => !!config.extends?.length).length,
    withPlugins: items.filter(config => Object.keys(config.plugins ?? {}).length > 0).length,
  }
})

const workspaceSummary = computed(() => {
  const files = filesResolved.value
  return {
    matchedFiles: files?.list.length ?? 0,
    groups: files?.groups.length ?? 0,
    globs: files?.globToFiles.size ?? 0,
    configsWithFiles: files?.configToFiles.size ?? 0,
  }
})

const viewerSummary = computed(() => ({
  theme: stateStorage.theme,
  fontScale: stateStorage.fontScale,
  dimDisabledRules: stateStorage.dimDisabledRules,
  viewType: stateStorage.viewType,
  viewFilesTab: stateStorage.viewFilesTab,
  viewFileMatchType: stateStorage.viewFileMatchType,
  configFilepathFilter: stateStorage.filtersConfigs.filepath,
  configRuleFilter: stateStorage.filtersConfigs.rule,
  rulesPluginFilters: stateStorage.filtersRules.plugins,
}))

const metadataHealth = computed(() => {
  const allRules = rules.value
  const total = allRules.length
  const generatedDescriptions = allRules.filter(
    rule =>
      rule.docs?.descriptionSource === 'generated'
      || rule.docs?.descriptionMissing,
  ).length
  const messageDescriptions = allRules.filter(
    rule => rule.docs?.descriptionSource === 'message',
  ).length
  const missingDocsUrls = allRules.filter(rule => !rule.docs?.url).length
  const inferredDocsUrls = allRules.filter(
    rule => rule.docs?.urlSource === 'inferred',
  ).length
  const placeholderDescriptions = allRules.filter(rule =>
    rule.docs?.description?.includes('<value>'),
  ).length

  const toPct = (count: number) =>
    total ? Math.round((count / total) * 1000) / 10 : 0

  return {
    generatedDescriptions,
    generatedDescriptionsPct: toPct(generatedDescriptions),
    messageDescriptions,
    messageDescriptionsPct: toPct(messageDescriptions),
    missingDocsUrls,
    missingDocsUrlsPct: toPct(missingDocsUrls),
    inferredDocsUrls,
    placeholderDescriptions,
    placeholderDescriptionsPct: toPct(placeholderDescriptions),
  }
})
</script>

<template>
  <div py4 flex="~ col gap-4">
    <section border="~ sky/20 rounded-xl" bg-sky:6 p4>
      <div flex="~ items-center gap-2 wrap" text-sky8 dark:text-sky3>
        <div i-ph-chart-bar-horizontal-duotone flex-none />
        <span font-medium>Inspector snapshot</span>
      </div>
      <div mt3 grid="~ cols-1 gap-3 md:cols-2 xl:cols-3">
        <div border="~ base rounded-lg" bg-black:8 p3 text-sm leading-7 dark:bg-white:4>
          <div font-mono>
            Config path: {{ payload.meta.configPath || 'not resolved' }}
          </div>
          <div font-mono>
            Target file: {{ payload.meta.targetFilePath || 'default synthetic target' }}
          </div>
          <div font-mono>
            Engine: {{ payload.meta.engine || 'unknown' }}
          </div>
          <div font-mono>
            Last update: {{ new Date(payload.meta.lastUpdate).toLocaleString() }}
          </div>
        </div>
        <div border="~ base rounded-lg" bg-black:8 p3 text-sm leading-7 dark:bg-white:4>
          <div>Total rules: {{ rules.length }}</div>
          <div>Total config items: {{ configSummary.total }}</div>
          <div>General configs: {{ configSummary.general }}</div>
          <div>Ignore-only configs: {{ configSummary.ignoreOnly }}</div>
          <div>Override configs: {{ configSummary.overrides }}</div>
        </div>
        <div border="~ base rounded-lg" bg-black:8 p3 text-sm leading-7 dark:bg-white:4>
          <div>Matched files: {{ workspaceSummary.matchedFiles }}</div>
          <div>Files groups: {{ workspaceSummary.groups }}</div>
          <div>Tracked globs: {{ workspaceSummary.globs }}</div>
          <div>Configs with files: {{ workspaceSummary.configsWithFiles }}</div>
          <div>Diagnostics: {{ diagnostics.length }}</div>
        </div>
      </div>
    </section>

    <section border="~ purple/20 rounded-xl" bg-purple:6 p4>
      <div flex="~ items-center gap-2 wrap" text-violet8 dark:text-violet3>
        <div i-ph-flask-duotone flex-none />
        <span font-medium>Metadata health</span>
      </div>
      <div mt1 text-sm op70>
        (quality depends heavily on upstream Stylelint/plugin metadata)
      </div>

      <div
        border="~ purple/20"
        mt3
        rounded-lg
        bg-black:10
        p3
        text-sm
        leading-7
        font-mono
      >
        <div>
          Generated descriptions:
          {{ metadataHealth.generatedDescriptions }} ({{
            metadataHealth.generatedDescriptionsPct
          }}%)
        </div>
        <div>
          Message-derived descriptions:
          {{ metadataHealth.messageDescriptions }} ({{
            metadataHealth.messageDescriptionsPct
          }}%)
        </div>
        <div>
          Missing docs URLs: {{ metadataHealth.missingDocsUrls }} ({{
            metadataHealth.missingDocsUrlsPct
          }}%)
        </div>
        <div>Inferred docs URLs: {{ metadataHealth.inferredDocsUrls }}</div>
        <div>
          Placeholder descriptions:
          {{ metadataHealth.placeholderDescriptions }} ({{
            metadataHealth.placeholderDescriptionsPct
          }}%)
        </div>
      </div>
    </section>

    <section border="~ amber/25 rounded-xl" bg-amber:6 p4>
      <div flex="~ gap-2 items-center" text-amber7 dark:text-amber3>
        <div i-ph-warning-circle-duotone flex-none />
        <span font-medium>Inspector diagnostics ({{ diagnostics.length }})</span>
      </div>
      <div v-if="diagnostics.length" mt2>
        <ul ml5 list-disc text-amber7 op90 dark:text-amber3>
          <li v-for="(note, idx) of diagnostics" :key="idx">
            {{ note }}
          </li>
        </ul>
      </div>
      <div v-else mt2 text-sm op70>
        No diagnostics emitted.
      </div>
    </section>

    <section border="~ emerald/20 rounded-xl" bg-emerald:6 p4>
      <div flex="~ gap-2 items-center" text-emerald7 dark:text-emerald3>
        <div i-ph-sliders-horizontal-duotone flex-none />
        <span font-medium>Viewer state</span>
      </div>
      <div border="~ emerald/20" mt3 rounded-lg bg-black:8 p3 text-sm leading-7 font-mono dark:bg-white:4>
        <div>Theme: {{ viewerSummary.theme }}</div>
        <div>Font scale: {{ viewerSummary.fontScale }}</div>
        <div>Rule view: {{ viewerSummary.viewType }}</div>
        <div>Files tab mode: {{ viewerSummary.viewFilesTab }}</div>
        <div>File match view: {{ viewerSummary.viewFileMatchType }}</div>
        <div>Config filepath filter: {{ viewerSummary.configFilepathFilter || '∅' }}</div>
        <div>Config rule filter: {{ viewerSummary.configRuleFilter || '∅' }}</div>
        <div>Config plugin filters: local to each config card</div>
        <div>Rules plugin filters: {{ viewerSummary.rulesPluginFilters.length ? viewerSummary.rulesPluginFilters.join(', ') : '∅' }}</div>
        <div>Dim disabled rules: {{ viewerSummary.dimDisabledRules ? 'on' : 'off' }}</div>
      </div>
    </section>

    <section border="~ violet/20 rounded-xl" bg-violet:6 p4>
      <div flex="~ gap-2 items-center" text-violet8 dark:text-violet3>
        <div i-ph-stack-duotone flex-none />
        <span font-medium>Config composition summary</span>
      </div>
      <div border="~ violet/20" mt3 rounded-lg bg-black:8 p3 text-sm leading-7 font-mono dark:bg-white:4>
        <div>Root entries: {{ configSummary.root }}</div>
        <div>Configs with extends: {{ configSummary.withExtends }}</div>
        <div>Configs with plugins: {{ configSummary.withPlugins }}</div>
        <div>General config items: {{ configSummary.general }}</div>
        <div>Ignore-only config items: {{ configSummary.ignoreOnly }}</div>
      </div>
    </section>
  </div>
</template>
