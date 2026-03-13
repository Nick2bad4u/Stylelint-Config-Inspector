<script setup lang="ts">
import { computed } from 'vue'
import { payload } from '~/composables/payload'

const rules = computed(() => Object.values(payload.value.rules))
const diagnostics = computed(() => payload.value.diagnostics ?? [])

const metadataHealth = computed(() => {
  const allRules = rules.value
  const total = allRules.length
  const generatedDescriptions = allRules.filter(rule => rule.docs?.descriptionSource === 'generated' || rule.docs?.descriptionMissing).length
  const messageDescriptions = allRules.filter(rule => rule.docs?.descriptionSource === 'message').length
  const missingDocsUrls = allRules.filter(rule => !rule.docs?.url).length
  const inferredDocsUrls = allRules.filter(rule => rule.docs?.urlSource === 'inferred').length
  const placeholderDescriptions = allRules.filter(rule => rule.docs?.description?.includes('<value>')).length

  const toPct = (count: number) => total ? Math.round((count / total) * 1000) / 10 : 0

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
    <section border="~ purple/20 rounded-xl" bg-purple:6 p4>
      <div flex="~ items-center gap-2 wrap" text-violet8 dark:text-violet3>
        <div i-ph-flask-duotone flex-none />
        <span font-medium>Metadata health</span>
      </div>
      <div mt1 text-sm op70>
        (quality depends heavily on upstream Stylelint/plugin metadata)
      </div>

      <div border="~ purple/20" mt3 rounded-lg bg-black:10 p3 text-sm leading-7 font-mono>
        <div>
          Generated descriptions: {{ metadataHealth.generatedDescriptions }} ({{ metadataHealth.generatedDescriptionsPct }}%)
        </div>
        <div>
          Message-derived descriptions: {{ metadataHealth.messageDescriptions }} ({{ metadataHealth.messageDescriptionsPct }}%)
        </div>
        <div>
          Missing docs URLs: {{ metadataHealth.missingDocsUrls }} ({{ metadataHealth.missingDocsUrlsPct }}%)
        </div>
        <div>
          Inferred docs URLs: {{ metadataHealth.inferredDocsUrls }}
        </div>
        <div>
          Placeholder descriptions: {{ metadataHealth.placeholderDescriptions }} ({{ metadataHealth.placeholderDescriptionsPct }}%)
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
  </div>
</template>
