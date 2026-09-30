<script setup lang="ts">
import type { StatsTiming } from "~~/shared/stats";
import { computed } from "vue";
import { testIds } from "~~/shared/test-ids";
import { getPluginColor } from "~/composables/color";
import { payload } from "~/composables/payload";
import { statsPluginKey } from "~/composables/stats-presentation";

const props = defineProps<{ timing: StatsTiming }>();
const metadata = computed(() => payload.value.rules[props.timing.name]);
const barStyle = computed(() => ({
    width: `${Math.min(100, Math.max(0, props.timing.percentage))}%`,
    backgroundColor: getPluginColor(
        statsPluginKey(props.timing, metadata.value),
        0.45
    ),
}));
</script>

<template>
    <div :data-testid="testIds.stats.ruleRow" class="min-w-0 py3">
        <div flex="~ wrap items-center gap-2" class="min-w-0 text-sm">
            <a
                v-if="metadata?.docs?.url"
                :href="metadata.docs.url"
                target="_blank"
                rel="noopener noreferrer"
                class="min-w-0 flex-1 break-all font-mono hover:underline"
                >{{ timing.name }}</a
            >
            <span v-else class="min-w-0 flex-1 break-all font-mono">{{
                timing.name
            }}</span>
            <span class="whitespace-nowrap tabular-nums"
                >{{ timing.timeMs.toFixed(3) }} ms
                <span op60>({{ timing.percentage.toFixed(1) }}%)</span></span
            >
        </div>
        <div class="mt2 h2 overflow-hidden rounded bg-code" aria-hidden="true">
            <div class="h-full rounded" :style="barStyle" />
        </div>
        <p v-if="metadata?.docs?.description" class="mb0 mt1 text-xs op60">
            {{ metadata.docs.description }}
        </p>
    </div>
</template>
