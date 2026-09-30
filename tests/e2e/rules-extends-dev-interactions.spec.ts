import type { Page } from "@playwright/test";
import type { Payload } from "../../shared/types";
import { expect, test } from "@playwright/test";
import { testIds } from "../../shared/test-ids";
import {
    MOCK_PAYLOAD,
    pluginRuleName,
    secondaryExtendSpecifier,
} from "./fixtures/mock-payload";

function createFilterPayload(): Payload {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    payload.rules = Object.fromEntries(
        [
            "error",
            "warning",
            "off",
            "mixed",
            "unused",
        ].map((name) => [
            `fixture/${name}`,
            {
                name: `fixture/${name}`,
                plugin: "fixture",
                fixable: name === "error",
                deprecated: name === "off",
                docs: {
                    description: `Fixture ${name} rule.`,
                    recommended: name === "warning" || name === "unused",
                },
            },
        ])
    );
    payload.configs = [
        {
            index: 0,
            name: "fixture/root",
            rules: {
                "fixture/error": true,
                "fixture/warning": [true, { severity: "warning" }],
                "fixture/off": null,
                "fixture/mixed": true,
            },
        },
        {
            index: 1,
            name: "fixture/override",
            files: ["**/*.css"],
            rules: { "fixture/mixed": null },
        },
    ];
    return payload;
}

async function installPayload(page: Page, payload: Payload): Promise<void> {
    await page.route("**/api/payload.json**", (route) =>
        route.fulfill({ json: payload })
    );
}

async function expectRules(page: Page, names: string[]): Promise<void> {
    await expect
        .poll(() =>
            page
                .locator(".colorized-rule-name--button")
                .evaluateAll((elements) =>
                    elements
                        .map((element) => element.getAttribute("title"))
                        .sort()
                )
        )
        .toEqual(names.map((name) => `fixture/${name}`).sort());
}

test("state filters distinguish unconfigured, disabled, warning and overloaded rules", async ({
    page,
}) => {
    await installPayload(page, createFilterPayload());
    await page.goto("/rules");
    const state = page.getByRole("group", { name: "Rule state filter" });
    for (const [label, names] of [
        [
            "All",
            [
                "error",
                "warning",
                "off",
                "mixed",
                "unused",
            ],
        ],
        [
            "Using",
            [
                "error",
                "warning",
                "off",
                "mixed",
            ],
        ],
        ["Unused", ["unused"]],
        ["Error", ["error", "mixed"]],
        ["Warn", ["warning"]],
        ["Off", ["off", "mixed"]],
        ["Overloaded", ["mixed"]],
        ["Off Only", ["off"]],
    ] as const) {
        const option = state.getByRole("radio", { name: label, exact: true });
        await option.check();
        await expect(option).toBeChecked();
        await expectRules(page, [...names]);
    }
    await state.getByRole("radio", { name: "Using", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
        state.getByRole("radio", { name: "Unused", exact: true })
    ).toBeChecked();
    await expectRules(page, ["unused"]);
});

test("status filters compose with state and clear incompatible selections", async ({
    page,
}) => {
    await installPayload(page, createFilterPayload());
    await page.goto("/rules");
    const state = page.getByRole("group", { name: "Rule state filter" });
    const status = page.getByRole("group", { name: "Rule status filter" });
    await state.getByRole("radio", { name: "All", exact: true }).check();
    for (const [label, names] of [
        [
            "Active",
            [
                "error",
                "warning",
                "mixed",
            ],
        ],
        ["Recommended", ["warning", "unused"]],
        ["Fixable", ["error"]],
        ["Deprecated", ["off"]],
    ] as const) {
        await status.getByRole("radio", { name: label, exact: true }).check();
        await expectRules(page, [...names]);
    }
    await status.getByRole("radio", { name: "Active", exact: true }).check();
    await state.getByRole("radio", { name: "Unused", exact: true }).check();
    await expect(
        status.getByRole("radio", { name: "All", exact: true })
    ).toBeChecked();
    await expectRules(page, ["unused"]);
    await state.getByRole("radio", { name: "Using", exact: true }).check();
    await status
        .getByRole("radio", { name: "Recommended", exact: true })
        .check();
    await expect(
        state.getByRole("radio", { name: "All", exact: true })
    ).toBeChecked();
    await expectRules(page, ["warning", "unused"]);
    await state.getByRole("radio", { name: "Warn", exact: true }).check();
    await expectRules(page, ["warning"]);
});

test("rule popup keyboard actions copy the canonical name and open documentation", async ({
    page,
    context,
}) => {
    const copied: string[] = [];
    await page.exposeFunction("recordClipboardWrite", (value: string) => {
        copied.push(value);
    });
    await page.addInitScript(() => {
        const record = (value: string) =>
            (
                window as unknown as {
                    recordClipboardWrite: (value: string) => Promise<void>;
                }
            ).recordClipboardWrite(value);
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                write: async (items: ClipboardItem[]) => {
                    for (const item of items)
                        await record(
                            await (await item.getType("text/plain")).text()
                        );
                },
                writeText: record,
            },
        });
        const nativeExecCommand = document.execCommand.bind(document);
        document.execCommand = (command, showUI, value) => {
            if (command.toLowerCase() === "copy") {
                const selected = document.activeElement;
                if (selected instanceof HTMLTextAreaElement)
                    void record(selected.value);
                return true;
            }
            return nativeExecCommand(command, showUI, value);
        };
    });
    await installPayload(page, structuredClone(MOCK_PAYLOAD) as Payload);
    await context.route("https://example.com/plugin-rule", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: "<h1>Plugin documentation fixture</h1>",
        })
    );
    await page.goto("/rules");
    await page
        .getByRole("textbox", { name: "Search rules", exact: true })
        .fill(pluginRuleName);
    const trigger = page
        .locator(".colorized-rule-name--button")
        .filter({ hasText: pluginRuleName });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const popup = page
        .locator(".v-popper--theme-dropdown .v-popper__inner")
        .filter({ hasText: "Copy name" })
        .first();
    await expect(popup).toBeVisible();
    await popup.getByRole("button", { name: "Copy name", exact: true }).click();
    await expect.poll(() => copied).toEqual([pluginRuleName]);
    const docs = popup.getByRole("link", { name: "Docs", exact: true });
    await expect(docs).toHaveAttribute("rel", "noopener noreferrer");
    const opened = page.waitForEvent("popup");
    await docs.click();
    const documentation = await opened;
    await expect(documentation.getByRole("heading")).toHaveText(
        "Plugin documentation fixture"
    );
    await documentation.close();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await expect(
        page.getByText("Effective rule trace", { exact: true })
    ).toBeVisible();
});

