import type { StatsState } from "../../shared/stats";
import { expect, test } from "@playwright/test";
import { testIds } from "../../shared/test-ids";
import { MOCK_PAYLOAD, mockPayload } from "./fixtures/mock-payload";
import { MOCK_STATS_REPORT, mockStats } from "./fixtures/mock-stats";

test("leaving a running analysis stops page polling and returning resumes the same run", async ({
    page,
}) => {
    await mockPayload(page);
    let state: StatsState = { mode: "live", status: "running", stale: false };
    let reads = 0;
    let starts = 0;
    await page.route("**/api/stats.json**", (route) => {
        reads++;
        return route.fulfill({ json: state });
    });
    await page.route("**/api/stats/run", (route) => {
        starts++;
        return route.fulfill({ status: 202, json: state });
    });
    await page.goto("/stats");
    await expect(page.getByTestId(testIds.stats.runButton)).toBeDisabled();
    await expect(page.getByTestId(testIds.stats.status)).toContainText(
        "Analyzing workspace"
    );
    await page.clock.install();
    await page.getByTestId(testIds.nav.rulesLink).click();
    await expect(
        page.getByRole("heading", { name: "Rules", exact: true })
    ).toBeVisible();
    const readsAfterLeaving = reads;
    await page.clock.fastForward(10_000);
    expect(reads).toBe(readsAfterLeaving);
    state = {
        mode: "live",
        status: "complete",
        stale: false,
        report: MOCK_STATS_REPORT,
    };
    await page.getByTestId(testIds.nav.statsLink).click();
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    expect(reads).toBe(readsAfterLeaving + 1);
    expect(starts).toBe(0);
});

test("a polling failure retains the previous report and recovers without another analysis", async ({
    page,
}) => {
    await mockPayload(page);
    let failed = false;
    let completed = false;
    let reads = 0;
    let starts = 0;
    await page.route("**/api/stats/run", (route) => {
        starts++;
        return route.fulfill({ status: 500 });
    });
    await page.route("**/api/stats.json**", (route) => {
        reads++;
        if (failed)
            return route.fulfill({
                status: 503,
                json: { message: "Temporary outage" },
            });
        return route.fulfill({
            json: {
                mode: "live",
                status: completed ? "complete" : "running",
                stale: false,
                report: MOCK_STATS_REPORT,
            },
        });
    });
    await page.goto("/stats");
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    failed = true;
    await expect(page.getByRole("alert")).toContainText(
        "Analysis could not be completed"
    );
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    await expect(page.getByTestId(testIds.stats.runButton)).toBeDisabled();
    failed = false;
    completed = true;
    await expect(
        page.getByText("Analysis complete.", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByTestId(testIds.stats.runButton)).toBeEnabled();
    expect(reads).toBeGreaterThan(2);
    expect(starts).toBe(0);
});

test("a rejected kickoff can be retried and replaces a previous failed analysis", async ({
    page,
}) => {
    await mockPayload(page);
    let state: StatsState = {
        mode: "live",
        status: "error",
        stale: false,
        report: MOCK_STATS_REPORT,
        error: "Previous plugin failure",
    };
    let starts = 0;
    await page.route("**/api/stats.json**", (route) =>
        route.fulfill({ json: state })
    );
    await page.route("**/api/stats/run", (route) => {
        starts++;
        if (starts === 1)
            return route.fulfill({
                status: 403,
                json: { message: "Request rejected" },
            });
        state = {
            mode: "live",
            status: "complete",
            stale: false,
            report: { ...MOCK_STATS_REPORT, filesLinted: 9 },
        };
        return route.fulfill({
            status: 202,
            json: { ...state, status: "running" },
        });
    });
    await page.goto("/stats");
    await expect(page.getByRole("alert")).toContainText(
        "Previous plugin failure"
    );
    await page.getByTestId(testIds.stats.runButton).click();
    await expect(page.getByRole("alert")).toContainText("403");
    await expect(page.getByTestId(testIds.stats.runButton)).toBeEnabled();
    await page.getByTestId(testIds.stats.runButton).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
        page
            .getByTestId(testIds.stats.summary)
            .locator("div")
            .filter({ has: page.getByText("Files linted", { exact: true }) })
    ).toContainText("9");
    expect(starts).toBe(2);
});

