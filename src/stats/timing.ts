import type { StatsPluginTiming, StatsTiming } from "../../shared/stats";
import { stripVTControlCharacters } from "node:util";

const ROW_SEPARATOR_RE = /[│║|]/u;
const LINE_RE = /\r?\n/u;
const NUMBER_RE = /^\d+(?:\.\d+)?$/u;
const PERCENTAGE_RE = /^\d+(?:\.\d+)?%$/u;
const INTEGER_RE = /^\d+$/u;
const TABLE_ROW_RE = /^\s*[│║|]/u;
const TABLE_END_RE = /^\s*[╚└]/u;

function compareTiming(
    a: { name: string; timeMs: number },
    b: { name: string; timeMs: number }
): number {
    return b.timeMs - a.timeMs || a.name.localeCompare(b.name, "en");
}

/** Parse Stylelint's native TIMING=all table, ignoring unrelated console output. */
export function parseTimingOutput(output: string): StatsTiming[] {
    const rules: StatsTiming[] = [];
    const names = new Set<string>();
    let foundHeader = false;
    let inTable = false;
    for (const line of stripVTControlCharacters(output).split(LINE_RE)) {
        const cells = line
            .split(ROW_SEPARATOR_RE)
            .map((cell) => cell.trim())
            .filter(Boolean);
        if (cells.join("|") === "#|Rule|Time (ms)|Relative") {
            foundHeader = true;
            inTable = true;
            continue;
        }
        if (TABLE_END_RE.test(line)) inTable = false;
        if (!inTable || !TABLE_ROW_RE.test(line)) continue;
        const [
            ,
            rawName,
            rawTime,
            rawPercentage,
        ] = cells;
        if (
            cells.length !== 4 ||
            !INTEGER_RE.test(cells[0] ?? "") ||
            !rawName ||
            !NUMBER_RE.test(rawTime ?? "") ||
            !PERCENTAGE_RE.test(rawPercentage ?? "")
        ) {
            throw new Error("Stylelint returned a malformed rule timing row.");
        }
        const timeMs = Number(rawTime);
        const percentage = Number(rawPercentage?.slice(0, -1));
        if (
            !Number.isFinite(timeMs) ||
            !Number.isFinite(percentage) ||
            percentage > 100
        ) {
            throw new Error("Stylelint returned invalid rule timing values.");
        }
        const name = rawName.includes("/") ? rawName : `stylelint/${rawName}`;
        if (names.has(name))
            throw new Error(
                `Stylelint returned duplicate timings for ${name}.`
            );
        names.add(name);
        rules.push({
            name,
            plugin: name.slice(0, name.lastIndexOf("/")),
            timeMs,
            percentage,
        });
    }
    if (!foundHeader)
        throw new Error(
            "Stylelint did not return a supported timing table. Use Stylelint 16.13+ or 17 and retry."
        );
    return rules.sort(compareTiming);
}

export function aggregatePluginTimings(
    rules: StatsTiming[]
): StatsPluginTiming[] {
    const plugins = new Map<string, StatsPluginTiming>();
    const totalTimeMs = rules.reduce((total, rule) => total + rule.timeMs, 0);
    for (const rule of rules) {
        const plugin = plugins.get(rule.plugin) ?? {
            name: rule.plugin,
            timeMs: 0,
            percentage: 0,
            rules: [],
        };
        plugin.timeMs += rule.timeMs;
        plugin.rules.push(rule);
        plugins.set(rule.plugin, plugin);
    }
    return [...plugins.values()]
        .map((plugin) => ({
            ...plugin,
            percentage:
                totalTimeMs > 0 ? (plugin.timeMs / totalTimeMs) * 100 : 0,
            rules: plugin.rules.sort(compareTiming),
        }))
        .sort(compareTiming);
}

export function isSupportedStatsVersion(version: string): boolean {
    const [major, minor] = version.split(".").map(Number);
    return major === 17 || (major === 16 && minor !== undefined && minor >= 13);
}