test("rule state options switch defaults and navigate to the rule's configuration", async ({
    page,
}) => {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    payload.rules[pluginRuleName]!.defaultOptions = [
        { browsers: ["defaults"] },
    ];
    await installPayload(page, payload);
    await page.goto("/rules");
    await page
        .getByRole("textbox", { name: "Search rules", exact: true })
        .fill(pluginRuleName);
    await expect(page.locator(".colorized-rule-name--button")).toHaveCount(1);
    const trigger = page.getByRole("button", {
        name: "Set to 'error' in the 1st config item",
        exact: true,
    });
    const popup = page.locator(".rule-state-panel--popover");
    const popupRoot = page.locator(".v-popper__popper").filter({ has: popup });
    await trigger.hover();
    await expect(popup).toBeVisible();
    await popup.hover();
    const popupBounds = await popupRoot.boundingBox();
    if (!popupBounds) throw new Error("Visible rule popup has no bounds");
    await page.mouse.move(popupBounds.x + 1, popupBounds.y + 1);
    await page.mouse.move(0, 0);
    await expect(popup).toBeHidden();
    await trigger.focus();
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("last 2 chrome versions");
    const configReference = popup.getByRole("button", {
        name: /stylelint.*root.*1st.*config item/,
    });
    await expect(popupRoot).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(popup).toBeHidden();
    await trigger.focus();
    await expect(popupRoot).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(configReference).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
        popup.getByRole("button", { name: "Rule options", exact: true })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
        popup.getByRole("button", { name: "Option defaults", exact: true })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(popup.locator(".filter-hue-rotate-90")).toContainText(
        "defaults"
    );
    await expect(popup).not.toContainText("last 2 chrome versions");
    await popup
        .getByRole("button", { name: "Rule options", exact: true })
        .click();
    await expect(popup).toContainText("last 2 chrome versions");
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await trigger.focus();
    await expect(popup).toBeVisible();
    await configReference.click();
    await expect(page).toHaveURL(/\/configs\/?$/);
    await expect(
        page.getByRole("button", { name: "Clear rule filter", exact: true })
    ).toBeVisible();
    await expect(page.locator("details.flat-config-item:visible")).toHaveCount(
        1
    );
    await expect(
        page.locator("details.flat-config-item:visible")
    ).toContainText("stylelint/root");
});

