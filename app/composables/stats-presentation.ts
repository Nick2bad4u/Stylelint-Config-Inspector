import type { StatsPluginTiming, StatsTiming } from "~~/shared/stats";
import type { RuleInfo } from "~~/shared/types";

/** Match the package color key used by RuleItem, preserving unknown namespaces. */
export function statsPluginKey(
    timing: StatsTiming,
    metadata?: RuleInfo
): string {
    if (
        metadata?.plugin === "stylelint" ||
        timing.name.startsWith("stylelint/")
    )
        return "stylelint";
    if (metadata?.pluginPackageName) return metadata.pluginPackageName;
    if (metadata?.plugin) return `stylelint-${metadata.plugin}`;
    return timing.plugin;
}

/** Generic plugin/* rules can belong to different packages in the payload. */
export function statsDisplayPlugins(
    rules: StatsTiming[],
    metadata: Record<string, RuleInfo>
): StatsPluginTiming[] {
    const groups = new Map<string, StatsPluginTiming>();
    let totalTimeMs = 0;
    for (const rule of rules) {
        const name = statsPluginKey(rule, metadata[rule.name]);
        const group = groups.get(name) ?? {
            name,
            timeMs: 0,
            percentage: 0,
            rules: [],
        };
        group.timeMs += rule.timeMs;
        totalTimeMs += rule.timeMs;
        group.rules.push(rule);
        groups.set(name, group);
    }
    for (const group of groups.values()) {
        group.percentage =
            totalTimeMs > 0 ? (group.timeMs / totalTimeMs) * 100 : 0;
    }
    return [...groups.values()].sort(
        (left, right) =>
            right.timeMs - left.timeMs ||
            left.name.localeCompare(right.name, "en")
    );
}
