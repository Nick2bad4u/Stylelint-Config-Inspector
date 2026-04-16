import type { FilesGroup, Payload, ResolvedPayload } from "../shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { DEFAULT_WORKSPACE_SCAN_GLOBS } from "../shared/configs";

const configsOpenStateMock = ref<boolean[]>([]);
const fileGroupsOpenStateMock = ref<boolean[]>([]);

vi.mock("../app/composables/state", () => ({
    configsOpenState: configsOpenStateMock,
    fileGroupsOpenState: fileGroupsOpenStateMock,
}));

vi.mock("~~/shared/configs", async () => await import("../shared/configs"));
vi.mock("~~/shared/rules", async () => await import("../shared/rules"));

const { resolvePayload } = await import("../app/composables/payload");

function createBasePayload(configCount = 1): Payload {
    return {
        meta: {
            lastUpdate: Date.now(),
            basePath: process.cwd(),
            configPath: "stylelint.config.mjs",
            engine: "stylelint",
        },
        configs: Array.from({ length: configCount }, (_, index) => ({
            index,
            rules: {},
        })),
        rules: {},
    };
}

describe("resolvePayload", () => {
    beforeEach(() => {
        configsOpenStateMock.value = [];
        fileGroupsOpenStateMock.value = [];
    });

    it("sets configs open state to expanded when there are fewer than ten configs", () => {
        const payload = createBasePayload(3);

        const resolved = resolvePayload(payload);

        expect(resolved.filesResolved).toBeUndefined();
        expect(configsOpenStateMock.value).toEqual([
            true,
            true,
            true,
        ]);
    });

    it("collapses config cards by default when there are ten or more configs", () => {
        const payload = createBasePayload(10);

        resolvePayload(payload);

        expect(configsOpenStateMock.value).toEqual(
            Array.from({ length: 10 }).fill(false)
        );
    });

    it("normalizes rule state levels, primary options, and tuple options", () => {
        const payload: Payload = {
            ...createBasePayload(1),
            configs: [
                {
                    index: 0,
                    rules: {
                        "stylelint/color-hex-length": "short",
                        "stylelint/block-no-empty": [
                            true,
                            { severity: "warning" },
                            { ignore: ["comments"] },
                        ],
                        "stylelint/custom-off": false,
                    },
                },
            ],
        };

        const resolved = resolvePayload(payload);

        expect(resolved.ruleToState.get("stylelint/color-hex-length")).toEqual([
            {
                name: "stylelint/color-hex-length",
                configIndex: 0,
                level: "error",
                primaryOption: "short",
                options: undefined,
            },
        ]);

        expect(resolved.ruleToState.get("stylelint/block-no-empty")).toEqual([
            {
                name: "stylelint/block-no-empty",
                configIndex: 0,
                level: "warn",
                primaryOption: true,
                options: [{ severity: "warning" }, { ignore: ["comments"] }],
            },
        ]);

        expect(resolved.ruleToState.get("stylelint/custom-off")).toEqual([
            {
                name: "stylelint/custom-off",
                configIndex: 0,
                level: "off",
                primaryOption: undefined,
                options: undefined,
            },
        ]);
    });

    it("builds extends info and glob maps from config files and ignores", () => {
        const payload: Payload = {
            ...createBasePayload(2),
            configs: [
                {
                    index: 0,
                    files: ["src/**/*.css"],
                    ignores: ["dist/**"],
                    rules: {},
                },
                {
                    index: 1,
                    files: ["src/**/*.css", "packages/**/*.scss"],
                    rules: {},
                },
            ],
            extendsInfo: [
                {
                    specifier: "stylelint-config-recommended",
                    source: "package",
                    ruleCount: 1,
                    rules: ["stylelint/color-hex-length"],
                    usedByConfigIndexes: [0],
                },
            ],
        };

        const resolved = resolvePayload(payload);

        expect(
            resolved.extendsInfoMap.get("stylelint-config-recommended")?.source
        ).toBe("package");
        expect(
            resolved.globToConfigs
                .get("src/**/*.css")
                ?.map((config) => config.index)
        ).toEqual([0, 1]);
        expect(
            resolved.globToConfigs.get("dist/**")?.map((config) => config.index)
        ).toEqual([0]);
        expect(
            resolved.globToConfigs
                .get("packages/**/*.scss")
                ?.map((config) => config.index)
        ).toEqual([1]);
    });

    it("creates matched, declared, and default file groups from payload files and config globs", () => {
        const payload: Payload = {
            ...createBasePayload(4),
            configs: [
                {
                    index: 0,
                    name: "general-root",
                    rules: {
                        "stylelint/color-hex-length": "short",
                    },
                },
                {
                    index: 1,
                    name: "src-css",
                    files: ["src/**/*.css", "src/unused/**/*.css"],
                    rules: {
                        "stylelint/alpha-value-notation": "percentage",
                    },
                },
                {
                    index: 2,
                    name: "ignore-only",
                    ignores: ["dist/**"],
                },
                {
                    index: 3,
                    name: "scss-override",
                    files: ["packages/**/*.scss"],
                    rules: {
                        "stylelint/at-rule-no-unknown": true,
                    },
                },
            ],
            files: [
                {
                    filepath: "src/app.css",
                    globs: ["src/**/*.css", "!src/excluded/**"],
                    configs: [0, 1],
                },
                {
                    filepath: "src/other.css",
                    globs: ["src/**/*.css"],
                    configs: [0, 1],
                },
                {
                    filepath: "src/general.css",
                    globs: [],
                    configs: [0],
                },
            ],
        };

        const resolved = resolvePayload(payload);
        const filesResolved = resolved.filesResolved;

        expect(filesResolved).toBeDefined();

        if (!filesResolved) throw new Error("Expected filesResolved data");

        const groupsById = new Map<string, FilesGroup>(
            filesResolved.groups.map((group) => [group.id, group] as const)
        );

        expect(groupsById.get("configs:1")?.kind).toBe("matched");
        expect(groupsById.get("configs:1")?.files).toEqual([
            "src/app.css",
            "src/other.css",
        ]);

        expect(groupsById.get("globs:<general>")?.kind).toBe("matched");
        expect(groupsById.get("globs:<general>")?.files).toEqual([
            "src/general.css",
        ]);

        expect(groupsById.get("declared-glob:src/unused/**/*.css")?.kind).toBe(
            "declared"
        );
        expect(groupsById.get("declared-glob:packages/**/*.scss")?.kind).toBe(
            "declared"
        );

        const defaultGroup = groupsById.get(
            `default-scan:${DEFAULT_WORKSPACE_SCAN_GLOBS[0]}`
        );
        expect(defaultGroup?.kind).toBe("default");
        expect(defaultGroup?.configs.map((config) => config.index)).toEqual([
            0,
        ]);

        expect(
            filesResolved.fileToConfigs
                .get("src/app.css")
                ?.map((config) => config.index)
        ).toEqual([0, 1]);

        expect(fileGroupsOpenStateMock.value).toEqual(
            filesResolved.groups.map(() => true)
        );
    });

    it("does not create declared/default groups when those globs already have matched files", () => {
        const matchedDefaultGlob = DEFAULT_WORKSPACE_SCAN_GLOBS[0]!;
        const payload: Payload = {
            ...createBasePayload(3),
            configs: [
                {
                    index: 0,
                    name: "general-root",
                    rules: {
                        "stylelint/color-hex-length": "short",
                    },
                },
                {
                    index: 1,
                    name: "declared-css",
                    files: ["src/**/*.css"],
                    rules: {
                        "stylelint/alpha-value-notation": "percentage",
                    },
                },
                {
                    index: 2,
                    name: "ignore-only",
                    ignores: ["dist/**"],
                },
            ],
            files: [
                {
                    filepath: "src/real.css",
                    globs: ["src/**/*.css"],
                    configs: [0, 1],
                },
                {
                    filepath: "src/scan-hit.css",
                    globs: [matchedDefaultGlob],
                    configs: [0],
                },
            ],
        };

        const resolved = resolvePayload(payload) as ResolvedPayload;
        const groupsById = new Map(
            (resolved.filesResolved?.groups ?? []).map(
                (group) => [group.id, group] as const
            )
        );

        expect(groupsById.has("declared-glob:src/**/*.css")).toBe(false);
        expect(groupsById.has(`default-scan:${matchedDefaultGlob}`)).toBe(
            false
        );
    });
});
