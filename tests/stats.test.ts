import type { StatsReport } from "../shared/stats";
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
    collectStats,
    createStatsManager,
    UnsupportedStatsVersionError,
} from "../src/stats/index";
import {
    aggregatePluginTimings,
    isSupportedStatsVersion,
    parseTimingOutput,
} from "../src/stats/timing";

const table = (rows: string[]): string =>
    [
        "╔══════╗",
        "║ # │ Rule │ Time (ms) │ Relative ║",
        ...rows,
        "╚══════╝",
    ].join("\r\n");
const report: StatsReport = {
    rules: [],
    plugins: [],
    durationMs: 1,
    ruleTimeMs: 0,
    filesLinted: 0,
    errors: 0,
    warnings: 0,
    analyzedAt: "2026-09-28T00:00:00.000Z",
    scope: "Workspace",
    stylelintVersion: "17.14.1",
    configRevision: 1,
    diagnostics: [],
};

describe("native timing parser", () => {
    it("normalizes core rules, preserves plugin namespaces, sorts ties and accepts ANSI/logging", () => {
        const result = parseTimingOutput(
            `a plugin log\n\u001B[32m${table([
                "║ 1 │ z/rule │ 0.001 │ 50.0% ║",
                "║ 2 │ color-named │ 0.001 │ 50.0% ║",
                "║ 3 │ @scope/plugin/zero │ 0.000 │ 0.0% ║",
            ])}\u001B[0m`
        );
        expect(result.map((rule) => rule.name)).toEqual([
            "stylelint/color-named",
            "z/rule",
            "@scope/plugin/zero",
        ]);
        expect(result[2]?.plugin).toBe("@scope/plugin");
        expect(
            aggregatePluginTimings(result).map((plugin) => plugin.name)
        ).toEqual([
            "stylelint",
            "z",
            "@scope/plugin",
        ]);
    });
    it("supports a header-only empty table", () => {
        expect(parseTimingOutput(table([]))).toEqual([]);
    });
    it.each([
        "no table",
        table(["║ 1 │ bad │ NaN │ 20% ║"]),
        table(["║ 1 │ bad │ 1 │ 101% ║"]),
        table(["║ bad │ color-named │ 1.000 │ 100.0% ║"]),
        table(["║ │ color-named │ 1.000 │ 100.0% ║"]),
        table(["║ 1 │ bad │ 1 │ 50% ║", "║ 2 │ bad │ 1 │ 50% ║"]),
    ])("rejects unusable timings: %s", (output) => {
        expect(() => parseTimingOutput(output)).toThrow();
    });
    it("ignores unrelated bordered logs outside the timing table", () => {
        expect(
            parseTimingOutput(
                `║ plugin startup │ ready ║\n${table(["║ 1 │ color-named │ 1.000 │ 100.0% ║"])}\n║ plugin shutdown │ done ║`
            )
        ).toHaveLength(1);
    });
    it("aggregates plugin percentages from reported time instead of rounded percentages", () => {
        const rules = parseTimingOutput(
            table([
                "║ 1 │ slow/rule │ 951.000 │ 95.1% ║",
                ...Array.from(
                    { length: 100 },
                    (_, index) =>
                        `║ ${index + 2} │ many/rule${index} │ 0.490 │ 0.0% ║`
                ),
            ])
        );
        const plugins = aggregatePluginTimings(rules);
        expect(
            plugins.find((plugin) => plugin.name === "many")?.percentage
        ).toBeCloseTo(4.9);
        expect(
            plugins.find((plugin) => plugin.name === "slow")?.percentage
        ).toBeCloseTo(95.1);
        expect(
            aggregatePluginTimings([
                { name: "zero/rule", plugin: "zero", timeMs: 0, percentage: 0 },
            ])[0]?.percentage
        ).toBe(0);
    });
    it.each([
        ["16.12.0", false],
        ["16.13.0", true],
        ["17.14.1", true],
        ["18.0.0", false],
        ["unknown", false],
    ])("checks supported version %s", (version, supported) => {
        expect(isSupportedStatsVersion(String(version))).toBe(supported);
    });
});

