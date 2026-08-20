<script setup lang="ts">
import type { RuleConfigStates, RuleInfo, RuleLevel } from "~~/shared/types";
import { useClipboard } from "@vueuse/core";
import { vTooltip } from "floating-vue";
import { computed } from "vue";
import {
    getRuleLevel,
    getRuleOptions,
    getRulePrimaryOption,
} from "~~/shared/rules";
import { getPluginColor } from "~/composables/color";
import { deepCompareOptions } from "~/composables/options";
import { getRuleDefaultOptions } from "~/composables/payload";
import { nth } from "~/composables/strings";

const props = defineProps<{
    rule: RuleInfo;
    ruleStates?: RuleConfigStates;
    value?: unknown;
    class?: string;
    gridView?: boolean;
    dimDisabled?: boolean;
}>();

const emit = defineEmits<{
    badgeClick: [MouseEvent];
    stateClick: [RuleLevel];
}>();

const PLACEHOLDER_CONTEXT_RE =
    /no more than|at most|at least|specificity|match pattern|to be one of|must be|should be|allowed list|disallowed list/;
const PLACEHOLDER_VALUE_RE = /<value>|‹([^›]+)›/gu;
const DEFAULT_PLACEHOLDER_EXAMPLE = "foo";

interface DescriptionSegment {
    type: "text" | "token";
    value: string;
}

function redundantOptions(options: unknown[] | undefined) {
    const { hasRedundantOptions } = deepCompareOptions(
        options ?? [],
        getRuleDefaultOptions(props.rule.name)
    );
    return hasRedundantOptions;
}

function getRuleStateLabel(state: RuleConfigStates[number]): string {
    return `Set to '${state.level}' in the ${nth(state.configIndex + 1)} config item`;
}

const { copy } = useClipboard();

function capitalize(str?: string) {
    if (!str) return str;
    return str[0]!.toUpperCase() + str.slice(1);
}

function stringifyInline(value: unknown): string {
    if (typeof value === "string") return value;

    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
}

function isScalarDisplayValue(value: unknown): value is string | number {
    return typeof value === "string" || typeof value === "number";
}

function shouldReplacePlaceholderByContext(
    description: string,
    index: number
): boolean {
    const lookBehind = description
        .slice(Math.max(0, index - 56), index)
        .toLowerCase();
    return PLACEHOLDER_CONTEXT_RE.test(lookBehind);
}

function applyPlaceholderGuesses(
    description: string,
    configuredValue: unknown
): string {
    if (!description.includes("<value>")) return description;

    if (!isScalarDisplayValue(configuredValue)) return description;

    const renderValue = stringifyInline(configuredValue);
    if (!renderValue.length) return description;

    const placeholder = "<value>";
    const indices: number[] = [];
    let start = description.indexOf(placeholder);
    while (start !== -1) {
        indices.push(start);
        start = description.indexOf(placeholder, start + placeholder.length);
    }

    if (!indices.length) return description;

    if (indices.length === 1) {
        if (!shouldReplacePlaceholderByContext(description, indices[0]!))
            return description;
        return description.replace(placeholder, renderValue);
    }

    const parts: string[] = [];
    let cursor = 0;
    let replaced = false;
    for (const index of indices) {
        parts.push(description.slice(cursor, index));
        if (shouldReplacePlaceholderByContext(description, index)) {
            parts.push(renderValue);
            replaced = true;
        } else {
            parts.push(placeholder);
        }
        cursor = index + placeholder.length;
    }
    parts.push(description.slice(cursor));

    return replaced ? parts.join("") : description;
}

const resolvedRuleStates = computed<RuleConfigStates>(
    () => props.ruleStates ?? []
);
const hiddenRuleStateCount = computed(() =>
    Math.max(0, resolvedRuleStates.value.length - 2)
);
const overflowRuleStateLabel = computed(() => {
    const count = hiddenRuleStateCount.value;
    return `${count} more config ${count === 1 ? "state" : "states"}; hover to show the full trace`;
});

