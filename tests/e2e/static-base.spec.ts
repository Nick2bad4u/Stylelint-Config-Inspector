import { expect, test } from "@playwright/test";
import { testIds } from "../../shared/test-ids";
import { rewriteStaticHtmlWithBase } from "../../src/build-static-html";
import { mockPayload } from "./fixtures/mock-payload";

test.describe("static startup", () => {
    test.use({ javaScriptEnabled: false });

    test("provides the favicon before JavaScript initializes", async ({
        page,
    }) => {
        await page.goto("/");
        const icon = page.locator('head link[rel="icon"]');
        await expect(icon).toHaveAttribute(
            "href",
            /^data:image\/svg\+xml,%3Csvg/
        );
        await expect(icon).toHaveAttribute("type", "image/svg+xml");
    });
});

for (const baseURL of ["/", "/nested/inspector/"]) {
    test(`keeps hydrated icons within the deployment base ${baseURL}`, async ({
        page,
    }) => {
        const outsideBase: string[] = [];
        page.on("request", (request) => {
            const url = new URL(request.url());
            if (
                url.hostname === "127.0.0.1" &&
                !url.pathname.startsWith(baseURL)
            ) {
                outsideBase.push(url.pathname);
            }
        });

        if (baseURL !== "/") {
            // Serve the built app with the same HTML rewrite as the static CLI.
            await page.route(`**${baseURL}**`, async (route) => {
                const url = new URL(route.request().url());
                url.pathname = `/${url.pathname.slice(baseURL.length)}`;
                const response = await route.fetch({ url: url.href });
                if (response.headers()["content-type"]?.includes("text/html")) {
                    await route.fulfill({
                        response,
                        body: rewriteStaticHtmlWithBase(
                            await response.text(),
                            baseURL
                        ),
                    });
                } else {
                    await route.fulfill({ response });
                }
            });
        }

        await mockPayload(page);
        await page.goto(`${baseURL}configs`);
        await page.getByTestId(testIds.nav.rulesLink).click();
        await expect(page).toHaveURL(new RegExp(`${baseURL}rules/?$`));

        const icons = page.locator(
            'head link[rel="icon"], head link[rel="apple-touch-icon"]'
        );
        await expect(icons).toHaveCount(4);
        expect(
            await icons.evaluateAll((links) =>
                links.map((link) => link.getAttribute("href"))
            )
        ).toEqual([
            `${baseURL}favicon.svg`,
            `${baseURL}stylelint/stylelint-icon-black.svg`,
            `${baseURL}stylelint/stylelint-icon-white-512.png`,
            `${baseURL}stylelint/stylelint-icon-white-512.png`,
        ]);
        expect(outsideBase).toEqual([]);
    });
}