describe("analysis lifecycle", () => {
    it("shares an active run, retains results on failure, and marks changes during runs stale", async () => {
        let complete: (value: StatsReport) => void = () => {};
        const run = vi.fn(
            () =>
                new Promise<StatsReport>((done) => {
                    complete = done;
                })
        );
        const manager = createStatsManager(
            { cwd: "." },
            { getConfigRevision: () => 1, run }
        );
        const first = manager.run();
        expect(manager.getState().status).toBe("running");
        expect(manager.run()).toBe(first);
        await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
        manager.markStale();
        complete(report);
        expect((await first).stale).toBe(true);
        run.mockRejectedValueOnce(new Error("retry me"));
        expect(await manager.run()).toMatchObject({
            status: "error",
            report,
            error: "retry me",
        });
    });
    it("aborts shutdown and distinguishes unsupported versions", async () => {
        const run = vi.fn(async (_options, settings) => {
            await new Promise((_done, reject) =>
                settings.signal.addEventListener("abort", () =>
                    reject(new Error("cancelled"))
                )
            );
            return report;
        });
        const manager = createStatsManager(
            { cwd: "." },
            { getConfigRevision: () => 1, run }
        );
        const pending = manager.run();
        await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
        manager.close();
        expect((await pending).status).toBe("error");
        const unsupported = createStatsManager(
            { cwd: "." },
            {
                getConfigRevision: () => 1,
                run: async () => {
                    throw new UnsupportedStatsVersionError("old");
                },
            }
        );
        expect((await unsupported.run()).status).toBe("unsupported");
    });
});