const effectiveState = computed(() => {
    const states = resolvedRuleStates.value;
    if (!states?.length) return undefined;

    return (
        states.toReversed().find((state) => state.level !== "off") ??
        states.at(-1)
    );
});

const localConfiguredValue = computed(() => {
    if (props.value === undefined) return undefined;

    return (
        getRulePrimaryOption(props.value) ?? getRuleOptions(props.value)?.[0]
    );
});

const effectiveConfiguredValue = computed(() => {
    if (localConfiguredValue.value !== undefined)
        return localConfiguredValue.value;

    const state = effectiveState.value;
    if (!state) return undefined;

    return state.primaryOption ?? state.options?.[0];
});

const isOffOnlyState = computed(() => {
    const states = resolvedRuleStates.value;
    if (!states?.length) return false;

    return states.every((state) => state.level === "off");
});

const resolvedDescription = computed(() => {
    if (props.rule.invalid) return "Invalid rule has no description";

    const rawDescription = props.rule.docs?.description;
    const baseDescription =
        capitalize(rawDescription) ?? "No description available";
    const configuredValue = effectiveConfiguredValue.value;
    if (configuredValue === undefined) return baseDescription;

    return applyPlaceholderGuesses(baseDescription, configuredValue);
});

const descriptionSegments = computed<DescriptionSegment[]>(() => {
    const description = resolvedDescription.value;
    const segments: DescriptionSegment[] = [];
    let cursor = 0;

    for (const match of description.matchAll(PLACEHOLDER_VALUE_RE)) {
        const index = match.index ?? 0;
        if (cursor < index) {
            segments.push({
                type: "text",
                value: description.slice(cursor, index),
            });
        }

        segments.push({
            type: "token",
            value: match[1] ?? DEFAULT_PLACEHOLDER_EXAMPLE,
        });
        cursor = index + match[0].length;
    }

    if (cursor < description.length) {
        segments.push({
            type: "text",
            value: description.slice(cursor),
        });
    }

    return segments.length ? segments : [{ type: "text", value: description }];
});

const isMissingDescription = computed(
    () => !!props.rule.docs?.descriptionMissing && !props.rule.invalid
);
const descriptionSource = computed(() => props.rule.docs?.descriptionSource);
const isMessageDerivedDescription = computed(
    () => descriptionSource.value === "message" && !isMissingDescription.value
);
const descriptionMetadataHint = computed(() => {
    if (isMissingDescription.value)
        return "Description metadata was missing; this fallback was generated.";

    if (isMessageDerivedDescription.value)
        return "Description derived from plugin message templates because dedicated metadata is missing.";

    return undefined;
});
const descriptionTitle = computed(() => {
    const metadataHint = descriptionMetadataHint.value;
    if (!metadataHint) return resolvedDescription.value;

    return `${resolvedDescription.value}\n${metadataHint}`;
});
const isInferredDocsUrl = computed(
    () => props.rule.docs?.urlSource === "inferred"
);
const docsTooltip = computed(() => {
    if (isInferredDocsUrl.value)
        return "Docs (inferred from plugin package metadata)";
    return "Docs";
});

const isDimmedRule = computed(() => {
    if (!(props.dimDisabled ?? true)) return false;

    if (props.value !== undefined) return getRuleLevel(props.value) === "off";

    return isOffOnlyState.value;
});

const dimRuleClass = computed(() =>
    isDimmedRule.value ? "op55 hover:op100 transition-opacity" : ""
);

const hasLocalValue = computed(() => props.value !== undefined);

const isCoreStylelintRule = computed(() => {
    if (props.rule.plugin === "stylelint") return true;

    return props.rule.name.startsWith("stylelint/");
});

const builtInRuleHint =
    "Built-in stylelint rule: Do not use a prefix in your config.";

const pluginPackageName = computed(() => {
    if (isCoreStylelintRule.value) return "stylelint";

    if (props.rule.pluginPackageName) return props.rule.pluginPackageName;

    if (props.rule.plugin) return `stylelint-${props.rule.plugin}`;

    return undefined;
});

const pluginSourceLabel = computed(() =>
    isCoreStylelintRule.value ? "Rule source" : "Plugin package"
);

