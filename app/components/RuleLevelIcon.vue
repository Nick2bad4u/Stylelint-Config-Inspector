<script setup lang="ts">
import type { RuleLevel } from "~~/shared/types";
import { computed } from "vue";
import { nth } from "~/composables/strings";

const props = defineProps<{
    level: RuleLevel;
    hasOptions?: boolean;
    hasRedundantOptions?: boolean;
    configIndex?: number;
    showConfigIndex?: boolean;
    class?: string;
}>();

const shouldShowConfigIndex = computed(
    () => props.showConfigIndex && props.configIndex != null
);

const title = computed(() => {
    if (props.configIndex == null) return `Set to '${props.level}'`;
    return `Set to '${props.level}' in the ${nth(props.configIndex + 1)} config item`;
});

const color = computed(
    () =>
        ({
            error: "text-red op80",
            warn: "text-yellow5 op80 dark:text-yellow4",
            off: "text-gray op62",
        })[props.level]
);

const icon = computed(
    () =>
        ({
            error: "i-ph-warning-circle-duotone",
            warn: "i-ph-warning-duotone",
            off: "i-ph-circle-half-tilt-duotone",
        })[props.level]
);
</script>

<template>
    <span
        relative
        inline-flex
        items-center
        justify-center
        gap-1
        leading-none
        :class="[
            color,
            shouldShowConfigIndex
                ? 'min-w-11 border border-current/28 rounded-full bg-white/80 px-1.5 py-0.75 text-xs shadow-sm dark:bg-zinc-950/80'
                : '',
            props.class,
        ]"
        data-testid="rule-level-icon"
        :title="title"
        :aria-label="title"
    >
        <div :class="icon" :text="shouldShowConfigIndex ? 'sm' : undefined" />
        <span
            v-if="shouldShowConfigIndex"
            class="leading-none font-mono tabular-nums op90"
        >
            #{{ configIndex! + 1 }}
        </span>
        <div
            v-if="hasOptions"
            absolute
            right--2px
            top--2px
            h-6px
            w-6px
            rounded-full
            bg-current
            op75
            :class="hasRedundantOptions ? 'text-blue5' : ''"
        />
    </span>
</template>
