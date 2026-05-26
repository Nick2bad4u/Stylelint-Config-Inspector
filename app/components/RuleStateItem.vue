<script setup lang="ts">
import type { RuleConfigState } from "~~/shared/types";
import { computed, reactive } from "vue";
import { useRouter } from "#app/composables/router";
import { deepCompareOptions } from "~/composables/options";
import { getRuleDefaultOptions, payload } from "~/composables/payload";
import { filtersConfigs } from "~/composables/state";
import { nth, stringifyOptions } from "~/composables/strings";

const props = defineProps<{
    state: RuleConfigState;
    isLocal?: boolean;
}>();

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

const ruleOptions = reactive({
    viewType: initialRuleOptionsView.value as "state" | "default",
});

const router = useRouter();
function goto() {
    filtersConfigs.rule = props.state.name;
    filtersConfigs.plugins = [];
    router.push("/configs");
}
</script>

<template>
    <div min-w="min(30rem,84vw)" p3 flex="~ col gap-3">
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
                    class="inline-flex items-center gap-1.5 border border-base rounded-full bg-black/4 px2 py0.5 text-sm text-inherit transition dark:bg-white/5 hover:bg-black/8 dark:hover:bg-white/10"
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
            rounded-lg
            border="~ base"
            bg-black:3
            p2
            flex="~ gap-2"
            dark:bg-white:4
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
                            btn-action
                            :class="{
                                'btn-action-active':
                                    ruleOptions.viewType === 'state',
                            }"
                            @click="ruleOptions.viewType = 'state'"
                        >
                            <div i-ph-sliders-duotone my1 flex-none op75 />
                            Rule options
                        </button>
                        <button
                            v-if="hasDefaultOptions"
                            btn-action
                            :class="{
                                'btn-action-active':
                                    ruleOptions.viewType === 'default',
                            }"
                            @click="ruleOptions.viewType = 'default'"
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
            <template v-if="ruleOptions.viewType === 'state'">
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
            <template v-if="ruleOptions.viewType === 'default'">
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
                ruleOptions.viewType === 'state' &&
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
