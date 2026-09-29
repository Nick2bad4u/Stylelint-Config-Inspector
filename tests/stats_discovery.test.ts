import { describe, expect, it, vi } from "vitest";
import {
    collectWorkspaceScanConfigs,
    discoverWorkspaceFiles,
} from "../src/inspectors/stylelint";

const { glob } = vi.hoisted(() => ({ glob: vi.fn() }));
vi.mock("tinyglobby", () => ({ glob }));

describe("profiling workspace discovery", () => {
    it("keeps all files beyond the UI display limit in deterministic order", async () => {
        const files = Array.from(
            { length: 5001 },
            (_, index) => `styles/${String(5000 - index).padStart(4, "0")}.css`
        );
        glob.mockResolvedValueOnce(files);
        const discovered = await discoverWorkspaceFiles(
            [{ index: 0, rules: {} }],
            "/workspace"
        );
        expect(discovered.files).toHaveLength(5001);
        expect(discovered.files[0]).toBe("styles/0000.css");
        expect(discovered.files.at(-1)).toBe("styles/5000.css");
        expect(discovered.diagnostics.join(" ")).not.toContain("truncated");
    });
    it("includes inline-extended overrides and anchors globs to the root config directory", async () => {
        const configs = await collectWorkspaceScanConfigs(
            {
                rules: {},
                extends: [
                    {
                        overrides: [
                            {
                                files: ["*.md", "content/*.litcss"],
                                rules: { "color-named": "never" },
                            },
                        ],
                    },
                ],
            },
            "/workspace",
            "/workspace/configs"
        );
        expect(configs.flatMap((config) => config.files ?? [])).toEqual([
            "**/*.md",
            "configs/content/*.litcss",
        ]);
    });
});