describe("real Stylelint profiling", () => {
    let project: string;
    let workerPath: string;
    beforeAll(async () => {
        project = await mkdtemp(join(tmpdir(), "inspector-stats-test-"));
        await symlink(
            resolve("node_modules"),
            join(project, "node_modules"),
            "junction"
        );
        workerPath = join(project, "stats-worker.mjs");
        await build({
            entryPoints: ["src/stats/worker.ts"],
            outfile: workerPath,
            bundle: true,
            packages: "external",
            platform: "node",
            format: "esm",
            logLevel: "silent",
        });
    });
    afterAll(async () => {
        if (project) await rm(project, { recursive: true, force: true });
    });

    it("preserves source/cache, applies overrides and ignores, and reports lint violations", async () => {
        await writeFile(
            join(project, "stylelint.config.mjs"),
            "export default { fix: true, cache: true, cacheLocation: '.stylelintcache', suppressAll: true, suppressRule: ['color-hex-length'], suppressLocation: '.stylelint-suppressions.json', rules: { 'color-hex-length': 'short' }, overrides: [{files:['override.css'],rules:{'color-hex-length':null}}] }"
        );
        await writeFile(join(project, ".stylelintignore"), "ignored.css\n");
        const source = "a { color: #ffffff }";
        await writeFile(join(project, "main.css"), source);
        await writeFile(join(project, "override.css"), source);
        await writeFile(join(project, "ignored.css"), source);
        await writeFile(join(project, ".stylelintcache"), "keep cache");
        const result = await collectStats(
            {
                cwd: project,
                globMatchedFiles: false,
                targetFilePath: "override.css",
            },
            { configRevision: 42, workerPath }
        );
        expect(result).toMatchObject({
            filesLinted: 2,
            errors: 1,
            warnings: 0,
            configRevision: 42,
        });
        expect(
            result.rules.some(
                (rule) => rule.name === "stylelint/color-hex-length"
            )
        ).toBe(true);
        expect(await readFile(join(project, "main.css"), "utf8")).toBe(source);
        expect(await readFile(join(project, ".stylelintcache"), "utf8")).toBe(
            "keep cache"
        );
        await expect(
            readFile(join(project, ".stylelint-suppressions.json"), "utf8")
        ).rejects.toMatchObject({ code: "ENOENT" });
        expect(JSON.stringify(result)).not.toContain(project);
    });
    it("reports plugin resolution failures", async () => {
        await writeFile(
            join(project, "stylelint.config.mjs"),
            "export default {plugins:['missing-plugin-for-stats-test'],rules:{}}"
        );
        await expect(
            collectStats({ cwd: project }, { configRevision: 1, workerPath })
        ).rejects.toThrow(/missing-plugin-for-stats-test/u);
    });
    it("profiles extended configs, plugin rules, and custom syntax", async () => {
        await writeFile(
            join(project, "base.mjs"),
            "export default {rules:{'color-hex-length':'short'},fix:true,overrides:[{files:['*.litcss'],rules:{'color-named':'never'}}]}"
        );
        await writeFile(
            join(project, "plugin.mjs"),
            "import stylelint from 'stylelint'; const rule = () => (root, result) => {stylelint.utils.report({message:'Plugin warning',node:root,result,ruleName:'fixture/demo'})}; rule.ruleName='fixture/demo'; export default stylelint.createPlugin('fixture/demo',rule)"
        );
        await writeFile(
            join(project, "syntax.mjs"),
            "import postcss from 'postcss'; export const parse=(css, options)=>postcss.parse(css.replace('MAGIC', 'a'), options); export const stringify=postcss.stringify"
        );
        await writeFile(
            join(project, "stylelint.config.mjs"),
            "export default {extends:['./base.mjs'],plugins:['./plugin.mjs'],customSyntax:'./syntax.mjs',rules:{'fixture/demo':[true,{severity:'warning'}]},overrides:[{files:['main.css'],fix:true}]}"
        );
        await writeFile(join(project, "main.css"), "MAGIC {color: #ffffff}");
        await mkdir(join(project, "nested"), { recursive: true });
        await writeFile(
            join(project, "nested", "component.litcss"),
            "MAGIC {color: red}"
        );
        const result = await collectStats(
            { cwd: project },
            { configRevision: 2, workerPath }
        );
        expect(result.rules.map((rule) => rule.name)).toEqual(
            expect.arrayContaining([
                "fixture/demo",
                "stylelint/color-hex-length",
            ])
        );
        expect(result.warnings).toBeGreaterThan(0);
        expect(result.filesLinted).toBe(3);
        expect(result.errors).toBeGreaterThan(0);
        expect(await readFile(join(project, "main.css"), "utf8")).toBe(
            "MAGIC {color: #ffffff}"
        );
    });
    it("supports empty projects and empty rule configurations", async () => {
        await writeFile(
            join(project, "stylelint.config.mjs"),
            "export default {rules:{}}"
        );
        const emptyRules = await collectStats(
            { cwd: project },
            { configRevision: 1, workerPath }
        );
        expect(emptyRules.rules).toEqual([]);
        await Promise.all(
            [
                "main.css",
                "override.css",
                "ignored.css",
            ].map((file) => rm(join(project, file)))
        );
        const empty = await collectStats(
            { cwd: project },
            { configRevision: 1, workerPath }
        );
        expect(empty).toMatchObject({ filesLinted: 0, rules: [], plugins: [] });
    });
    it("reports parse failures without requiring rule timings", async () => {
        await writeFile(
            join(project, "stylelint.config.mjs"),
            "export default {rules:{'color-hex-length':'short'}}"
        );
        await writeFile(join(project, "malformed.css"), "a { color:");
        const result = await collectStats(
            { cwd: project },
            { configRevision: 1, workerPath }
        );
        expect(result.filesLinted).toBe(1);
        expect(result.errors).toBeGreaterThan(0);
        expect(result.rules).toEqual([]);
    });
    it("reports malformed configuration", async () => {
        await writeFile(
            join(project, "stylelint.config.mjs"),
            "export default null"
        );
        await expect(
            collectStats(
                { cwd: project, userConfigPath: "stylelint.config.mjs" },
                { configRevision: 1, workerPath }
            )
        ).rejects.toThrow(/configuration|config object/u);
    });
    it("discovers custom extensions from legacy YAML and nested config-relative extends", async () => {
        await mkdir(join(project, "configs", "content"), { recursive: true });
        await writeFile(
            join(project, "configs", "base.yaml"),
            "rules: {}\noverrides:\n  - files: ['content/*.customstyle']\n    rules:\n      color-named: never\n"
        );
        await writeFile(
            join(project, "configs", ".stylelintrc"),
            "extends: ['./base.yaml']\n"
        );
        await writeFile(
            join(project, "configs", "content", "example.customstyle"),
            "a {color: red}"
        );
        const result = await collectStats(
            { cwd: project, userConfigPath: "configs/.stylelintrc" },
            { configRevision: 1, workerPath }
        );
        expect(result.rules.map((rule) => rule.name)).toContain(
            "stylelint/color-named"
        );
        expect(result.errors).toBeGreaterThan(0);
    });
    it.each([
        ["process.exit(2)", /worker failed/u],
        [
            "process.send({summary:{filesLinted:'bad'},timingExpected:true})",
            /invalid result/u,
        ],
        [
            "process.send({summary:{filesLinted:1,errors:0,warnings:0,diagnostics:[]},timingExpected:true},()=>process.disconnect())",
            /supported timing table/u,
        ],
    ])(
        "rejects crashed or invalid worker results: %s",
        async (source, message) => {
            const invalidWorker = join(project, "invalid-worker.mjs");
            await writeFile(invalidWorker, source);
            await expect(
                collectStats(
                    { cwd: project },
                    { configRevision: 1, workerPath: invalidWorker }
                )
            ).rejects.toThrow(message);
        }
    );
    it("terminates a worker on timeout", async () => {
        const hangingWorker = join(project, "hanging.mjs");
        await writeFile(hangingWorker, "setInterval(() => {}, 1000)");
        await expect(
            collectStats(
                { cwd: project },
                { configRevision: 1, workerPath: hangingWorker, timeoutMs: 50 }
            )
        ).rejects.toThrow(/time limit/u);
    });
});
