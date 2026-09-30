import type { Page } from "@playwright/test";
import type { StatsReport, StatsState } from "../../../shared/stats";
import { MOCK_PAYLOAD, mockPayload } from "./mock-payload";

export const MOCK_STATS_REPORT: StatsReport = {
    rules: [
        {
            name: "stylelint/color-hex-length",
            plugin: "stylelint",
            timeMs: 3,
            percentage: 75,
        },
        {
            name: "plugin/no-unsupported-browser-features",
            plugin: "plugin",
            timeMs: 1,
            percentage: 25,
        },
    ],
    plugins: [
        {
            name: "stylelint",
            timeMs: 3,
            percentage: 75,
            rules: [
                {
                    name: "stylelint/color-hex-length",
                    plugin: "stylelint",
                    timeMs: 3,
                    percentage: 75,
                },
            ],
        },
        {
            name: "plugin",
            timeMs: 1,
            percentage: 25,
            rules: [
                {
                    name: "plugin/no-unsupported-browser-features",
                    plugin: "plugin",
                    timeMs: 1,
                    percentage: 25,
                },
            ],
        },
    ],
    durationMs: 120,
    ruleTimeMs: 4,
    filesLinted: 2,
    errors: 1,
    warnings: 2,
    analyzedAt: "2026-09-28T12:00:00.000Z",
    scope: "Workspace files matching **/*.css",
    stylelintVersion: "17.14.1",
    configRevision: 1,
    diagnostics: [],
};

export async function mockStats(
    page: Page,
    initial: StatsState,
    result?: StatsState
) {
    const completed: StatsState = result ?? {
        status: "complete",
        mode: "live",
        stale: false,
        report: MOCK_STATS_REPORT,
    };
    await mockPayload(page, {
        ...MOCK_PAYLOAD,
        meta: { ...MOCK_PAYLOAD.meta, basePath: "/workspace", lastUpdate: 1 },
    });
    let state = initial;
    let runCount = 0;
    await page.route("**/api/stats.json**", async (route) => {
        await route.fulfill({ json: state });
        if (state.status === "running") state = completed;
    });
    await page.route("**/api/stats/run", async (route) => {
        runCount += 1;
        state = { ...state, status: "running" };
        await route.fulfill({ status: 202, json: state });
    });
    return { runs: () => runCount };
}
