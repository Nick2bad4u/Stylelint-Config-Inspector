<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { testIds } from "~~/shared/test-ids";
import { getRuleFromName, payload } from "~/composables/payload";

const extendsEntries = computed(() => payload.value.extendsInfo ?? []);
const selectedSpecifier = ref("");
const extendsSearch = ref("");
const filteredExtendsEntries = computed(() => {
    const search = extendsSearch.value.trim().toLowerCase();
    if (!search) return extendsEntries.value;

    return extendsEntries.value.filter((entry) =>
        [
            entry.specifier,
            entry.packageName,
            entry.description,
            entry.source,
            entry.customSyntax,
            ...(entry.plugins ?? []),
        ]
            .filter((value): value is string => typeof value === "string")
            .some((value) => value.toLowerCase().includes(search))
    );
});

watchEffect(() => {
    if (!filteredExtendsEntries.value.length) {
        selectedSpecifier.value = "";
        return;
    }

    const hasSelectedEntry = filteredExtendsEntries.value.some(
        (entry) => entry.specifier === selectedSpecifier.value
    );

    if (!hasSelectedEntry)
        selectedSpecifier.value =
            filteredExtendsEntries.value[0]?.specifier ?? "";
});

const activeEntry = computed(() => {
    return extendsEntries.value.find(
        (entry) => entry.specifier === selectedSpecifier.value
    );
});

const usedByConfigs = computed(() => {
    const entry = activeEntry.value;
    if (!entry) return [];

    return entry.usedByConfigIndexes
        .map((index) => payload.value.configs[index])
        .filter((config): config is NonNullable<typeof config> => !!config);
});

const activeRules = computed(() => {
    const rules = activeEntry.value?.rules ?? [];
    return rules.map((ruleName) => getRuleFromName(ruleName));
});
</script>