const pluginDisplayName = computed(() => {
    if (pluginPackageName.value) return pluginPackageName.value;

    if (props.rule.plugin) return props.rule.plugin;

    return "unknown";
});

const pluginColorStyle = computed(() => {
    const key = pluginPackageName.value || props.rule.plugin || "stylelint";
    const color = getPluginColor(key);

    return {
        color,
        borderColor: getPluginColor(key, 0.5),
        backgroundColor: getPluginColor(key, 0.1),
    };
});

const pluginPrefixHint = computed(() => {
    const [scope] = props.rule.name.split("/");
    if (scope !== "plugin") return undefined;

    if (!pluginPackageName.value) {
        return {
            firstLineBeforePrefix: "This rule uses a generic",
            firstLineAfterPrefix: "prefix from its upstream package.",
        };
    }

    return {
        firstLineBeforePrefix: `This rule is published with a generic`,
        firstLineAfterPrefix: "prefix.",
    };
});

const popoverPanelClass =
    "inspector-popover-panel max-h-[min(34rem,72vh)] min-w-[min(36rem,88vw)] overflow-auto text-sm leading-5";
</script>

<template>
    <div
        :class="[
            props.class,
            dimRuleClass,
            gridView
                ? 'absolute top-2 right-2 flex justify-end items-start'
                : 'relative w-full flex items-center justify-start overflow-visible',
        ]"
    >
        <template v-if="resolvedRuleStates.length">
            <div
                data-testid="rule-state-rail"
                class="rule-state-rail"
                flex="~ items-center gap-1 justify-start nowrap"
                :class="gridView ? 'flex-col' : 'rule-state-rail--list'"
            >
                <template
                    v-for="(s, idx) of resolvedRuleStates"
                    :key="`${s.configIndex}-${s.level}-${idx}`"
                >
                    <span class="rule-state-pill inline-flex flex-none">
                        <VDropdown
                            :triggers="['hover', 'focus']"
                            :popper-triggers="['hover']"
                            :auto-hide="false"
                        >
                            <button
                                type="button"
                                class="rule-state-trigger"
                                :aria-label="getRuleStateLabel(s)"
                            >
                                <RuleLevelIcon
                                    :level="s.level"
                                    :config-index="s.configIndex"
                                    :has-options="
                                        s.primaryOption !== undefined ||
                                        !!s.options?.length
                                    "
                                    :has-redundant-options="
                                        redundantOptions(s.options)
                                    "
                                    :show-config-index="!gridView"
                                />
                            </button>
                            <template #popper="{ shown }">
                                <RuleStateItem
                                    v-if="shown"
                                    :state="s"
                                    variant="popover"
                                />
                            </template>
                        </VDropdown>
                    </span>
                </template>
                <div
                    v-if="hiddenRuleStateCount > 0 && !gridView"
                    v-tooltip="overflowRuleStateLabel"
                    data-testid="rule-state-overflow"
                    class="rule-state-overflow-pill min-w-13 inline-flex flex-none cursor-help items-center justify-center gap-1 border border-base rounded-full bg-white/80 px-2 py-0.75 text-xs text-gray5 leading-none font-mono tabular-nums shadow-sm transition-colors hover:border-violet5/55 dark:bg-zinc-950/80 dark:text-gray4 hover:text-violet6 dark:hover:border-violet3/45 dark:hover:text-violet3"
                    :title="overflowRuleStateLabel"
                    :aria-label="overflowRuleStateLabel"
                >
                    <span>+{{ hiddenRuleStateCount }}</span>
                </div>
            </div>
        </template>
        <template v-else-if="hasLocalValue">
            <RuleLevelIcon
                :level="getRuleLevel(value)"
                :has-options="
                    getRulePrimaryOption(value) !== undefined ||
                    !!getRuleOptions(value)?.length
                "
                :has-redundant-options="redundantOptions(getRuleOptions(value))"
            />
        </template>
        <div v-else-if="!gridView" h-5 w-5 op0 />
    </div>

    <div :class="[props.class, dimRuleClass]" relative min-w-0 pr2>
        <VDropdown>
            <div min-w-0 w-full inline-flex items-center gap-1>
                <span
                    v-if="isCoreStylelintRule"
                    v-tooltip="builtInRuleHint"
                    class="inline-flex flex-none cursor-help items-center text-violet6 op75 dark:text-violet3"
                    :title="builtInRuleHint"
                >
                    <span i-ph-asterisk class="text-3 leading-none" />
                </span>
                <ColorizedRuleName
                    :name="rule.name"
                    :prefix="rule.plugin"
                    :deprecated="rule.deprecated"
                    :borderless="true"
                    :break="gridView"
                    :hover-reveal="false"
                    :title="rule.name"
                    class="min-w-0"
                    text-start
                    as="button"
                    @click="(e: MouseEvent) => emit('badgeClick', e)"
                />
            </div>
            <template #popper="{ shown }">
                <div v-if="shown" :class="popoverPanelClass">
                    <div
                        class="inspector-popover-header"
                        flex="~ items-center gap-2 wrap"
                        p3
                    >
                        <NuxtLink
                            v-if="!rule.invalid && rule.docs?.url"
                            v-tooltip="docsTooltip"
                            class="inspector-popover-action"
                            :to="rule.docs?.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            :title="docsTooltip"
                        >
                            <div i-ph-book-duotone />
                            Docs
                            <div
                                v-if="isInferredDocsUrl"
                                i-ph-magic-wand-duotone
                                op60
                            />
                        </NuxtLink>
                        <button
                            class="inspector-popover-action"
                            title="Copy"
                            @click="copy(rule.name)"
                        >
                            <div i-ph-copy-duotone />
                            Copy name
                        </button>
                        <slot name="popup-actions" />
                    </div>
                    <div px3 pb3 pt3>
                        <div flex="~ items-center gap-1.5 wrap">
                            <span text-sm op70>Rule name</span>
                            <code font-mono>
                                {{ rule.name }}
                            </code>
                        </div>
                        <div class="wrap mt2 flex items-center gap-2">
                            <span text-sm font-medium op80>{{
                                pluginSourceLabel
                            }}</span>
                            <code
                                class="inspector-popover-chip inline-flex items-center border rounded-full px2 py0.5 text-sm font-mono"
                                :style="pluginColorStyle"
                            >
                                {{ pluginDisplayName }}
                            </code>
                            <span
                                v-if="isCoreStylelintRule"
                                class="inspector-popover-chip inline-flex border rounded-full px2 py0.5 text-xs"
                            >
                                Built-in rule · omit
                                <span
                                    class="mx1 text-violet8 font-mono dark:text-violet2"
                                    >stylelint/</span
                                >
                                in config
                            </span>
                        </div>
                        <div
                            v-if="pluginPrefixHint"
                            class="mt2 inline-flex items-start gap-1.5 text-sm op80"
                        >
                            <span i-ph-info-duotone mt0.25 text-sm />
                            <span class="inline-flex flex-col gap-0.5">
                                <span>
                                    {{ pluginPrefixHint.firstLineBeforePrefix }}
                                    <span
                                        class="mx0.5 text-violet7 font-mono dark:text-violet3"
                                        >plugin/</span
                                    >
                                    {{ pluginPrefixHint.firstLineAfterPrefix }}
                                </span>
                                <span>
                                    Keep the
                                    <span
                                        class="mx0.5 text-violet7 font-mono dark:text-violet3"
                                        >plugin/</span
                                    >
                                    prefix in your config.
                                </span>
                            </span>
                        </div>
                    </div>
                    <div
                        v-if="resolvedRuleStates.length"
                        class="inspector-popover-section"
                        border="t base"
                        px3
                        py2
                    >
                        <div flex="~ gap-2 items-center" text-sm op70>
                            <div i-ph-git-branch-duotone />
                            Config state trace
                        </div>
                    </div>
                    <slot name="popup" />
                </div>
            </template>
        </VDropdown>
    </div>

    <div
        v-if="!gridView"
        :class="[props.class, dimRuleClass]"
        mx2
        min-w-0
        flex
        justify-center
    >
        <div
            grid="~ cols-[repeat(4,1.15rem)]"
            min-h-5
            items-center
            justify-items-center
            gap-x-1.5
        >
            <div
                v-if="rule.invalid"
                v-tooltip="'❌ Invalid rule'"
                class="col-start-1"
                i-ph-seal-warning-duotone
                text-red5
                op80
            />
            <div
                v-if="rule.docs?.recommended"
                v-tooltip="'✅ Recommended'"
                class="col-start-2"
                i-ph-check-square-duotone
                text-emerald5
                op95
                dark:text-emerald3
            />
            <div
                v-if="rule.fixable"
                v-tooltip="'🔧 Fixable'"
                class="col-start-3"
                i-ph-wrench-duotone
                text-amber5
                op95
                dark:text-amber3
            />
            <div
                v-if="rule.deprecated"
                v-tooltip="'🪦 Deprecated'"
                class="col-start-4"
                i-ph-prohibit-inset-duotone
                op60
            />
        </div>
    </div>

    <div
        :class="[props.class, dimRuleClass]"
        min-w-0
        flex="~ gap-2 items-center"
        of-hidden
    >
        <div
            :title="descriptionTitle"
            :class="[
                rule.deprecated ? 'line-through' : '',
                rule.invalid ? 'text-red' : '',
                gridView
                    ? 'op55 text-sm leading-5'
                    : 'op75 text-sm ws-nowrap of-hidden text-ellipsis line-clamp-1',
            ]"
        >
            <template
                v-for="(segment, index) of descriptionSegments"
                :key="index"
            >
                <span v-if="segment.type === 'text'">{{ segment.value }}</span>
                <code
                    v-else
                    class="mx-0.5 inline text-[0.94em] text-violet7 font-mono dark:text-violet3"
                >
                    {{ segment.value }}
                </code>
            </template>
        </div>
    </div>

    <div
        v-if="
            gridView &&
            (rule.invalid ||
                rule.deprecated ||
                rule.fixable ||
                rule.docs?.recommended)
        "
        flex
        flex-auto
        flex-col
        items-start
        justify-end
    >
        <div flex="~ gap-2" mt1>
            <RuleDeprecatedInfo
                v-if="rule.invalid || rule.deprecated"
                :deprecated="rule.deprecated"
                :invalid="rule.invalid"
            />
            <div
                v-if="rule.docs?.recommended"
                v-tooltip="'✅ Recommended'"
                i-ph-check-square-duotone
                text-emerald5
                op95
                dark:text-emerald3
            />
            <div
                v-if="rule.fixable"
                v-tooltip="'🔧 Fixable'"
                i-ph-wrench-duotone
                text-amber5
                op95
                dark:text-amber3
            />
        </div>
    </div>
