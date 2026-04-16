import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/**
 * Read environment variables from file. https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./tests/e2e",
    testIgnore: ["**/fixtures/**"],
    forbidOnly: isCI,
    timeout: 45_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    retries: isCI ? 2 : 0,
    workers: isCI ? 1 : undefined,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: "http://127.0.0.1:4173",
        actionTimeout: 10_000,
        navigationTimeout: 20_000,
        screenshot: "only-on-failure",
        trace: "on-first-retry",
        video: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        ...(isCI
            ? [
                  {
                      name: "firefox",
                      use: { ...devices["Desktop Firefox"] },
                  },
              ]
            : []),
    ],
    webServer: {
        command: "npm run dev -- --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
