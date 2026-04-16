import { describe, expect, it } from "vitest";
import {
    configSummarySlotCount,
    orderedNavLinkTestIds,
    testIds,
} from "../shared/test-ids";

describe("test-id contract", () => {
    it("keeps a deterministic nav test-id order", () => {
        expect(orderedNavLinkTestIds).toEqual([
            testIds.nav.configsLink,
            testIds.nav.rulesLink,
            testIds.nav.extendsLink,
            testIds.nav.filesLink,
            testIds.nav.devLink,
        ]);
    });

    it("keeps nav test IDs unique", () => {
        expect(new Set(orderedNavLinkTestIds).size).toBe(
            orderedNavLinkTestIds.length
        );
    });

    it("keeps config summary slot count stable and positive", () => {
        expect(configSummarySlotCount).toBeGreaterThan(0);
        expect(Number.isInteger(configSummarySlotCount)).toBe(true);
    });
});
