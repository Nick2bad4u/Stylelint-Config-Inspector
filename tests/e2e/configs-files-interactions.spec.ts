import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { testIds } from "../../shared/test-ids";
import {
    MOCK_PAYLOAD,
    mockPayload,
    pluginRuleName,
} from "./fixtures/mock-payload";

function configCards(page: Page) {
    return page.locator("details[data-config-item-index]:visible");
}

test.describe("Configs and Files interactions", () => {
    test.beforeEach(async ({ page }) => {
        await mockPayload(page);
    });

    test("filepath suggestions support keyboard selection and individual clearing", async ({
        page,
    }) => {
        await page.goto("/configs");
        const input = page.getByRole("textbox", {
            name: "Test matching with filepath",
        });
        await input.fill("src/");
        await expect(input).toHaveAttribute("aria-expanded", "true");
        await input.press("ArrowDown");
        await input.press("Enter");
        await expect(input).toHaveValue("src/legacy.css");
        await expect(input).toHaveAttribute("aria-expanded", "false");
        await expect(configCards(page)).toHaveCount(2);
        await page
            .getByRole("button", { name: "Clear filepath filter" })
            .click();
        await expect(input).toHaveValue("");
        await expect(configCards(page)).toHaveCount(3);

        await input.fill("src/");
        await expect(input).toHaveAttribute("aria-expanded", "true");
        await input.press("Escape");
        await expect(input).toHaveAttribute("aria-expanded", "false");
        await expect(input).toHaveValue("src/");
    });

    test("plugin selection filters configs and can be toggled off independently", async ({
        page,
    }) => {
        await page.goto("/configs");
        const plugin = page.getByRole("button", {
            name: "stylelint-no-unsupported-browser-features",
            exact: true,
        });
        await plugin.click();
        await expect(plugin).toHaveAttribute("aria-pressed", "true");
        await expect(configCards(page)).toHaveCount(1);
        await expect(configCards(page).first()).toContainText("stylelint/root");
        await expect(
            configCards(page)
                .first()
                .locator(
                    `button.colorized-rule-name[title="${pluginRuleName}"]`
                )
        ).toBeVisible();
        await expect(
            configCards(page)
                .first()
                .locator(
                    'button.colorized-rule-name[title="stylelint/color-hex-length"]'
                )
        ).toHaveCount(0);
        await plugin.click();
        await expect(plugin).toHaveAttribute("aria-pressed", "false");
        await expect(configCards(page)).toHaveCount(3);
        await expect(
            page.getByRole("button", { name: "All plugins", exact: true })
        ).toHaveAttribute("aria-pressed", "true");
    });

    test("config rule popup filters to its rule and exposes a clear action", async ({
        page,
    }) => {
        await page.goto("/configs");
        const root = configCards(page).first();
        await root
            .locator(`button.colorized-rule-name[title="${pluginRuleName}"]`)
            .click();
        await page
            .getByRole("button", { name: "Filter by this rule", exact: true })
            .click();
        await expect(configCards(page)).toHaveCount(1);
        await expect(
            root.locator(
                'button.colorized-rule-name[title="stylelint/color-hex-length"]'
            )
        ).toHaveCount(0);
        await expect(
            page.getByRole("button", { name: "Clear rule filter" })
        ).toBeVisible();
        await root
            .getByRole("button", { name: /others rules are hidden/ })
            .click();
        await expect(configCards(page)).toHaveCount(3);
        await expect(
            root.locator(
                'button.colorized-rule-name[title="stylelint/color-hex-length"]'
            )
        ).toBeVisible();
    });

    test("selected config layout persists through reload and all cards expand or collapse", async ({
        page,
    }) => {
        await page.goto("/configs");
        const list = page.getByRole("button", { name: "List", exact: true });
        const grid = page.getByRole("button", { name: "Grid", exact: true });
        await list.click();
        await expect(list).toHaveAttribute("aria-pressed", "true");
        await expect(grid).toHaveAttribute("aria-pressed", "false");
        await page.reload();
        await expect(list).toHaveAttribute("aria-pressed", "true");
        await grid.click();
        await expect(grid).toHaveAttribute("aria-pressed", "true");
        await page
            .getByRole("button", { name: "Collapse All", exact: true })
            .click();
        await expect(
            page.locator("details[data-config-item-index][open]")
        ).toHaveCount(0);
        await page
            .getByRole("button", { name: "Expand All", exact: true })
            .click();
        await expect(
            page.locator("details[data-config-item-index][open]")
        ).toHaveCount(3);
    });

    test("file match modes select their named view and remain selected on repeated clicks", async ({
        page,
    }) => {
        await page.goto("/configs");
        await page
            .getByRole("textbox", { name: "Test matching with filepath" })
            .fill("src/example.css");
        const matched = page.getByRole("button", {
            name: "Matched Config Items",
            exact: true,
        });
        const merged = page.getByRole("button", {
            name: "Merged Rules",
            exact: true,
        });
        await expect(matched).toHaveAttribute("aria-pressed", "true");
        await expect(merged).toHaveAttribute("aria-pressed", "false");
        await matched.click();
        await expect(matched).toHaveAttribute("aria-pressed", "true");
        await expect(configCards(page)).toHaveCount(2);
        await matched.click();
        await expect(matched).toHaveAttribute("aria-pressed", "true");
        await expect(configCards(page)).toHaveCount(2);
        const specificOnly = page.getByRole("checkbox", {
            name: "Show Specific Rules Only",
        });
        await specificOnly.check();
        await expect(configCards(page)).toHaveCount(1);
        await expect(configCards(page).first()).toContainText(
            "stylelint/override-1"
        );
        await specificOnly.uncheck();
        await expect(configCards(page)).toHaveCount(2);
        await merged.click();
        await expect(merged).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByText("Merged Rules: Specific to matched file (1 rules)")
        ).toBeVisible();
        await expect(configCards(page)).toHaveCount(0);
        await merged.click();
        await expect(merged).toHaveAttribute("aria-pressed", "true");
        await expect(configCards(page)).toHaveCount(0);
        await page.reload();
        await expect(merged).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByText("Merged Rules: Specific to matched file (1 rules)")
        ).toBeVisible();
    });

    test("merged rule sections respond to Expand All and Collapse All", async ({
        page,
    }) => {
        await page.addInitScript(() =>
            localStorage.setItem(
                "stateStorage",
                JSON.stringify({
                    viewFileMatchType: "merged",
                    filtersConfigs: { filepath: "src/example.css" },
                })
            )
        );
        await page.goto("/configs");
        const sections = page.locator("main details.flat-config-item");
        await expect(sections).toHaveCount(2);
        await page
            .getByRole("button", { name: "Expand All", exact: true })
            .click();
        await expect(
            page.locator("main details.flat-config-item[open]")
        ).toHaveCount(2);
        await page
            .getByRole("button", { name: "Collapse All", exact: true })
            .click();
        await expect(
            page.locator("main details.flat-config-item[open]")
        ).toHaveCount(0);
    });

    test("config summary options button opens collapsed metadata and its disclosure toggles", async ({
        page,
    }) => {
        const payload = structuredClone(MOCK_PAYLOAD);
        Object.assign(payload.configs[0]!, { defaultSeverity: "warning" });
        await mockPayload(page, payload);
        await page.goto("/configs");
        const root = configCards(page).first();
        await page
            .getByRole("button", { name: "Collapse All", exact: true })
            .click();
        await root
            .getByRole("button", { name: "Options: 1", exact: true })
            .click();
        await expect(root).toHaveAttribute("open", "");
        await expect(
            root.getByText("defaultSeverity:", { exact: true })
        ).toBeVisible();
        await expect(
            root.getByText("'warning'", { exact: true })
        ).toBeVisible();
        await root
            .getByRole("button", {
                name: "Additional configurations (1)",
                exact: true,
            })
            .click();
        await expect(
            root.getByText("defaultSeverity:", { exact: true })
        ).toHaveCount(0);
    });

    test("config glob popup lists matching files and a file navigates into matching configs", async ({
        page,
    }) => {
        await page.goto("/configs");
        await configCards(page)
            .nth(1)
            .getByRole("button", { name: "**/*.css", exact: true })
            .click();
        const popup = page
            .locator(".v-popper--theme-dropdown .v-popper__inner")
            .filter({ hasText: "Files that matches this glob" });
        await expect(
            popup.getByRole("button", { name: "src/example.css", exact: true })
        ).toBeVisible();
        await popup
            .getByRole("button", { name: "src/legacy.css", exact: true })
            .click();
        await expect(
            page.getByRole("textbox", { name: "Test matching with filepath" })
        ).toHaveValue("src/legacy.css");
        await expect(configCards(page)).toHaveCount(2);
        await expect(popup).not.toBeVisible();
    });

    test("Files groups expand and collapse together and mode persists after reload", async ({
        page,
    }) => {
        await page.goto("/files");
        const groups = page.locator("details.flat-config-item");
        await expect(groups).toHaveCount(3);
        await page
            .getByRole("button", { name: "Collapse All", exact: true })
            .click();
        await expect(
            page.locator("details.flat-config-item[open]")
        ).toHaveCount(0);
        await page
            .getByRole("button", { name: "Expand All", exact: true })
            .click();
        await expect(
            page.locator("details.flat-config-item[open]")
        ).toHaveCount(3);
        await page.getByTestId(testIds.files.viewListButton).click();
        await page.reload();
        await expect(
            page.getByTestId(testIds.files.viewListButton)
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByTestId(testIds.files.matchedListDetails)
        ).toContainText("src/example.css");
        await expect(
            page.getByRole("button", { name: "Expand All", exact: true })
        ).toHaveCount(0);
    });

    test("Files list selection clears incompatible rule/plugin filters and opens matching configs", async ({
        page,
    }) => {
        await page.goto("/configs");
        await configCards(page)
            .first()
            .locator(`button.colorized-rule-name[title="${pluginRuleName}"]`)
            .click();
        await page
            .getByRole("button", { name: "Filter by this rule", exact: true })
            .click();
        await page
            .getByRole("button", {
                name: "stylelint-no-unsupported-browser-features",
                exact: true,
            })
            .click();
        await page.getByTestId(testIds.nav.filesLink).click();
        await page.getByTestId(testIds.files.viewListButton).click();
        await page
            .getByRole("button", { name: "src/example.css", exact: true })
            .click();
        await expect(page).toHaveURL(/\/configs\/?$/);
        await expect(
            page.getByRole("textbox", { name: "Test matching with filepath" })
        ).toHaveValue("src/example.css");
        await expect(
            page.getByRole("button", { name: "All plugins", exact: true })
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByRole("button", { name: "Clear rule filter" })
        ).toHaveCount(0);
        await expect(configCards(page)).toHaveCount(2);
    });

    test("Files config popup navigates to and opens the referenced config", async ({
        page,
    }) => {
        await page.goto("/files");
        await page
            .getByRole("button", { name: "stylelint/override-1", exact: true })
            .first()
            .click();
        await page
            .getByRole("button", { name: "Go to this config", exact: true })
            .click();
        await expect(page).toHaveURL(/\/configs\?index=2$/);
        await expect(
            page.locator('details[data-config-item-index="1"]')
        ).toHaveAttribute("open", "");
        await expect(
            page.locator("details[data-config-item-index][open]")
        ).toHaveCount(1);
        await expect(
            page
                .locator('details[data-config-item-index="1"]')
                .getByText("Applies to files matching", { exact: true })
        ).toBeVisible();
    });

    test("unmatched configs recover through their empty-state clear action", async ({
        page,
    }) => {
        const payload = structuredClone(MOCK_PAYLOAD);
        Object.assign(payload.configs[0]!, { files: ["**/*.scss"] });
        await mockPayload(page, payload);
        await page.goto("/configs");
        await page
            .getByRole("textbox", { name: "Test matching with filepath" })
            .fill("outside/project.txt");
        await expect(
            page.getByText("No matched config items", { exact: true })
        ).toBeVisible();
        await expect(configCards(page)).toHaveCount(0);
        await page
            .getByRole("button", { name: "Clear config filters", exact: true })
            .click();
        await expect(configCards(page)).toHaveCount(3);
    });
});
