<script setup lang="ts">
import { debouncedWatch } from "@vueuse/core";
import Fuse from "fuse.js";
import { computed, ref, watch } from "vue";
import { isRuleConfigured, isRuleEnabled } from "~~/shared/rules";
import { getPluginColor } from "~/composables/color";
import { payload } from "~/composables/payload";
import {
    filtersRules as filters,
    isGridView,
    stateStorage,
} from "~/composables/state";

const rules = computed(() => Object.values(payload.value.rules));
const listColumns =
    "56px_minmax(14rem,clamp(14rem,38vw,30rem))_5.25rem_minmax(0,1fr)";
const pluginNames = computed<string[]>(() => {
    return [...new Set(rules.value.map((i) => i.plugin))].filter(
        (plugin): plugin is string =>
            typeof plugin === "string" && plugin.length > 0
    );
});

const pluginOptions = computed(() => {
    return pluginNames.value.map((plugin) => ({
        value: plugin,
        title: plugin,
        style: {
            color: getPluginColor(plugin),
            borderColor: getPluginColor(plugin, 0.55),
            backgroundColor: getPluginColor(plugin, 0.1),
        },
    }));
});

const selectedPlugins = computed({
    get: () => filters.plugins,
    set: (value: string[]) => {
        filters.plugins = [...new Set(value)].toSorted((left, right) =>
            left.localeCompare(right)
        );
    },
});

const hasSelectedPlugin = computed(() => selectedPlugins.value.length > 0);

const isPluginSelected = (pluginName: string): boolean =>
    selectedPlugins.value.includes(pluginName);

function togglePluginSelection(pluginName: string): void {
    const nextSelection = new Set(selectedPlugins.value);

    if (nextSelection.has(pluginName)) nextSelection.delete(pluginName);
    else nextSelection.add(pluginName);

    selectedPlugins.value = [...nextSelection];
}

function clearPluginSelection(): void {
    selectedPlugins.value = [];
}
const hasGeneratedDescriptions = computed(() =>
    rules.value.some(
        (rule) =>
            rule.docs?.descriptionSource === "generated" ||
            !!rule.docs?.descriptionMissing
    )
);
const descriptionsNoticeText =
    "Descriptions are best-effort: Stylelint and many plugins do not ship consistent rule description metadata. Chat icon = message-derived, asterisk = generated fallback.";

function hasAnyRuleState(ruleName: string): boolean {
    return (payload.value.ruleToState.get(ruleName)?.length ?? 0) > 0;
}

function isConfiguredRule(ruleName: string): boolean {
    return isRuleConfigured(payload.value.ruleToState.get(ruleName));
}

function hasEnabledRuleState(ruleName: string): boolean {
    return isRuleEnabled(payload.value.ruleToState.get(ruleName));
}

function getRuleRowClass(ruleName: string): string {
    if (!stateStorage.dimDisabledRules) return "";

    if (!hasAnyRuleState(ruleName) && filters.state !== "unused") return "op42";

    if (hasAnyRuleState(ruleName) && !hasEnabledRuleState(ruleName))
        return "rule-muted-off";

    return "";
}

const usingRulesCount = computed(
    () => rules.value.filter((rule) => isConfiguredRule(rule.name)).length
);
const unusedRulesCount = computed(
    () => rules.value.filter((rule) => !isConfiguredRule(rule.name)).length
);
const recommendedRulesCount = computed(
    () => rules.value.filter((rule) => !!rule.docs?.recommended).length
);

const conditionalFiltered = computed(() => {
    let conditional = rules.value;

    if (hasSelectedPlugin.value) {
        conditional = conditional.filter((rule) => {
            const [scope, remainder] = rule.name.split("/");
            const scopeCandidate = remainder ? (scope ?? "") : "";
            const pluginCandidate =
                typeof rule.plugin === "string" ? rule.plugin : "";
            const candidates = new Set<string>(
                [pluginCandidate, scopeCandidate].filter(Boolean)
            );

            return selectedPlugins.value.some((selectedPlugin) =>
                candidates.has(selectedPlugin)
            );
        });
    }

    if (filters.fixable != null) {
        conditional = conditional.filter(
            (rule) => !!rule.fixable === filters.fixable
        );
    }

    switch (filters.state) {
        case "using":
            conditional = conditional.filter((rule) =>
                isConfiguredRule(rule.name)
            );
            break;
        case "unused":
            conditional = conditional.filter(
                (rule) => !isConfiguredRule(rule.name)
            );
            break;
        case "overloads":
            conditional = conditional.filter(
                (rule) =>
                    (payload.value.ruleToState.get(rule.name)?.length || 0) > 1
            );
            break;
        case "error":
            conditional = conditional.filter((rule) =>
                payload.value.ruleToState
                    .get(rule.name)
                    ?.some((i) => i.level === "error")
            );
            break;
        case "warn":
            conditional = conditional.filter((rule) =>
                payload.value.ruleToState
                    .get(rule.name)
                    ?.some((i) => i.level === "warn")
            );
            break;
        case "off":
            conditional = conditional.filter((rule) =>
                payload.value.ruleToState
                    .get(rule.name)
                    ?.some((i) => i.level === "off")
            );
            break;
        case "off-only":
            conditional = conditional.filter((rule) => {
                const states = payload.value.ruleToState.get(rule.name);
                if (!states?.length) return false;
                return states.every((i) => i.level === "off");
            });
            break;
    }

    switch (filters.status) {
        case "active":
            conditional = conditional.filter((rule) =>
                hasEnabledRuleState(rule.name)
            );
            break;
        case "recommended":
            conditional = conditional.filter((rule) => rule.docs?.recommended);
            break;
        case "fixable":
            conditional = conditional.filter((rule) => rule.fixable);
            break;
        case "deprecated":
            conditional = conditional.filter((rule) => rule.deprecated);
            break;
    }

    return conditional;
});

