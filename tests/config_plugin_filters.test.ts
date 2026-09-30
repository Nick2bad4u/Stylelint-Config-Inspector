import { describe, expect, it } from "vitest";
import {
    configMatchesPluginFilters,
    configMatchesRulePluginFilters,
    getConfigPluginFilters,
    getConfigRulePlugins,
    getRulePluginName,
    resolveConfigPluginFilter,
    ruleMatchesPluginFilters,
    toPluginFilterCandidates,
} from "../shared/config-plugin-filters";

describe("config plugin filters", () => {
    it("matches generic rule namespaces to their actual metadata owners without leaking other plugins", () => {
        const catalog = {
            "plugin/no-browser-hacks": { plugin: "no-browser-hacks" },
            "plugin/no-unsupported-browser-features": {
                plugin: "no-unsupported-browser-features",
            },
        };
        const config = {
            index: 0,
            plugins: {
                "stylelint-no-browser-hacks": {},
                "stylelint-no-unsupported-browser-features": {},
            },
            rules: {
                "plugin/no-browser-hacks": true,
                "plugin/no-unsupported-browser-features": true,
            },
        };
        const known = Object.values(catalog).map((rule) => rule.plugin);
        const filter = resolveConfigPluginFilter(
            "stylelint-no-browser-hacks",
            known,
            getConfigRulePlugins(config, catalog)
        );
        expect(filter).toBe("no-browser-hacks");
        expect(
            ruleMatchesPluginFilters(
                "plugin/no-browser-hacks",
                [filter],
                catalog
            )
        ).toBe(true);
        expect(
            ruleMatchesPluginFilters(
                "plugin/no-unsupported-browser-features",
                [filter],
                catalog
            )
        ).toBe(false);
        expect(
            ruleMatchesPluginFilters(
                "plugin/no-browser-hacks",
                ["plugin"],
                catalog
            )
        ).toBe(false);
        expect(getConfigRulePlugins(config, catalog)).toEqual(new Set(known));
        expect(getConfigPluginFilters(config, known, catalog)).toEqual(known);
        expect(configMatchesRulePluginFilters(config, [filter], catalog)).toBe(
            true
        );
        expect(
            configMatchesPluginFilters(config, [filter], known, catalog)
        ).toBe(true);
    });
    it("falls back to native rule prefixes when metadata is missing while preserving empty selections", () => {
        const catalog = { "plugin/owned": { plugin: "owner" } };
        expect(
            ruleMatchesPluginFilters("plugin/unknown", ["plugin"], catalog)
        ).toBe(true);
        expect(
            ruleMatchesPluginFilters("plugin/unknown", ["owner"], catalog)
        ).toBe(false);
        expect(
            ruleMatchesPluginFilters(
                "@acme/layout/example",
                ["@acme/layout"],
                catalog
            )
        ).toBe(true);
        expect(ruleMatchesPluginFilters("plugin/owned", [], catalog)).toBe(
            true
        );
        expect(
            getConfigRulePlugins({ rules: { "plugin/unknown": true } }, catalog)
        ).toEqual(new Set(["plugin"]));
    });
    it("maps plugin package names to the corresponding rule plugin filter", () => {
        const knownRulePlugins = new Set(["defensive-css", "@acme/layout"]);

        expect(
            resolveConfigPluginFilter(
                "stylelint-plugin-defensive-css",
                knownRulePlugins
            )
        ).toBe("defensive-css");

        expect(
            resolveConfigPluginFilter(
                "@acme/stylelint-plugin-layout",
                knownRulePlugins
            )
        ).toBe("@acme/layout");
    });

    it("collects config plugin filters from explicit plugins and configured rule prefixes", () => {
        const knownRulePlugins = new Set(["defensive-css", "@acme/layout"]);
        const config = {
            index: 0,
            plugins: {
                "stylelint-plugin-defensive-css": {},
                "@acme/stylelint-plugin-layout": {},
            },
            rules: {
                "defensive-css/require-background-repeat": true,
                "@acme/layout/no-gap-hack": true,
                "color-no-invalid-hex": true,
            },
        };

        expect(getConfigPluginFilters(config, knownRulePlugins)).toEqual([
            "@acme/layout",
            "defensive-css",
        ]);
    });

    it("matches configs against selected plugin filters", () => {
        const knownRulePlugins = new Set(["defensive-css"]);
        const config = {
            index: 0,
            plugins: {
                "stylelint-plugin-defensive-css": {},
            },
            rules: {
                "defensive-css/require-background-repeat": true,
            },
        };

        expect(
            configMatchesPluginFilters(
                config,
                ["defensive-css"],
                knownRulePlugins
            )
        ).toBe(true);
        expect(
            configMatchesPluginFilters(config, ["stylelint"], knownRulePlugins)
        ).toBe(false);
    });

    it("matches rule names against selected plugin filters", () => {
        expect(
            ruleMatchesPluginFilters(
                "defensive-css/require-background-repeat",
                ["defensive-css"]
            )
        ).toBe(true);
        expect(
            ruleMatchesPluginFilters("@acme/layout/no-gap-hack", [
                "@acme/layout",
            ])
        ).toBe(true);
        expect(
            ruleMatchesPluginFilters("color-no-invalid-hex", ["defensive-css"])
        ).toBe(false);
    });

    it("matches config plugin filters only when the config actually declares plugin-scoped rules", () => {
        const config = {
            index: 0,
            plugins: {
                "stylelint-plugin-use-nesting": {},
            },
            rules: {
                "color-no-invalid-hex": true,
            },
        };

        expect(configMatchesRulePluginFilters(config, ["use-nesting"])).toBe(
            false
        );
    });

    it("extracts scoped plugin names from scoped rules and keeps fallback behavior for malformed scoped names", () => {
        expect(getRulePluginName("@acme/layout/no-gap-hack")).toBe(
            "@acme/layout"
        );
        expect(getRulePluginName("@acme/no-gap-hack")).toBe("@acme");
    });

    it("produces scoped plugin candidates for package names", () => {
        const candidates = toPluginFilterCandidates(
            "@acme/stylelint-plugin-layout"
        );

        expect(candidates).toContain("@acme/layout");
        expect(candidates).toContain("@acme");
        expect(candidates).toContain("layout");
    });

    it("falls back to config rule plugin names when known plugins are not pre-populated", () => {
        expect(
            resolveConfigPluginFilter(
                "@acme/stylelint-plugin-layout",
                [],
                ["@acme/layout"]
            )
        ).toBe("@acme/layout");
    });

    it("treats empty plugin selection as a pass-through for config filtering", () => {
        const config = {
            index: 0,
            plugins: {
                "stylelint-plugin-defensive-css": {},
            },
            rules: {
                "defensive-css/require-background-repeat": true,
            },
        };

        expect(configMatchesPluginFilters(config, [], ["defensive-css"])).toBe(
            true
        );
    });
});
