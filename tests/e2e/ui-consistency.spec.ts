import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { testIds } from "../../shared/test-ids";
import {
    createStressPayload,
    MOCK_PAYLOAD,
    mockPayload,
    pluginRuleName,
} from "./fixtures/mock-payload";
import { MOCK_STATS_REPORT } from "./fixtures/mock-stats";

const routes = [
    "configs",
    "rules",
    "extends",
    "files",
    "stats",
    "dev",
] as const;

async function expectNoOverflow(page: Page): Promise<void> {
    const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth
        ),
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 2);
}

async function expectSingleLineText(
    locator: Locator,
    label: string
): Promise<void> {
    const lineCount = await locator.evaluate((element, text) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const index = node.textContent?.indexOf(text) ?? -1;
            if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + text.length);
                return range.getClientRects().length;
            }
            node = walker.nextNode();
        }
        throw new Error(`Could not find rendered label: ${text}`);
    }, label);
    expect(
        lineCount,
        `${label} should remain a readable single-line label`
    ).toBe(1);
}

for (const theme of ["light", "dark"] as const) {
    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
    ]) {
        test(`all pages remain readable in ${theme} at ${viewport.width}px`, async ({
            page,
        }, testInfo) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error") errors.push(message.text());
            });
            await page.setViewportSize(viewport);
            await page.clock.setFixedTime(new Date("2026-09-28T23:00:00.000Z"));
            await page.emulateMedia({
                colorScheme: theme,
                reducedMotion: "reduce",
            });
            await page.addInitScript((value) => {
                localStorage.setItem(
                    "stateStorage",
                    JSON.stringify({ theme: value })
                );
            }, theme);
            await mockPayload(page);
            await page.route("**/api/stats.json**", (route) =>
                route.fulfill({
                    json: {
                        mode: "static",
                        status: "complete",
                        stale: false,
                        report: {
                            ...MOCK_STATS_REPORT,
                            configRevision: MOCK_PAYLOAD.meta.lastUpdate,
                        },
                    },
                })
            );
            for (const route of routes) {
                const response = await page.goto(`/${route}`);
                expect(response?.status()).toBe(200);
                await expect(page.getByTestId(testIds.nav.tabs)).toBeVisible();
                await expect(page.getByRole("main")).toBeVisible();
                await expect(
                    page.getByRole("heading", { level: 1 })
                ).toBeVisible();
                // Let route prefetches and fonts settle before capturing or unloading the document.
                await page.waitForLoadState("networkidle");
                await page.evaluate(() =>
                    document.fonts.ready.then(() => undefined)
                );
                await expectNoOverflow(page);
                const screenshot = await page.screenshot({
                    path: `output/playwright/after/${testInfo.project.name}-${theme}-${viewport.width}-${route}.png`,
                    fullPage: true,
                    animations: "disabled",
                });
                await testInfo.attach(`${theme}-${viewport.width}-${route}`, {
                    body: screenshot,
                    contentType: "image/png",
                });
            }
            expect(errors).toEqual([]);
        });
    }
}

for (const width of [320, 768]) {
    test(`long content, open menus and largest text fit at ${width}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mockPayload(page, createStressPayload());
        await page.goto("/rules");
        const fontButton = page.getByRole("button", {
            name: "Font size: Default",
        });
        await fontButton.focus();
        await expect(fontButton).toBeFocused();
        const focusStyles = await fontButton.evaluate((element) => {
            const styles = getComputedStyle(element);
            return {
                outline: styles.outlineStyle,
                animation: styles.animationName,
                transition: styles.transitionDuration,
            };
        });
        expect(focusStyles).toEqual({
            outline: "solid",
            animation: "none",
            transition: "0s",
        });
        await page.keyboard.press("Enter");
        await page.getByRole("button", { name: /Large 112\.5%/ }).click();
        await page.keyboard.press("Escape");
        await page.reload();
        await expect(
            page.getByRole("button", { name: "Font size: Large" })
        ).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(() =>
                    getComputedStyle(document.documentElement)
                        .getPropertyValue("--inspector-font-scale")
                        .trim()
                )
            )
            .toBe("1.125");
        await page.getByPlaceholder("Search rules...").fill(pluginRuleName);
        await page.locator(".colorized-rule-name--button").first().click();
        const popup = page
            .locator(".v-popper--theme-dropdown .v-popper__inner")
            .filter({ hasText: "Copy name" })
            .first();
        await expect(popup).toBeVisible();
        await expectSingleLineText(
            page.getByRole("button", { name: "List", exact: true }),
            "List"
        );
        await expectSingleLineText(
            page.getByRole("button", { name: "Grid", exact: true }),
            "Grid"
        );
        await expectSingleLineText(
            page.getByRole("button", { name: "Close effective rule trace" }),
            "Close"
        );
        await expectSingleLineText(
            popup.locator(".rule-state-config-button").first(),
            "the 1st config item"
        );
        const bounds = await popup.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 2);
        await expectNoOverflow(page);
        const rulePopupScreenshot = await page.screenshot({
            path: `output/playwright/stress/${testInfo.project.name}-${width}-rule-popup.png`,
            fullPage: true,
            animations: "disabled",
        });
        await testInfo.attach(`${width}-rule-popup`, {
            body: rulePopupScreenshot,
            contentType: "image/png",
        });
        await page.keyboard.press("Escape");
        for (const route of [
            "configs",
            "extends",
            "files",
            "dev",
        ]) {
            await page.goto(`/${route}`);
            await expect(page.getByRole("main")).toBeVisible();
            if (route === "files") {
                await page.getByTestId(testIds.files.viewGroupsButton).click();
                await expect(
                    page.getByTestId(testIds.files.groupIdentityLabel).first()
                ).toBeVisible();
                await page
                    .getByRole("button", {
                        name: "stylelint/override-1",
                        exact: true,
                    })
                    .first()
                    .click();
                const configPopup = page
                    .locator(".v-popper--theme-dropdown .v-popper__inner")
                    .filter({ hasText: "Go to this config" })
                    .first();
                await expect(configPopup).toBeVisible();
                const configBounds = await configPopup.boundingBox();
                expect(configBounds).not.toBeNull();
                expect(configBounds!.x).toBeGreaterThanOrEqual(0);
                expect(
                    configBounds!.x + configBounds!.width
                ).toBeLessThanOrEqual(width + 2);
                await expect(
                    configPopup.getByRole("button", {
                        name: "Go to this config",
                    })
                ).toHaveAttribute("title", "Go to this config");
                const configPopupScreenshot = await page.screenshot({
                    path: `output/playwright/stress/${testInfo.project.name}-${width}-config-popup.png`,
                    fullPage: true,
                    animations: "disabled",
                });
                await testInfo.attach(`${width}-config-popup`, {
                    body: configPopupScreenshot,
                    contentType: "image/png",
                });
            }
            await expectNoOverflow(page);
        }
    });
}
