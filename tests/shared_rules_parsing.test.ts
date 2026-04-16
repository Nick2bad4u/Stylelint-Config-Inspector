import { describe, expect, it } from "vitest";
import {
    getRuleLevel,
    getRuleOptions,
    getRulePrimaryOption,
} from "../shared/rules";

describe("rule parsing helpers", () => {
    it("normalizes disabled rule values to off", () => {
        expect(getRuleLevel(undefined)).toBe("off");
        expect(getRuleLevel(null)).toBe("off");
        expect(getRuleLevel(false)).toBe("off");
        expect(getRuleLevel(0)).toBe("off");
        expect(getRuleLevel("off")).toBe("off");
    });

    it("maps warning severities from tuple options", () => {
        expect(getRuleLevel([true, { severity: "warning" }])).toBe("warn");
        expect(getRuleLevel(["always", { severity: "warning" }])).toBe("warn");
    });

    it("maps canonical stylelint numeric and string levels", () => {
        expect(getRuleLevel(1)).toBe("warn");
        expect(getRuleLevel("warn")).toBe("warn");
        expect(getRuleLevel("warning")).toBe("warn");

        expect(getRuleLevel(2)).toBe("error");
        expect(getRuleLevel("error")).toBe("error");
    });

    it("treats non-null primary values as enabled by default", () => {
        expect(getRuleLevel(true)).toBe("error");
        expect(getRuleLevel("always")).toBe("error");
        expect(getRuleLevel(["always"])).toBe("error");
    });

    it("returns primary options only for enabled rule values", () => {
        expect(getRulePrimaryOption(false)).toBeUndefined();
        expect(getRulePrimaryOption(0)).toBeUndefined();
        expect(getRulePrimaryOption("off")).toBeUndefined();
        expect(getRulePrimaryOption(null)).toBeUndefined();
        expect(getRulePrimaryOption(undefined)).toBeUndefined();

        expect(getRulePrimaryOption(true)).toBe(true);
        expect(getRulePrimaryOption("always")).toBe("always");
    });

    it("extracts secondary options from tuple rule entries without mutating input", () => {
        const entry = [
            "always",
            { except: ["first-nested"] },
            "custom",
        ] as const;
        const options = getRuleOptions(entry);

        expect(options).toEqual([{ except: ["first-nested"] }, "custom"]);
        expect(options).not.toBe(entry);
        expect(getRuleOptions("always")).toBeUndefined();
    });
});