</template>

<style scoped>
.rule-state-rail--list {
    position: relative;
    max-inline-size: 100%;
    padding-block: 0.125rem;
    overflow: hidden;
    border-radius: 9999px;

    & .rule-state-pill:nth-of-type(n + 3) {
        display: none;
    }

    &:hover,
    &:focus-within {
        position: absolute;
        inset-inline-start: 0;
        z-index: 20;
        inline-size: max-content;
        max-inline-size: min(42rem, 80vi);
        padding-inline: 0.25rem;
        outline: 1px solid var(--c-border);
        background: rgb(255 255 255 / 95%);
        box-shadow: 0 18px 45px rgb(0 0 0 / 18%);

        & .rule-state-pill {
            display: inline-flex;
        }

        & .rule-state-overflow-pill {
            visibility: hidden;
            min-inline-size: 0;
            padding-inline: 0;
            overflow: hidden;
            pointer-events: none;
            box-shadow: none;
            opacity: 0;
            border-inline-width: 0;
        }
    }

    html.dark & {
        &:hover,
        &:focus-within {
            background: rgb(9 9 11 / 95%);
        }
    }
}

.rule-state-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: inherit;
    cursor: help;
    background: transparent;
    border: 0;

    &:focus-visible {
        outline: 2px solid rgb(124 58 237 / 62%);
        outline-offset: 2px;
        border-radius: 9999px;
    }
}
</style>
