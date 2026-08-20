<script setup lang="ts">
import type { RuleConfigState } from "~~/shared/types";
import { computed, ref, watch } from "vue";
import { useRouter } from "#app/composables/router";
import { deepCompareOptions } from "~/composables/options";
import { getRuleDefaultOptions, payload } from "~/composables/payload";
import { filtersConfigs } from "~/composables/state";
import { nth, stringifyOptions } from "~/composables/strings";

type RuleOptionsView = "state" | "default";

const props = withDefaults(
    defineProps<{
        state: RuleConfigState;
        isLocal?: boolean;
        variant?: "panel" | "popover";
    }>(),
    {
        variant: "panel",
    }
);

const colors = {
    error: "text-red",
    warn: "text-amber",
    off: "text-gray",
};

const config = computed(() => payload.value.configs[props.state.configIndex]!);

const defaultOptions = computed(() => getRuleDefaultOptions(props.state.name));

const comparedOptions = computed(() =>
    deepCompareOptions(props.state.options ?? [], defaultOptions.value)
);

const hasStateOptions = computed(
    () =>
        props.state.primaryOption !== undefined || !!props.state.options?.length
);
const hasDefaultOptions = computed(() => !!defaultOptions.value?.length);
const hasOptionTabs = computed(
    () => hasStateOptions.value && hasDefaultOptions.value
);

const initialRuleOptionsView = computed(() =>
    !hasStateOptions.value && defaultOptions.value?.length ? "default" : "state"
);

const ruleOptionsView = ref<RuleOptionsView>("state");

watch(
    initialRuleOptionsView,
    (view) => {
        ruleOptionsView.value = view;
    },
    { immediate: true }
);

const panelClass = computed(() => [
    "rule-state-panel",
    props.variant === "popover"
        ? "rule-state-panel--popover inspector-popover-panel"
        : "inspector-panel",
]);

const router = useRouter();
function goto() {
    filtersConfigs.rule = props.state.name;
    filtersConfigs.plugins = [];
    router.push("/configs");
}
</script>