const fuse = computed(
    () =>
        new Fuse(conditionalFiltered.value, {
            keys: ["name", "docs.description"],
            threshold: 0.5,
        })
);

const filtered = ref(conditionalFiltered.value);

if (
    !filters.search &&
    !hasSelectedPlugin.value &&
    filters.state === "using" &&
    filters.status === "active"
) {
    filters.status = "";
}

watch(
    () => filters.status,
    (status) => {
        if (status === "recommended" && filters.state === "using")
            filters.state = "";
    }
);

watch(
    () => filters.state,
    (state) => {
        if (state === "unused" && filters.status === "active")
            filters.status = "";
    }
);

debouncedWatch(
    () => [filters.search, conditionalFiltered.value],
    () => {
        if (!filters.search)
            return (filtered.value = conditionalFiltered.value);
        filtered.value = fuse.value.search(filters.search).map((i) => i.item);
    },
    { debounce: 200 }
);
const isDefaultFilters = computed(
    () =>
        !(
            filters.search ||
            hasSelectedPlugin.value ||
            filters.state !== "using" ||
            filters.status
        )
);

function resetFilters() {
    filters.search = "";
    clearPluginSelection();
    filters.state = "using";
    filters.status = "";
}

function setRulesViewMode(mode: "list" | "grid"): void {
    isGridView.value = mode === "grid";
}
</script>

