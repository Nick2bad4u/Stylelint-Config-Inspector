<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { useId } from "vue";

defineProps<{
    label: string;
    options: readonly string[] | number[];
    titles?: string[];
    tooltips?: string[];
    classes?: string[];
    props?: HTMLAttributes[];
}>();

const value = defineModel<string | number>("modelValue", {
    type: [String, Number],
});
const groupName = useId();
</script>

<template>
    <fieldset flex="~ inline gap-1 wrap" of-hidden text-sm>
        <legend sr-only>{{ label }}</legend>
        <label
            v-for="(i, idx) of options"
            :key="i"
            border="~ base rounded-full"
            relative
            px2.5
            py0.5
            hover:bg-hover
            :class="[
                i === value ? 'bg-active' : 'saturate-0 hover:saturate-100',
                props?.[idx]?.class || '',
            ]"
            v-bind="props?.[idx]"
            :title="tooltips?.[idx] ?? titles?.[idx]"
        >
            <div
                :class="[
                    i === value ? '' : 'op50',
                    titles?.[idx] ? '' : 'capitalize',
                    classes?.[idx] || '',
                ]"
            >
                <slot :value="i" :title="titles?.[idx]" :index="idx">
                    {{ titles?.[idx] ?? i }}
                </slot>
            </div>
            <input
                v-model="value"
                type="radio"
                :value="i"
                :name="groupName"
                :aria-label="titles?.[idx] ?? String(i || 'All')"
                :title="tooltips?.[idx] ?? titles?.[idx]"
                absolute
                inset-0
                op-0.1
            />
        </label>
    </fieldset>
</template>