<template>
    <div :class="panelClass" min-w="min(30rem,84vw)" p3 flex="~ col gap-3">
        <div flex="~ gap-2 items-center wrap">
            <RuleLevelIcon
                :level="state.level"
                :config-index="state.configIndex"
            />
            <span v-if="state.level === 'off'" ml1 op50>Turned </span>
            <span v-else ml1 op50>Set to </span>
            <span font-mono :class="colors[state.level]">{{
                state.level
            }}</span>
            <template v-if="!isLocal">
                <span op50>in</span>
                <button
                    type="button"
                    class="rule-state-config-button"
                    @click="goto()"
                >
                    <ColorizedConfigName
                        v-if="config.name"
                        :name="config.name"
                        font-mono
                    />
                    <span op50> the </span>
                    {{ nth(state.configIndex + 1) }}
                    <span op50> config item </span>
                </button>
            </template>
            <div v-else op50>in this config</div>
        </div>
        <div
            v-if="!isLocal"
            class="rule-state-scope inspector-popover-section"
            rounded-lg
            border="~ base"
            p2
            flex="~ gap-2"
        >
            <template v-if="config.files">
                <div i-ph-file-magnifying-glass-duotone my1 flex-none op75 />
                <div flex="~ col gap-2">
                    <div op50>Applies to files matching</div>
                    <div flex="~ gap-2 items-center wrap">
                        <GlobItem
                            v-for="(glob, idx) of config.files?.flat()"
                            :key="idx"
                            :glob="glob"
                        />
                    </div>
                </div>
            </template>
            <template v-else-if="config.rules">
                <div i-ph-files-duotone my1 flex-none op75 />
                <div op50>Applied generally for all files</div>
            </template>
        </div>
        <template v-if="hasStateOptions || defaultOptions?.length">
            <div items-center justify-between md:flex>
                <div flex="~ gap-1" op50>
                    <template v-if="hasOptionTabs">
                        <button
                            v-if="hasStateOptions"
                            type="button"
                            btn-action
                            :class="{
                                'btn-action-active':
                                    ruleOptionsView === 'state',
                            }"
                            @click="ruleOptionsView = 'state'"
                        >
                            <div i-ph-sliders-duotone my1 flex-none op75 />
                            Rule options
                        </button>
                        <button
                            v-if="hasDefaultOptions"
                            type="button"
                            btn-action
                            :class="{
                                'btn-action-active':
                                    ruleOptionsView === 'default',
                            }"
                            @click="ruleOptionsView = 'default'"
                        >
                            <div i-ph-faders-duotone my1 flex-none op75 />
                            Option defaults
                        </button>
                    </template>
                    <template v-else>
                        <div
                            v-if="hasStateOptions"
                            border="~ base rounded-full"
                            flex="~ gap-2 items-center"
                            bg-active
                            px2
                            py1
                            text-sm
                        >
                            <div i-ph-sliders-duotone my1 flex-none op75 />
                            Rule options
                        </div>
                        <div
                            v-else-if="hasDefaultOptions"
                            border="~ base rounded-full"
                            flex="~ gap-2 items-center"
                            bg-active
                            px2
                            py1
                            text-sm
                        >
                            <div i-ph-faders-duotone my1 flex-none op75 />
                            Option defaults
                        </div>
                    </template>
                </div>
            </div>
            <template v-if="ruleOptionsView === 'state'">
                <Shiki
                    v-if="state.primaryOption !== undefined"
                    lang="ts"
                    :code="`configuredPrimaryOption: ${stringifyOptions(state.primaryOption)}`"
                    rounded-lg
                    bg-code
                    p2
                    text-sm
                />
                <Shiki
                    v-for="(options, idx) of comparedOptions.options"
                    :key="idx"
                    lang="ts"
                    :code="stringifyOptions(options)"
                    rounded-lg
                    bg-code
                    p2
                    text-sm
                />
            </template>
            <template v-if="ruleOptionsView === 'default'">
                <div v-if="!hasStateOptions" op50>
                    No explicit options are configured in this state; showing
                    Stylelint defaults.
                </div>
                <Shiki
                    v-for="(options, idx) of defaultOptions"
                    :key="idx"
                    lang="ts"
                    :code="stringifyOptions(options)"
                    rounded-lg
                    bg-code
                    p2
                    text-sm
                />
            </template>
        </template>
        <template
            v-if="
                ruleOptionsView === 'state' &&
                comparedOptions.hasRedundantOptions
            "
        >
            <div op50>
                Options <span italic op75>italicized</span> match the default
                for the rule
            </div>
        </template>
    </div>
</template>

<style scoped>
.rule-state-panel--popover {
    box-shadow: none;
}

.rule-state-config-button {
    display: inline-flex;
    gap: 0.375rem;
    align-items: center;
    padding: 0.125rem 0.5rem;
    font-size: 0.875rem;
    color: inherit;
    background: rgb(124 58 237 / 0.07);
    border: 1px solid rgb(124 58 237 / 0.2);
    border-radius: 9999px;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        box-shadow 140ms ease;

    @media screen and (prefers-reduced-motion: reduce) {
        transition: none;
    }

    &:hover,
    &:focus-visible {
        background: rgb(124 58 237 / 0.12);
        border-color: rgb(124 58 237 / 0.36);
        box-shadow: 0 0 0 3px rgb(124 58 237 / 0.1);
    }

    html.dark & {
        background: rgb(124 58 237 / 0.14);
        border-color: rgb(167 139 250 / 0.22);

        &:hover,
        &:focus-visible {
            outline: 3px solid rgb(167 139 250 / 0.12);
            outline-offset: 0;
            background: rgb(124 58 237 / 0.2);
            border-color: rgb(167 139 250 / 0.38);
        }
    }
}

.rule-state-scope {
    border-color: rgb(124 58 237 / 0.14);
}
</style>