<template>
    <div>
        <div py4 flex="~ col gap-2">
            <div relative flex>
                <input
                    v-model="filters.search"
                    :class="filters.search ? 'font-mono' : ''"
                    placeholder="Search rules..."
                    border="~ base rounded-full"
                    w-full
                    bg-transparent
                    px3
                    py2
                    pl10
                    outline-none
                />
                <div
                    absolute
                    bottom-0
                    left-0
                    top-0
                    flex="~ items-center justify-center"
                    p4
                    op50
                >
                    <div i-ph-magnifying-glass-duotone />
                </div>
            </div>
            <div grid="~ cols-[max-content_1fr] gap-2" my2 items-center>
                <div text-right text-sm op50>Plugins</div>
                <div class="space-y-2">
                    <div
                        class="text-xs text-zinc-600 font-semibold tracking-wide uppercase dark:text-zinc-300/85"
                    >
                        Plugin
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="plugin-filter-button badge border border-base px-2 py-0.5 text-xs transition"
                            :class="[
                                !hasSelectedPlugin
                                    ? 'bg-violet-100 text-violet-800 dark:bg-zinc-700/45 dark:text-zinc-100'
                                    : 'bg-white/65 text-zinc-700 hover:bg-black/6 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
                            ]"
                            @click="clearPluginSelection"
                        >
                            All plugins
                        </button>

                        <button
                            v-for="pluginOption in pluginOptions"
                            :key="pluginOption.value"
                            type="button"
                            class="plugin-filter-button badge border border-base px-2 py-0.5 text-xs transition"
                            :class="[
                                isPluginSelected(pluginOption.value)
                                    ? 'bg-violet-100 text-violet-800 opacity-100 dark:bg-zinc-700/45 dark:text-zinc-100'
                                    : hasSelectedPlugin
                                      ? 'bg-white/65 text-zinc-700 opacity-55 hover:opacity-85 dark:bg-zinc-900/30 dark:text-zinc-300 dark:opacity-45 dark:hover:opacity-80'
                                      : 'bg-white/65 text-zinc-700 hover:bg-black/6 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
                            ]"
                            :style="pluginOption.style"
                            @click="togglePluginSelection(pluginOption.value)"
                        >
                            {{ pluginOption.title }}
                        </button>
                    </div>
                </div>
                <div text-right text-sm op50>State</div>
                <OptionSelectGroup
                    v-model="filters.state"
                    :options="[
                        '',
                        'using',
                        'unused',
                        'error',
                        'warn',
                        'off',
                        'overloads',
                        'off-only',
                    ]"
                    :titles="[
                        'All',
                        'Using',
                        'Unused',
                        'Error',
                        'Warn',
                        'Off',
                        'Overloaded',
                        'Off Only',
                    ]"
                    :tooltips="[
                        'Show every rule',
                        'Rules currently active in at least one config block',
                        'Rules currently disabled in all config blocks',
                        'Rules with effective error severity',
                        'Rules with effective warning severity',
                        'Rules set to off',
                        'Rules with mixed state across overrides',
                        'Rules explicitly off and never active',
                    ]"
                >
                    <template #default="{ value, title }">
                        <div class="flex items-center">
                            <div ml--1 mr-1 flex items-center>
                                <RuleLevelIcon
                                    v-if="
                                        value === 'error' ||
                                        value === 'overloads'
                                    "
                                    level="error"
                                />
                                <RuleLevelIcon
                                    v-if="
                                        value === 'warn' ||
                                        value === 'overloads'
                                    "
                                    level="warn"
                                />
                                <RuleLevelIcon
                                    v-if="
                                        value === 'off' ||
                                        value === 'off-only' ||
                                        value === 'overloads'
                                    "
                                    level="off"
                                />
                            </div>
                            {{ title || value }}
                        </div>
                    </template>
                </OptionSelectGroup>
                <div text-right text-sm op50>Status</div>
                <OptionSelectGroup
                    v-model="filters.status"
                    :options="[
                        '',
                        'active',
                        'recommended',
                        'fixable',
                        'deprecated',
                    ]"
                    :titles="[
                        'All',
                        'Active',
                        'Recommended',
                        'Fixable',
                        'Deprecated',
                    ]"
                    :tooltips="[
                        'Show every rule status',
                        'Rules that are enabled in at least one matched config item',
                        'Rules recommended by Stylelint or plugin metadata',
                        'Rules that support automatic fixes',
                        'Rules marked as deprecated by upstream metadata',
                    ]"
                >
                    <template #default="{ value, title }">
                        <div flex items-center gap-1>
                            <div
                                v-if="value === 'recommended'"
                                i-ph-check-square-duotone
                                ml--0.5
                                text-green
                            />
                            <div
                                v-if="value === 'fixable'"
                                i-ph-wrench-duotone
                                ml--0.5
                                text-amber
                            />
                            <div
                                v-if="value === 'deprecated'"
                                i-ph-prohibit-inset-duotone
                                ml--1
                                text-gray
                            />
                            {{ title || value }}
                        </div>
                    </template>
                </OptionSelectGroup>
            </div>
        </div>

        <div items-center justify-between gap-2 md:flex>
            <div flex="~ gap-2" lt-sm:flex-col>
                <div
                    flex="~ inline gap-2 items-center"
                    border="~ gray/20 rounded-full"
                    bg-gray:10
                    px3
                    py1
                >
                    <div i-ph-list-checks-duotone />
                    <span>{{ filtered.length }}</span>
                    <span op75
                        >rules
                        {{ isDefaultFilters ? "in use" : "filtered" }}</span
                    >
                    <span text-sm op50>out of {{ rules.length }} rules</span>
                </div>
                <div
                    flex="~ inline gap-2 items-center"
                    border="~ gray/20 rounded-full"
                    bg-gray:5
                    px3
                    py1
                    text-sm
                >
                    <span op70>Using</span>
                    <span font-mono>{{ usingRulesCount }}</span>
                    <span op40>•</span>
                    <span op70>Unused</span>
                    <span font-mono>{{ unusedRulesCount }}</span>
                    <span op40>•</span>
                    <span op70>Recommended</span>
                    <span font-mono>{{ recommendedRulesCount }}</span>
                    <div
                        v-if="hasGeneratedDescriptions"
                        v-tooltip="descriptionsNoticeText"
                        i-ph-info-duotone
                        text-violet5
                        op70
                    />
                </div>
                <button
                    v-if="!isDefaultFilters"
                    flex="~ inline gap-2 items-center self-start"
                    border="~ purple/20 rounded-full"
                    bg-purple:10
                    px3
                    py1
                    @click="resetFilters()"
                >
                    <div i-ph-funnel-duotone text-purple />
                    <span op50>Clear Filter</span>
                    <div i-ph-x ml--1 text-sm op25 hover:op100 />
                </button>
            </div>

            <div flex="~ gap-1">
                <button
                    btn-action
                    :class="{
                        'btn-action-active': !isGridView,
                    }"
                    @click="setRulesViewMode('list')"
                >
                    <div i-ph-list-duotone />
                    List
                </button>
                <button
                    btn-action
                    :class="{
                        'btn-action-active': isGridView,
                    }"
                    @click="setRulesViewMode('grid')"
                >
                    <div i-ph-grid-four-duotone />
                    Grid
                </button>
            </div>
        </div>
        <RuleList
            my4
            :grid-view="isGridView"
            :rules="filtered"
            :list-columns="listColumns"
            :dim-disabled="stateStorage.dimDisabledRules"
            :get-bind="(name: string) => ({ class: getRuleRowClass(name) })"
        />
    </div>
</template>