test("a websocket config update marks the report stale until an explicit rerun", async ({
    page,
}) => {
    let revision = 1;
    let reportRevision = 1;
    let starts = 0;
    const socketReady =
        Promise.withResolvers<import("@playwright/test").WebSocketRoute>();
    await page.routeWebSocket("ws://127.0.0.1:19876/", (socket) =>
        socketReady.resolve(socket)
    );
    await page.route("**/api/payload.json**", (route) =>
        route.fulfill({
            json: {
                ...MOCK_PAYLOAD,
                meta: {
                    ...MOCK_PAYLOAD.meta,
                    wsPort: 19876,
                    lastUpdate: revision,
                },
            },
        })
    );
    await page.route("**/api/stats.json**", (route) =>
        route.fulfill({
            json: {
                mode: "live",
                status: "complete",
                stale: false,
                report: {
                    ...MOCK_STATS_REPORT,
                    configRevision: reportRevision,
                },
            },
        })
    );
    await page.route("**/api/stats/run", (route) => {
        starts++;
        reportRevision = revision;
        return route.fulfill({
            status: 202,
            json: {
                mode: "live",
                status: "running",
                stale: false,
                report: MOCK_STATS_REPORT,
            },
        });
    });
    await page.goto("/stats");
    const socket = await socketReady.promise;
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    await expect(
        page.getByText(/Configuration changed since this analysis/)
    ).toHaveCount(0);
    revision = 2;
    socket.send(JSON.stringify({ type: "config-change" }));
    await expect(
        page.getByText(/Configuration changed since this analysis/)
    ).toBeVisible();
    expect(starts).toBe(0);
    await page.getByTestId(testIds.stats.runButton).click();
    await expect(
        page.getByText("Analysis complete.", { exact: true })
    ).toBeVisible();
    await expect(
        page.getByText(/Configuration changed since this analysis/)
    ).toHaveCount(0);
    expect(starts).toBe(1);
});

