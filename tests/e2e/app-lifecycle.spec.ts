import type { Payload } from "../../shared/types";
import { expect, test } from "@playwright/test";
import { testIds } from "../../shared/test-ids";
import {
    MOCK_PAYLOAD,
    mockPayload,
    pluginRuleName,
} from "./fixtures/mock-payload";

test("the deprecated shortcut selects the configured deprecated rule and clears prior search", async ({
    page,
}) => {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    payload.rules[pluginRuleName]!.deprecated = true;
    await page.route("**/api/payload.json**", (route) =>
        route.fulfill({ json: payload })
    );
    await page.goto("/rules");
    await page
        .getByRole("textbox", { name: "Search rules", exact: true })
        .fill("color-hex-length");
    await page.getByTestId(testIds.nav.configsLink).click();
    await page
        .getByRole("button", { name: "Using 1 deprecated rules", exact: true })
        .click();
    await expect(page).toHaveURL(/\/rules\/?$/);
    await expect(
        page
            .getByRole("group", { name: "Rule state filter" })
            .getByRole("radio", { name: "Using", exact: true })
    ).toBeChecked();
    await expect(
        page
            .getByRole("group", { name: "Rule status filter" })
            .getByRole("radio", { name: "Deprecated", exact: true })
    ).toBeChecked();
    await expect(
        page.getByRole("textbox", { name: "Search rules", exact: true })
    ).toHaveValue("");
    await expect(page.locator(".colorized-rule-name--button")).toHaveCount(1);
    await expect(page.locator(".colorized-rule-name--button")).toHaveAttribute(
        "title",
        pluginRuleName
    );
});

test("disabled rule dimming changes rendered opacity and survives reload", async ({
    page,
}) => {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    payload.configs[0]!.rules!["stylelint/color-hex-length"] = null;
    await page.route("**/api/payload.json**", (route) =>
        route.fulfill({ json: payload })
    );
    await page.goto("/rules");
    const rule = page.locator(
        ".colorized-rule-name--button[title='stylelint/color-hex-length']"
    );
    const renderedOpacity = () =>
        rule.evaluate((element) => {
            let opacity = 1;
            let current: Element | null = element;
            while (current && current.tagName !== "MAIN") {
                opacity *= Number(getComputedStyle(current).opacity);
                current = current.parentElement;
            }
            return opacity;
        });
    await expect(rule).toBeVisible();
    await expect.poll(renderedOpacity).toBeLessThan(1);
    await page
        .getByRole("button", { name: "Disable dimming for disabled rules" })
        .click();
    await expect.poll(renderedOpacity).toBe(1);
    await page.reload();
    await expect(
        page.getByRole("button", { name: "Enable dimming for disabled rules" })
    ).toHaveAttribute("aria-pressed", "false");
    await expect.poll(renderedOpacity).toBe(1);
    await page
        .getByRole("button", { name: "Enable dimming for disabled rules" })
        .click();
    await expect.poll(renderedOpacity).toBeLessThan(1);
});

test("initial payload loading is announced before the navigation and content appear", async ({
    page,
}) => {
    const release = Promise.withResolvers<void>();
    await page.route("**/api/payload.json**", async (route) => {
        await release.promise;
        await route.fulfill({ json: MOCK_PAYLOAD });
    });
    await page.goto("/configs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("status")).toContainText("Loading config...");
    await expect(
        page.getByRole("navigation", { name: "Inspector sections" })
    ).toHaveCount(0);
    release.resolve();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Configs", exact: true })
    ).toBeVisible();
    await expect(
        page.getByText("Loading config...", { exact: true })
    ).toHaveCount(0);
});

test("a structured configuration failure can be retried by keyboard", async ({
    page,
}) => {
    let repaired = false;
    await page.route("**/api/payload.json**", (route) =>
        route.fulfill({
            json: repaired
                ? MOCK_PAYLOAD
                : {
                      error: "Missing Stylelint plugin",
                      message: "Install the configured plugin and retry.",
                  },
        })
    );
    await page.goto("/rules");
    await expect(page.getByRole("alert")).toContainText(
        "Missing Stylelint plugin"
    );
    await expect(page.getByRole("main")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Retry payload" });
    await retry.focus();
    await expect(retry).toBeFocused();
    repaired = true;
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByTestId(testIds.nav.rulesLink)).toHaveAttribute(
        "aria-current",
        "page"
    );
});

