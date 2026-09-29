import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalCI = process.env.CI;
const originalAllBrowsers = process.env.PLAYWRIGHT_ALL_BROWSERS;

async function loadPlaywrightConfig(
    ci: string | undefined,
    allBrowsers?: string
) {
    vi.resetModules();

    if (typeof ci === "string") process.env.CI = ci;
    else delete process.env.CI;
    if (allBrowsers) process.env.PLAYWRIGHT_ALL_BROWSERS = allBrowsers;
    else delete process.env.PLAYWRIGHT_ALL_BROWSERS;

    const module = await import("../playwright.config");
    return module.default;
}

function getSingleWebServerConfig(
    config: Awaited<ReturnType<typeof loadPlaywrightConfig>>
) {
    if (Array.isArray(config.webServer)) return config.webServer[0];

    return config.webServer;
}

afterEach(() => {
    vi.resetModules();

    if (typeof originalCI === "string") process.env.CI = originalCI;
    else delete process.env.CI;
    if (originalAllBrowsers)
        process.env.PLAYWRIGHT_ALL_BROWSERS = originalAllBrowsers;
    else delete process.env.PLAYWRIGHT_ALL_BROWSERS;
});

describe.sequential("playwright config", () => {
    it("allows both browsers locally without enabling CI restrictions", async () => {
        const config = await loadPlaywrightConfig(undefined, "1");
        expect(config.projects?.map((project) => project.name)).toEqual([
            "chromium",
            "firefox",
        ]);
        expect(config.retries).toBe(0);
        expect(getSingleWebServerConfig(config)?.reuseExistingServer).toBe(
            true
        );
    });
    it("uses chromium-only defaults for local runs", async () => {
        const config = await loadPlaywrightConfig(undefined);

        expect(config.projects?.map((project) => project.name)).toEqual([
            "chromium",
        ]);
        expect(config.retries).toBe(0);
        expect(config.workers).toBeUndefined();
        expect(config.forbidOnly).toBe(false);
        expect(config.testIgnore).toContain("**/fixtures/**");
        expect(getSingleWebServerConfig(config)?.reuseExistingServer).toBe(
            true
        );
        expect(config.reporter).toEqual([
            ["list"],
            ["html", { open: "never" }],
        ]);
        expect(config.use?.baseURL).toBe("http://127.0.0.1:4173");
        expect(config.use?.trace).toBe("on-first-retry");
    });

    it("adds firefox and CI safety defaults when CI is set", async () => {
        const config = await loadPlaywrightConfig("1");

        expect(config.projects?.map((project) => project.name)).toEqual([
            "chromium",
            "firefox",
        ]);
        expect(config.retries).toBe(2);
        expect(config.workers).toBe(1);
        expect(config.forbidOnly).toBe(true);
        expect(getSingleWebServerConfig(config)?.reuseExistingServer).toBe(
            false
        );
        expect(
            config.projects?.find((project) => project.name === "firefox")?.use
        ).toMatchObject({
            defaultBrowserType: "firefox",
        });
    });
});
