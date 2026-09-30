<script setup lang="ts">
import { computed, ref } from "vue";
import { testIds } from "~~/shared/test-ids";
import { getPluginColor } from "~/composables/color";
import { payload } from "~/composables/payload";
import { useStats } from "~/composables/stats";
import { statsDisplayPlugins } from "~/composables/stats-presentation";

const { state, loading, requestError, submitting, stale, run, refresh } =
    useStats();
const view = ref<"rules" | "plugins">("rules");
const ruleLimit = ref(25);
const pluginLimit = ref(25);
const expanded = ref(new Set<string>());
const report = computed(() => state.value.report);
const plugins = computed(() =>
    statsDisplayPlugins(report.value?.rules ?? [], payload.value.rules)
);
const running = computed(
    () => state.value.status === "running" || submitting.value
);
const metrics = computed(() =>
    report.value
        ? [
              {
                  label: "Elapsed duration",
                  value: `${report.value.durationMs.toFixed(1)} ms`,
              },
              {
                  label: "Reported rule time",
                  value: `${report.value.ruleTimeMs.toFixed(3)} ms`,
              },
              { label: "Files linted", value: report.value.filesLinted },
              { label: "Errors", value: report.value.errors },
              { label: "Warnings", value: report.value.warnings },
          ]
        : []
);

function togglePlugin(name: string) {
    if (expanded.value.has(name)) expanded.value.delete(name);
    else expanded.value.add(name);
}
</script>