test("retrying a failed initial request also connects live configuration updates", async ({
    page,
}) => {
    let ready = false;
    let revision = 1;
    let socket: import("@playwright/test").WebSocketRoute | undefined;
    let connections = 0;
    await page.routeWebSocket("ws://127.0.0.1:19877/", (connected) => {
        connections++;
        socket = connected;
    });
    await page.route("**/api/payload.json**", (route) =>
        ready
            ? route.fulfill({
                  json: {
                      ...MOCK_PAYLOAD,
                      meta: {
                          ...MOCK_PAYLOAD.meta,
                          wsPort: 19877,
                          lastUpdate: revision,
                          targetFilePath:
                              revision === 1
                                  ? "before.css"
                                  : revision === 2
                                    ? "after.css"
                                    : "latest.css",
                      },
                  },
              })
            : route.fulfill({
                  status: 503,
                  json: { message: "Backend temporarily unavailable" },
              })
    );
    await page.goto("/configs");
    await expect(page.getByRole("alert")).toContainText(
        "Failed to load Stylelint config payload"
    );
    ready = true;
    await page.getByRole("button", { name: "Retry payload" }).click();
    await expect(page.getByText("before.css", { exact: true })).toBeVisible();
    await expect.poll(() => socket !== undefined).toBe(true);
    revision = 2;
    socket!.send(JSON.stringify({ type: "config-change" }));
    await expect(page.getByText("after.css", { exact: true })).toBeVisible();
    revision = 3;
    socket!.send(JSON.stringify({ type: "config-change" }));
    await expect(page.getByText("latest.css", { exact: true })).toBeVisible();
    expect(connections).toBe(1);
});

test("failed live refreshes preserve the current view and recover on the next update", async ({
    page,
}) => {
    let failing = false;
    let revision = 1;
    const socketReady =
        Promise.withResolvers<import("@playwright/test").WebSocketRoute>();
    await page.routeWebSocket("ws://127.0.0.1:19878/", (socket) =>
        socketReady.resolve(socket)
    );
    await page.route("**/api/payload.json**", (route) =>
        failing
            ? route.fulfill({
                  status: 503,
                  json: { message: "Temporary outage" },
              })
            : route.fulfill({
                  json: {
                      ...MOCK_PAYLOAD,
                      meta: {
                          ...MOCK_PAYLOAD.meta,
                          wsPort: 19878,
                          lastUpdate: revision,
                          targetFilePath: `revision-${revision}.css`,
                      },
                  },
              })
    );
    await page.goto("/rules");
    const socket = await socketReady.promise;
    await expect(page.getByRole("main")).toBeVisible();
    await page.getByPlaceholder("Search rules...").fill("color-hex-length");
    failing = true;
    socket.send(JSON.stringify({ type: "config-change" }));
    await expect(
        page.getByRole("status").filter({ hasText: "Payload refresh failed" })
    ).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByPlaceholder("Search rules...")).toHaveValue(
        "color-hex-length"
    );
    failing = false;
    revision = 2;
    socket.send(JSON.stringify({ type: "config-change" }));
    await expect(
        page.getByText("revision-2.css", { exact: true })
    ).toBeVisible();
    await expect(
        page.getByText("Payload refresh failed", { exact: true })
    ).toHaveCount(0);
    await expect(page.getByPlaceholder("Search rules...")).toHaveValue(
        "color-hex-length"
    );
});

test("theme and font controls work by keyboard and persist through navigation and reload", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "light" });
    await mockPayload(page);
    await page.goto("/configs");
    const theme = page.getByRole("button", { name: "Toggle dark mode" });
    await theme.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveClass(/dark/);
    const font = page.getByRole("button", { name: "Font size: Default" });
    await font.focus();
    await page.keyboard.press("Enter");
    const small = page.getByRole("button", { name: "Small 93.75%" });
    await expect(small).toBeVisible();
    await small.press("Space");
    await expect(small).toHaveAttribute("aria-pressed", "true");
    await expect(
        page.getByRole("button", { name: "Default 100%" })
    ).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await expect(small).not.toBeVisible();
    await expect(
        page.getByRole("button", { name: "Font size: Small" })
    ).toBeFocused();
    await page.getByTestId(testIds.nav.filesLink).click();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
        page.getByRole("button", { name: "Font size: Small" })
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(() =>
                getComputedStyle(document.documentElement)
                    .getPropertyValue("--inspector-font-scale")
                    .trim()
            )
        )
        .toBe("0.9375");
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("a disconnected update channel is announced while the current inspector stays usable", async ({
    page,
}) => {
    const connected =
        Promise.withResolvers<import("@playwright/test").WebSocketRoute>();
    await page.routeWebSocket("ws://127.0.0.1:19879/", (socket) =>
        connected.resolve(socket)
    );
    const livePayload = {
        ...MOCK_PAYLOAD,
        meta: { ...MOCK_PAYLOAD.meta, wsPort: 19879 },
    };
    await mockPayload(page, livePayload);
    await page.goto("/configs");
    const socket = await connected.promise;
    await expect(page.getByRole("main")).toBeVisible();
    socket.close({ code: 1000, reason: "Fixture connection closed" });
    await expect(
        page
            .getByRole("status")
            .filter({ hasText: "Live updates disconnected" })
    ).toBeVisible();
    await page.getByTestId(testIds.nav.rulesLink).click();
    await expect(
        page.getByRole("heading", { name: "Rules", exact: true })
    ).toBeVisible();
    await page.getByPlaceholder("Search rules...").fill("color-hex-length");
    await expect(page.getByPlaceholder("Search rules...")).toHaveValue(
        "color-hex-length"
    );
});
