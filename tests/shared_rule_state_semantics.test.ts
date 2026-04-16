import type { RuleConfigState } from "../shared/types";
import { describe, expect, it } from "vitest";
import {
    getRulePrimaryOption,
    isRuleConfigured,
    isRuleEnabled,
} from "../shared/rules";

describe("rule state semantics", () => {
    it("treats unconfigured rules as not configured and not enabled", () => {
        expect(isRuleConfigured(undefined)).toBe(false);
        expect(isRuleEnabled(undefined)).toBe(false);
    });

    it("treats off-only configured rules as configured but not enabled", () => {
        const states: RuleConfigState[] = [
            { name: "color-no-invalid-hex", configIndex: 0, level: "off" },
        ];

        expect(isRuleConfigured(states)).toBe(true);
        expect(isRuleEnabled(states)).toBe(false);
    });

    it("treats warn/error rules as enabled", () => {
        const states: RuleConfigState[] = [
            { name: "color-no-invalid-hex", configIndex: 0, level: "warn" },
        ];

        expect(isRuleConfigured(states)).toBe(true);
        expect(isRuleEnabled(states)).toBe(true);
    });

    it("treats mixed off+enabled states as enabled", () => {
        const states: RuleConfigState[] = [
            { name: "color-no-invalid-hex", configIndex: 0, level: "off" },
            { name: "color-no-invalid-hex", configIndex: 1, level: "error" },
        ];

        expect(isRuleConfigured(states)).toBe(true);
        expect(isRuleEnabled(states)).toBe(true);
    });

    it("extracts primary options for enabled rule entries and omits disabled values", () => {
        expect(getRulePrimaryOption("0,3,0")).toBe("0,3,0");
        expect(getRulePrimaryOption(["always", { severity: "warning" }])).toBe(
            "always"
        );
        expect(
            getRulePrimaryOption([null, { except: ["foo"] }])
        ).toBeUndefined();
        expect(getRulePrimaryOption(null)).toBeUndefined();
    });
});