<template>
    <div flex="~ col gap-4" my4>
        <header flex="~ wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <h1 class="inspector-page-title">Stats</h1>
                <p class="mb0 mt2 text-sm op70">
                    Find the rules and plugins that take the most time when
                    linting your workspace.
                </p>
            </div>
            <span v-if="state.mode === 'static'" class="badge text-sm"
                >Static snapshot</span
            >
            <button
                v-else
                type="button"
                btn-action
                :data-testid="testIds.stats.runButton"
                :disabled="loading || running || state.status === 'unsupported'"
                @click="run"
            >
                <span i-ph-chart-bar-duotone aria-hidden="true" />
                {{
                    running
                        ? "Analyzing…"
                        : report
                          ? "Re-run Analysis"
                          : "Run Analysis"
                }}
            </button>
        </header>

        <div
            v-if="loading || running"
            :data-testid="testIds.stats.status"
            role="status"
            class="inspector-panel p4 text-sm"
        >
            {{
                loading
                    ? "Loading analysis status…"
                    : "Analyzing workspace files. This can take a few minutes."
            }}
        </div>
        <div
            v-if="requestError || state.error"
            role="alert"
            class="inspector-empty-state text-sm"
        >
            <p class="m0 font-medium">
                {{
                    state.status === "unsupported"
                        ? "Profiling is unavailable"
                        : "Analysis could not be completed"
                }}
            </p>
            <p class="mb0 mt2 break-words">{{ requestError || state.error }}</p>
            <p v-if="state.status === 'unsupported'" class="mb0 mt2 op70">
                After upgrading Stylelint, restart the inspector to enable
                profiling.
            </p>
            <button
                v-if="requestError"
                type="button"
                mt3
                btn-action
                @click="refresh"
            >
                Retry loading status
            </button>
            <p v-if="report" class="mb0 mt2 op70">
                The previous successful report is shown below.
            </p>
        </div>
        <div v-if="stale" role="status" class="inspector-panel p4 text-sm">
            Configuration changed since this analysis.
            {{
                state.mode === "static"
                    ? "Rebuild the snapshot to update the report."
                    : "Re-run analysis to refresh the report."
            }}
        </div>

        <div
            v-if="!loading && !report && state.status === 'idle'"
            class="inspector-empty-state text-sm"
        >
            <template v-if="state.mode === 'static'"
                >No performance report was included in this snapshot. Generate
                one with
                <code class="break-all"
                    >stylelint-config-inspector build --stats</code
                >.</template
            >
            <template v-else
                >Run an analysis to collect native Stylelint rule timings.
                Analysis covers discovered workspace files, respects Stylelint
                ignores and overrides, and does not apply fixes.</template
            >
        </div>

        <template v-if="report">
            <p
                v-if="state.status === 'complete'"
                role="status"
                class="m0 text-sm op70"
            >
                Analysis complete.
            </p>
            <dl
                :data-testid="testIds.stats.summary"
                class="grid grid-cols-2 m0 gap-3 lg:grid-cols-5"
            >
                <div
                    v-for="metric in metrics"
                    :key="metric.label"
                    class="inspector-panel min-w-0 p4"
                >
                    <dt class="text-xs op60">{{ metric.label }}</dt>
                    <dd class="m0 mt2 break-words text-xl tabular-nums">
                        {{ metric.value }}
                    </dd>
                </div>
            </dl>
            <div class="min-w-0 text-xs op70" flex="~ col gap-1">
                <span
                    >Analyzed
                    <time :datetime="report.analyzedAt">{{
                        report.analyzedAt
                    }}</time>
                    · Stylelint {{ report.stylelintVersion }}</span
                >
                <span class="break-words">Scope: {{ report.scope }}</span>
            </div>
            <div
                v-if="report.diagnostics.length"
                role="status"
                class="inspector-panel p4 text-sm"
            >
                <p
                    v-for="diagnostic in report.diagnostics"
                    :key="diagnostic"
                    class="my1 break-words"
                >
                    {{ diagnostic }}
                </p>
            </div>
            <div
                class="flex flex-wrap gap-2"
                role="group"
                aria-label="Performance breakdown"
            >
                <button
                    type="button"
                    btn-action
                    :class="view === 'rules' ? 'btn-action-active' : ''"
                    :aria-pressed="view === 'rules'"
                    @click="view = 'rules'"
                >
                    Slow Rules
                </button>
                <button
                    type="button"
                    btn-action
                    :class="view === 'plugins' ? 'btn-action-active' : ''"
                    :aria-pressed="view === 'plugins'"
                    @click="view = 'plugins'"
                >
                    Slow Plugins
                </button>
            </div>
            <div
                v-if="!report.rules.length"
                class="inspector-empty-state text-sm"
            >
                No rule timings were recorded.
            </div>
            <section
                v-else-if="view === 'rules'"
                aria-label="Slow Rules"
                class="inspector-panel min-w-0 px4"
            >
                <StatsTimingRow
                    v-for="rule in report.rules.slice(0, ruleLimit)"
                    :key="rule.name"
                    :timing="rule"
                />
                <button
                    v-if="report.rules.length > ruleLimit"
                    type="button"
                    my3
                    btn-action
                    @click="ruleLimit += 25"
                >
                    Show More Rules
                </button>
            </section>
            <section
                v-else
                aria-label="Slow Plugins"
                class="inspector-panel min-w-0 px4"
            >
                <div
                    v-for="plugin in plugins.slice(0, pluginLimit)"
                    :key="plugin.name"
                    :data-testid="testIds.stats.pluginRow"
                    class="min-w-0 py3"
                >
                    <button
                        type="button"
                        class="min-w-0 w-full text-left"
                        flex="~ wrap items-center gap-2"
                        :aria-expanded="expanded.has(plugin.name)"
                        @click="togglePlugin(plugin.name)"
                    >
                        <span
                            :class="
                                expanded.has(plugin.name)
                                    ? 'i-ph-caret-down'
                                    : 'i-ph-caret-right'
                            "
                            class="shrink-0"
                            aria-hidden="true"
                        />
                        <span
                            class="min-w-0 flex-1 break-all text-sm font-mono"
                            >{{ plugin.name }}</span
                        >
                        <span class="whitespace-nowrap text-sm tabular-nums"
                            >{{ plugin.timeMs.toFixed(3) }} ms
                            <span op60
                                >({{ plugin.percentage.toFixed(1) }}%)</span
                            ></span
                        >
                    </button>
                    <div
                        class="mt2 h2 overflow-hidden rounded bg-code"
                        aria-hidden="true"
                    >
                        <div
                            class="h-full rounded"
                            :style="{
                                width: `${Math.min(100, Math.max(0, plugin.percentage))}%`,
                                backgroundColor: getPluginColor(
                                    plugin.name,
                                    0.45
                                ),
                            }"
                        />
                    </div>
                    <div
                        v-if="expanded.has(plugin.name)"
                        class="ml3 mt2 border-l border-base pl3"
                    >
                        <StatsTimingRow
                            v-for="rule in plugin.rules"
                            :key="rule.name"
                            :timing="rule"
                        />
                    </div>
                </div>
                <button
                    v-if="plugins.length > pluginLimit"
                    type="button"
                    my3
                    btn-action
                    @click="pluginLimit += 25"
                >
                    Show More Plugins
                </button>
            </section>
        </template>

        <aside
            class="inspector-panel p4 text-sm"
            aria-label="About these measurements"
        >
            <h2 class="m0 text-sm font-medium">About these measurements</h2>
            <p class="mb0 mt2 op70">
                Percentages describe reported rule time. Elapsed duration
                includes configuration loading, parsing, and other work. Timings
                vary between runs and Stylelint's native timer can undercount
                asynchronous plugin work.
            </p>
            <p class="mb0 mt2 op70">
                Profiling requires Stylelint 16.13+ in major version 16 or 17.
                Fixes and caching are disabled. File-level timings and
                parsing/fixing breakdowns are not available.
            </p>
        </aside>
    </div>
</template>