test("plugin paging preserves expanded rows and has an independent rule limit", async ({
    page,
}) => {
    const rules = Array.from({ length: 30 }, (_, index) => ({
        name: `package-${index}/rule`,
        plugin: `package-${index}`,
        timeMs: 30 - index,
        percentage: (100 * (30 - index)) / 465,
    }));
    await mockStats(page, {
        mode: "static",
        status: "complete",
        stale: false,
        report: { ...MOCK_STATS_REPORT, rules, ruleTimeMs: 465 },
    });
    await page.goto("/stats");
    await page
        .getByRole("button", { name: "Slow Plugins", exact: true })
        .click();
    const groups = page.getByTestId(testIds.stats.pluginRow);
    await expect(groups).toHaveCount(25);
    await groups.first().getByRole("button").click();
    await page.getByRole("button", { name: "Show More Plugins" }).click();
    await expect(groups).toHaveCount(30);
    await expect(groups.first().getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true"
    );
    await expect(
        page.getByRole("button", { name: "Show More Plugins" })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Slow Rules", exact: true }).click();
    await expect(page.getByTestId(testIds.stats.ruleRow)).toHaveCount(25);
    await page
        .getByRole("button", { name: "Slow Plugins", exact: true })
        .click();
    await expect(groups).toHaveCount(30);
    await expect(
        groups.first().getByText("package-0/rule", { exact: true })
    ).toBeVisible();
});

test("generic plugin rules use their package metadata for grouping and colors", async ({
    page,
}) => {
    const rules = [
        {
            name: "plugin/first-rule",
            plugin: "plugin",
            timeMs: 3,
            percentage: 75,
        },
        {
            name: "plugin/second-rule",
            plugin: "plugin",
            timeMs: 1,
            percentage: 25,
        },
    ];
    await mockStats(page, {
        mode: "live",
        status: "complete",
        stale: false,
        report: {
            ...MOCK_STATS_REPORT,
            rules,
            plugins: [{ name: "plugin", timeMs: 4, percentage: 100, rules }],
        },
    });
    const metadataPayload = {
        ...MOCK_PAYLOAD,
        rules: {
            ...MOCK_PAYLOAD.rules,
            "plugin/first-rule": {
                name: "plugin/first-rule",
                plugin: "scss",
                pluginPackageName: "stylelint-scss",
            },
            "plugin/second-rule": {
                name: "plugin/second-rule",
                plugin: "order",
                pluginPackageName: "stylelint-order",
            },
        },
    };
    await mockPayload(page, metadataPayload);
    await page.goto("/stats");
    const rows = page.getByTestId(testIds.stats.ruleRow);
    await expect(rows).toHaveCount(2);
    const colors = await rows
        .locator("[aria-hidden='true'] > div")
        .evaluateAll((bars) =>
            bars.map((bar) => getComputedStyle(bar).backgroundColor)
        );
    expect(colors[0]).not.toBe(colors[1]);
    await page
        .getByRole("button", { name: "Slow Plugins", exact: true })
        .click();
    const groups = page.getByTestId(testIds.stats.pluginRow);
    await expect(groups).toHaveCount(2);
    await expect(groups.first().getByRole("button")).toContainText(
        "stylelint-scss"
    );
    await expect(groups.nth(1).getByRole("button")).toContainText(
        "stylelint-order"
    );
    const groupColors = await groups
        .locator("[aria-hidden='true'] > div")
        .evaluateAll((bars) =>
            bars.map((bar) => getComputedStyle(bar).backgroundColor)
        );
    expect(groupColors).toEqual(colors);
    await groups.first().getByRole("button").click();
    await expect(
        groups.first().getByText("plugin/first-rule", { exact: true })
    ).toBeVisible();
});

test("rankings show 25 entries initially and plugin expansion works by keyboard", async ({
    page,
}) => {
    const rules = Array.from({ length: 30 }, (_, index) => ({
        name: `unknown/rule-${String(index).padStart(2, "0")}`,
        plugin: "unknown",
        timeMs: 30 - index,
        percentage: (100 * (30 - index)) / 465,
    }));
    await mockStats(page, {
        status: "complete",
        mode: "live",
        stale: false,
        report: {
            ...MOCK_STATS_REPORT,
            rules,
            plugins: [{ name: "unknown", timeMs: 465, percentage: 100, rules }],
        },
    });
    await page.goto("/stats");
    await expect(page.getByTestId(testIds.stats.ruleRow)).toHaveCount(25);
    await page.getByRole("button", { name: "Show More Rules" }).click();
    await expect(page.getByTestId(testIds.stats.ruleRow)).toHaveCount(30);
    await page
        .getByRole("button", { name: "Slow Plugins", exact: true })
        .click();
    const toggle = page
        .getByTestId(testIds.stats.pluginRow)
        .getByRole("button");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
        page.getByText("unknown/rule-29", { exact: true })
    ).toBeVisible();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("failed status requests can be retried", async ({ page }) => {
    await mockStats(page, { status: "idle", mode: "live", stale: false });
    await page.route("**/api/stats.json**", (route) =>
        route.fulfill({ status: 500, json: { message: "Unavailable" } })
    );
    await page.goto("/stats");
    await expect(page.getByRole("alert")).toContainText(
        "Analysis could not be completed"
    );
    await page.unroute("**/api/stats.json**");
    await page.route("**/api/stats.json**", (route) =>
        route.fulfill({
            json: {
                status: "complete",
                mode: "live",
                stale: false,
                report: MOCK_STATS_REPORT,
            },
        })
    );
    await page.getByRole("button", { name: "Retry loading status" }).click();
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
});

test("analysis is explicit, polls, and preserves its report across navigation", async ({
    page,
}) => {
    const calls = await mockStats(page, {
        status: "idle",
        mode: "live",
        stale: false,
    });
    await page.goto("/stats");
    await expect(
        page.getByRole("heading", { name: "Stats", exact: true })
    ).toBeVisible();
    expect(calls.runs()).toBe(0);
    await page.getByTestId(testIds.stats.runButton).click();
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    await expect(page.getByTestId(testIds.stats.ruleRow)).toHaveCount(2);
    await page
        .getByRole("button", { name: "Slow Plugins", exact: true })
        .click();
    const plugin = page.getByTestId(testIds.stats.pluginRow).first();
    await plugin.getByRole("button").click();
    await expect(plugin.getByRole("button")).toHaveAttribute(
        "aria-expanded",
        "true"
    );
    await expect(plugin.getByText("stylelint/color-hex-length")).toBeVisible();
    await page.getByTestId(testIds.nav.rulesLink).click();
    await page.getByTestId(testIds.nav.statsLink).click();
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    expect(calls.runs()).toBe(1);
});

test("failed reruns retain the previous successful report", async ({
    page,
}) => {
    await mockStats(
        page,
        {
            status: "complete",
            mode: "live",
            stale: false,
            report: MOCK_STATS_REPORT,
        },
        {
            status: "error",
            mode: "live",
            stale: false,
            report: MOCK_STATS_REPORT,
            error: "Could not load plugin",
        }
    );
    await page.goto("/stats");
    await page.getByTestId(testIds.stats.runButton).click();
    await expect(page.getByRole("alert")).toContainText(
        "Could not load plugin"
    );
    await expect(page.getByTestId(testIds.stats.summary)).toBeVisible();
    await expect(page.getByTestId(testIds.stats.runButton)).toBeEnabled();
});

test("static reports have no run controls and identify stale snapshots", async ({
    page,
}) => {
    const calls = await mockStats(page, {
        status: "complete",
        mode: "static",
        stale: true,
        report: MOCK_STATS_REPORT,
    });
    await page.goto("/stats");
    await expect(
        page.getByText("Static snapshot", { exact: true })
    ).toBeVisible();
    await expect(page.getByTestId(testIds.stats.runButton)).toHaveCount(0);
    await expect(
        page.getByText(/Configuration changed since this analysis/)
    ).toBeVisible();
    expect(calls.runs()).toBe(0);
});

test("a static build without stats explains how to generate a report", async ({
    page,
}) => {
    await mockStats(page, { status: "idle", mode: "static", stale: false });
    await page.goto("/stats");
    await expect(
        page.getByText("stylelint-config-inspector build --stats", {
            exact: true,
        })
    ).toBeVisible();
    await expect(page.getByTestId(testIds.stats.runButton)).toHaveCount(0);
});

test("unsupported and empty analyses provide clear states", async ({
    page,
}) => {
    await mockStats(page, {
        status: "unsupported",
        mode: "live",
        stale: false,
        error: "Profiling requires Stylelint 16.13 or newer within majors 16 and 17.",
    });
    await page.goto("/stats");
    await expect(page.getByRole("alert")).toContainText("16.13");
    await expect(page.getByTestId(testIds.stats.runButton)).toBeDisabled();
    await page.unroute("**/api/stats.json**");
    await page.route("**/api/stats.json**", (route) =>
        route.fulfill({
            json: {
                status: "complete",
                mode: "live",
                stale: false,
                report: {
                    ...MOCK_STATS_REPORT,
                    rules: [],
                    plugins: [],
                    filesLinted: 0,
                    ruleTimeMs: 0,
                },
            },
        })
    );
    await page.reload();
    await expect(
        page.getByText("No rule timings were recorded.", { exact: true })
    ).toBeVisible();
});