<template>
    <div flex="~ col gap-4" my4>
        <div
            class="inspector-experimental-pill"
            flex="~ inline gap-2 items-center"
        >
            <div i-ph-flask-duotone flex-none />
            <span
                >This view is experimental and based on best-effort
                package/config loading.</span
            >
        </div>

        <template v-if="extendsEntries.length">
            <div flex="~ col gap-2 md:row md:items-center">
                <div
                    class="inspector-summary-pill"
                    flex="~ inline gap-2 items-center"
                    border="~ base rounded-full"
                    w-fit
                    bg-black:4
                    px3
                    py1
                    text-sm
                    dark:bg-white:3
                >
                    <div i-ph-stack-plus-duotone />
                    <span font-mono>{{ filteredExtendsEntries.length }}</span>
                    <span op70
                        >of {{ extendsEntries.length }} extends entries</span
                    >
                </div>
                <div relative flex flex-auto>
                    <input
                        v-model="extendsSearch"
                        placeholder="Search extended configs..."
                        aria-label="Search extended configs"
                        class="inspector-input"
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
            </div>
            <div flex="~ wrap gap-2 items-center">
                <button
                    v-for="entry in filteredExtendsEntries"
                    :key="entry.specifier"
                    type="button"
                    :data-testid="testIds.extends.specifierButton"
                    border="~ base rounded-full"
                    px3
                    py1
                    text-left
                    font-mono
                    transition
                    :aria-pressed="selectedSpecifier === entry.specifier"
                    :class="
                        selectedSpecifier === entry.specifier
                            ? 'bg-active'
                            : 'hover:bg-hover op85 hover:op100'
                    "
                    @click="selectedSpecifier = entry.specifier"
                >
                    {{ entry.specifier }}
                </button>
            </div>

            <div
                v-if="activeEntry"
                class="inspector-panel"
                border="~ base rounded-xl"
                flex="~ col gap-4"
                bg-black:4
                p4
                dark:bg-white:3
            >
                <div
                    flex="~ col gap-2 md:row md:items-start md:justify-between"
                >
                    <div flex="~ col gap-2">
                        <div flex="~ items-center gap-2 wrap">
                            <code
                                class="rounded-full bg-violet:10 px3 py1 text-violet7 font-mono dark:text-violet3"
                            >
                                {{ activeEntry.specifier }}
                            </code>
                            <span
                                border="~ base rounded-full"
                                px2.5
                                py0.5
                                text-xs
                                op80
                            >
                                {{ activeEntry.source }}
                            </span>
                            <code
                                v-if="activeEntry.packageName"
                                class="rounded-full bg-sky:10 px2.5 py0.5 text-xs text-sky7 font-mono dark:text-sky3"
                            >
                                {{ activeEntry.packageName }}
                            </code>
                        </div>
                        <div
                            v-if="activeEntry.description"
                            text-sm
                            leading-6
                            op80
                        >
                            {{ activeEntry.description }}
                        </div>
                        <div v-else text-sm italic op60>
                            No package description metadata was found for this
                            extended config.
                        </div>
                    </div>

                    <NuxtLink
                        v-if="activeEntry.docsUrl"
                        btn-action
                        :to="activeEntry.docsUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <div i-ph-book-duotone />
                        Docs
                    </NuxtLink>
                </div>

                <div grid="~ cols-1 gap-3 md:cols-2 xl:cols-3">
                    <div
                        border="~ base rounded-lg"
                        bg-black:6
                        p3
                        dark:bg-white:3
                    >
                        <div text-sm font-medium>Used by config items</div>
                        <div mt2 flex="~ col gap-2">
                            <NuxtLink
                                v-for="config in usedByConfigs"
                                :key="config.index"
                                class="border border-base rounded-lg px3 py2 hover:bg-hover"
                                :to="`/configs?index=${config.index + 1}`"
                            >
                                <div flex="~ gap-2 items-center wrap">
                                    <span font-mono op60
                                        >#{{ config.index + 1 }}</span
                                    >
                                    <ColorizedConfigName
                                        v-if="config.name"
                                        :name="config.name"
                                    />
                                    <span v-else italic op60>anonymous</span>
                                </div>
                            </NuxtLink>
                        </div>
                    </div>

                    <div
                        border="~ base rounded-lg"
                        bg-black:6
                        p3
                        dark:bg-white:3
                    >
                        <div text-sm font-medium>Direct extends</div>
                        <div
                            v-if="activeEntry.directExtends?.length"
                            mt2
                            flex="~ gap-2 wrap items-center"
                        >
                            <code
                                v-for="entry in activeEntry.directExtends"
                                :key="entry"
                                class="rounded-full bg-violet:10 px2.5 py0.5 text-xs text-violet7 font-mono dark:text-violet3"
                            >
                                {{ entry }}
                            </code>
                        </div>
                        <div v-else mt2 text-sm italic op60>
                            No direct <code>extends</code> entries were
                            detected.
                        </div>
                    </div>

                    <div
                        border="~ base rounded-lg"
                        bg-black:6
                        p3
                        dark:bg-white:3
                    >
                        <div text-sm font-medium>Plugins and syntax</div>
                        <div mt2 flex="~ col gap-3">
                            <div>
                                <div text-xs op60>Plugins</div>
                                <div
                                    v-if="activeEntry.plugins?.length"
                                    mt1
                                    flex="~ gap-2 wrap items-center"
                                >
                                    <code
                                        v-for="plugin in activeEntry.plugins"
                                        :key="plugin"
                                        class="rounded-full bg-teal:10 px2.5 py0.5 text-xs text-teal7 font-mono dark:text-teal3"
                                    >
                                        {{ plugin }}
                                    </code>
                                </div>
                                <div v-else mt1 text-sm italic op60>
                                    No plugin metadata detected.
                                </div>
                            </div>
                            <div>
                                <div text-xs op60>Custom syntax</div>
                                <code
                                    v-if="activeEntry.customSyntax"
                                    class="mt1 inline-flex rounded-full bg-emerald:10 px2.5 py0.5 text-xs text-emerald7 font-mono dark:text-emerald3"
                                >
                                    {{ activeEntry.customSyntax }}
                                </code>
                                <div v-else mt1 text-sm italic op60>
                                    No custom syntax metadata detected.
                                </div>
                            </div>
                            <div>
                                <div text-xs op60>Rule count</div>
                                <div mt1 font-mono>
                                    {{ activeEntry.ruleCount ?? "unknown" }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div border="~ base rounded-lg" bg-black:6 p3 dark:bg-white:3>
                    <div flex="~ items-center gap-2 wrap">
                        <div i-ph-list-dashes-duotone text-blue5 />
                        <span text-sm font-medium
                            >Rules from this extends entry</span
                        >
                        <span op60>({{ activeRules.length }})</span>
                    </div>
                    <div
                        v-if="activeRules.length"
                        :data-testid="testIds.extends.rulesListContainer"
                        mt3
                    >
                        <RuleList
                            :grid-view="false"
                            :rules="activeRules"
                            :show-rule-states="false"
                            list-columns="40px_minmax(14rem,clamp(14rem,36vw,28rem))_5.25rem_minmax(0,1fr)"
                        />
                    </div>
                    <div v-else mt3 text-sm italic op60>
                        No rules were extracted for this extends entry.
                    </div>
                </div>
            </div>
            <div v-else class="inspector-empty-state" text-sm>
                <div flex="~ gap-2 items-center" text-amber7 dark:text-amber3>
                    <div i-ph-funnel-x-duotone />
                    <span font-medium
                        >No extended configs match the search</span
                    >
                </div>
                <button
                    mt3
                    btn-action
                    type="button"
                    @click="extendsSearch = ''"
                >
                    <div i-ph-arrow-counter-clockwise-duotone />
                    Clear extends search
                </button>
            </div>
        </template>

        <div
            v-else
            class="inspector-panel"
            rounded-xl
            border="~ base"
            bg-black:5
            p4
            text-sm
            dark:bg-white:3
        >
            No extended configs were found in the current payload.
        </div>
    </div>
</template>
