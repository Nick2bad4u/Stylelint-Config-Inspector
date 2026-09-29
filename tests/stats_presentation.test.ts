import { describe, expect, it } from "vitest";
import {
    statsDisplayPlugins,
    statsPluginKey,
} from "../app/composables/stats-presentation";

describe("stats display metadata", () => {
    it("uses the existing package color key and preserves unknown namespaces", () => {
        const timing = {
            name: "plugin/rule",
            plugin: "plugin",
            timeMs: 1,
            percentage: 100,
        };
        expect(
            statsPluginKey(timing, {
                name: timing.name,
                plugin: "scss",
                pluginPackageName: "stylelint-scss",
            })
        ).toBe("stylelint-scss");
        expect(
            statsPluginKey(timing, { name: timing.name, plugin: "order" })
        ).toBe("stylelint-order");
        expect(statsPluginKey(timing)).toBe("plugin");
        expect(
            statsPluginKey({
                ...timing,
                name: "stylelint/rule",
                plugin: "stylelint",
            })
        ).toBe("stylelint");
    });

    it("groups generic namespaces by package without mutating native timing rows", () => {
        const rules = [
            {
                name: "plugin/first",
                plugin: "plugin",
                timeMs: 2,
                percentage: 50,
            },
            {
                name: "plugin/second",
                plugin: "plugin",
                timeMs: 2,
                percentage: 50,
            },
        ];
        const groups = statsDisplayPlugins(rules, {
            "plugin/first": {
                name: "plugin/first",
                plugin: "plugin",
                pluginPackageName: "stylelint-z",
            },
            "plugin/second": {
                name: "plugin/second",
                plugin: "plugin",
                pluginPackageName: "stylelint-a",
            },
        });
        expect(groups.map(({ name }) => name)).toEqual([
            "stylelint-a",
            "stylelint-z",
        ]);
        expect(groups[0]?.rules[0]).toBe(rules[1]);
        expect(rules.map(({ plugin }) => plugin)).toEqual(["plugin", "plugin"]);
    });

    it("derives percentages from time rather than rounded native row percentages", () => {
        const rules = Array.from({ length: 100 }, (_, index) => ({
            name: `small/rule-${index}`,
            plugin: "small",
            timeMs: 0.49,
            percentage: 0,
        }));
        rules.push({
            name: "large/rule",
            plugin: "large",
            timeMs: 951,
            percentage: 95.1,
        });
        const groups = statsDisplayPlugins(rules, {});
        expect(groups[1]?.percentage).toBeCloseTo(4.9);
        expect(
            statsDisplayPlugins(
                [
                    {
                        name: "zero/rule",
                        plugin: "zero",
                        timeMs: 0,
                        percentage: 0,
                    },
                ],
                {}
            )[0]?.percentage
        ).toBe(0);
    });
});