test("extends searches metadata, recovers empty results and follows config references", async ({
    page,
    context,
}) => {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    Object.assign(payload.extendsInfo![1]!, {
        plugins: ["stylelint-plugin-sentinel"],
        customSyntax: "postcss-sentinel",
        directExtends: ["./base-sentinel.mjs"],
        docsUrl: "https://example.com/team-docs",
    });
    await installPayload(page, payload);
    await context.route("https://example.com/team-docs", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: "<h1>Team configuration documentation</h1>",
        })
    );
    await page.goto("/extends");
    const search = page.getByRole("textbox", {
        name: "Search extended configs",
        exact: true,
    });
    for (const term of [
        "SENTINEL",
        "postcss-sentinel",
        "Team conventions",
        "@scope/stylelint-config-team",
    ]) {
        await search.fill(term);
        const choices = page.getByTestId(testIds.extends.specifierButton);
        await expect(choices).toHaveCount(1);
        await expect(choices).toHaveText(secondaryExtendSpecifier);
        await expect(choices).toHaveAttribute("aria-pressed", "true");
    }
    await expect(
        page.getByText("./base-sentinel.mjs", { exact: true })
    ).toBeVisible();
    await expect(
        page.getByText("postcss-sentinel", { exact: true })
    ).toBeVisible();
    const opened = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Docs", exact: true }).click();
    const documentation = await opened;
    await expect(documentation.getByRole("heading")).toHaveText(
        "Team configuration documentation"
    );
    await documentation.close();
    await search.fill("definitely-absent");
    await expect(page.getByTestId(testIds.extends.specifierButton)).toHaveCount(
        0
    );
    await page
        .getByRole("button", { name: "Clear extends search", exact: true })
        .click();
    await expect(search).toHaveValue("");
    await expect(page.getByTestId(testIds.extends.specifierButton)).toHaveCount(
        2
    );
    const team = page
        .getByTestId(testIds.extends.specifierButton)
        .filter({ hasText: secondaryExtendSpecifier });
    await team.focus();
    await page.keyboard.press("Space");
    await expect(team).toHaveAttribute("aria-pressed", "true");
    await page.locator('a[href="/configs?index=2"]').click();
    await expect(page).toHaveURL(/\/configs\?index=2$/);
    await expect(page.locator("details.flat-config-item[open]")).toContainText(
        "stylelint/override-1"
    );
});

test("extends without extracted rules explain the missing data", async ({
    page,
}) => {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    payload.extendsInfo = [
        {
            specifier: "./empty-config.mjs",
            source: "local",
            rules: [],
            usedByConfigIndexes: [],
        },
    ];
    await installPayload(page, payload);
    await page.goto("/extends");
    await expect(
        page.getByText("No rules were extracted for this extends entry.")
    ).toBeVisible();
    await expect(page.getByText("unknown", { exact: true })).toBeVisible();
    await expect(
        page.getByRole("link", { name: "Docs", exact: true })
    ).toHaveCount(0);
});

test("persisted rule layout and plugin selection are reflected in Dev alongside diagnostics", async ({
    page,
}) => {
    const payload = structuredClone(MOCK_PAYLOAD) as Payload;
    payload.diagnostics = ["Could not resolve optional package metadata."];
    payload.meta.stylelintIgnore = {
        path: ".stylelintignore",
        patterns: ["generated/**", "vendor/**"],
    };
    await installPayload(page, payload);
    await page.goto("/rules");
    await page
        .getByRole("button", {
            name: "no-unsupported-browser-features",
            exact: true,
        })
        .click();
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await page.reload();
    await expect(
        page.getByRole("button", { name: "Grid", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
        page.getByRole("button", {
            name: "no-unsupported-browser-features",
            exact: true,
        })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".colorized-rule-name--button")).toHaveCount(1);
    await page.getByTestId(testIds.nav.devLink).click();
    await expect(
        page
            .locator(".dev-kv")
            .filter({ hasText: "Rules view:" })
            .locator(".dev-value")
    ).toHaveText("grid");
    await expect(
        page.getByText("rules-plugin:no-unsupported-browser-features", {
            exact: true,
        })
    ).toBeVisible();
    await expect(
        page.getByText("Inspector diagnostics (1)", { exact: true })
    ).toBeVisible();
    await expect(
        page.getByText("Could not resolve optional package metadata.", {
            exact: true,
        })
    ).toBeVisible();
    await expect(page.getByText("generated/**", { exact: true })).toBeVisible();
    await expect(page.getByText("vendor/**", { exact: true })).toBeVisible();
});
