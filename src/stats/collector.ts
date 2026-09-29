import type { StatsReport } from "../../shared/stats";
import type { ReadConfigOptions } from "../inspectors/contracts";
import type { StatsWorkerRequest, StatsWorkerResponse } from "./protocol";
import { fork } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createStylelintInspectorAdapter } from "../inspectors/stylelint";
import {
    aggregatePluginTimings,
    isSupportedStatsVersion,
    parseTimingOutput,
} from "./timing";

export class UnsupportedStatsVersionError extends Error {
    override readonly name = "UnsupportedStatsVersionError";
}

export interface CollectStatsOptions {
    configRevision: number;
    signal?: AbortSignal;
    workerPath?: string;
    timeoutMs?: number;
}

function isWorkerResponse(value: unknown): value is StatsWorkerResponse {
    if (typeof value !== "object" || value === null) return false;
    if ("error" in value) return typeof value.error === "string";
    if (
        !("timingExpected" in value) ||
        typeof value.timingExpected !== "boolean" ||
        !("summary" in value)
    )
        return false;
    const summary = value.summary;
    if (typeof summary !== "object" || summary === null) return false;
    for (const field of [
        "filesLinted",
        "errors",
        "warnings",
    ] as const) {
        if (!(field in summary)) return false;
        const count = (summary as Record<string, unknown>)[field];
        if (
            typeof count !== "number" ||
            !Number.isSafeInteger(count) ||
            count < 0
        )
            return false;
    }
    return (
        "diagnostics" in summary &&
        Array.isArray(summary.diagnostics) &&
        summary.diagnostics.every(
            (diagnostic: unknown) => typeof diagnostic === "string"
        )
    );
}

function runWorker(
    request: StatsWorkerRequest,
    options: CollectStatsOptions
): Promise<{ response: StatsWorkerResponse; output: string }> {
    return new Promise((resolveResult, reject) => {
        const workerPath =
            options.workerPath ??
            fileURLToPath(new URL("./stats-worker.mjs", import.meta.url));
        const child = fork(workerPath, [], {
            cwd: request.options.cwd,
            env: { ...process.env, TIMING: "all", FORCE_COLOR: "0" },
            execArgv: [],
            stdio: [
                "ignore",
                "pipe",
                "pipe",
                "ipc",
            ],
        });
        let output = "";
        let stderr = "";
        let response: StatsWorkerResponse | undefined;
        let failure: Error | undefined;
        const stop = (error: Error): void => {
            failure = error;
            child.kill();
        };
        const cancel = (): void =>
            stop(new Error("Stylelint analysis was cancelled."));
        const onHostExit = (): void => {
            child.kill();
        };
        process.once("exit", onHostExit);
        const timeout = setTimeout(
            () =>
                stop(
                    new Error(
                        "Stylelint analysis exceeded the five-minute time limit."
                    )
                ),
            options.timeoutMs ?? 300_000
        );
        options.signal?.addEventListener("abort", cancel, { once: true });
        child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
            output += chunk;
            if (output.length > 10_000_000)
                stop(
                    new Error(
                        "Stylelint profiling output exceeded the 10 MB limit."
                    )
                );
        });
        child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
            stderr = (stderr + chunk).slice(-16_000);
        });
        child.on("message", (message: unknown) => {
            if (isWorkerResponse(message)) response = message;
            else
                stop(
                    new Error(
                        "Stylelint profiling worker returned an invalid result."
                    )
                );
        });
        child.once("error", (error) => {
            failure = error;
        });
        child.once("close", (code) => {
            clearTimeout(timeout);
            process.removeListener("exit", onHostExit);
            options.signal?.removeEventListener("abort", cancel);
            if (failure) reject(failure);
            else if (response && "error" in response)
                reject(new Error(response.error));
            else if (code !== 0 || !response)
                reject(
                    new Error(
                        `Stylelint profiling worker failed${stderr ? `: ${stderr.trim()}` : ` (exit ${code}).`}`
                    )
                );
            else resolveResult({ response, output });
        });
        if (options.signal?.aborted) cancel();
        else
            child.send(request, (error) => {
                if (error) stop(error);
            });
    });
}

export async function collectStats(
    options: ReadConfigOptions,
    settings: CollectStatsOptions
): Promise<StatsReport> {
    const started = performance.now();
    const { basePath } =
        await createStylelintInspectorAdapter().resolveConfigPath(options);
    const projectRequire = createRequire(resolve(basePath, "package.json"));
    const stylelintPath = projectRequire.resolve("stylelint");
    const packagePath = projectRequire.resolve("stylelint/package.json");
    const pkg = JSON.parse(await readFile(packagePath, "utf8")) as {
        version?: unknown;
    };
    if (
        typeof pkg.version !== "string" ||
        !isSupportedStatsVersion(pkg.version)
    ) {
        throw new UnsupportedStatsVersionError(
            `Performance analysis requires Stylelint 16.13+ or 17; installed version is ${String(pkg.version)}.`
        );
    }
    const tempPath = await mkdtemp(
        join(tmpdir(), "stylelint-inspector-stats-")
    );
    try {
        const { response, output } = await runWorker(
            {
                options,
                stylelintPath,
                cacheLocation: join(tempPath, ".stylelintcache"),
            },
            settings
        );
        if ("error" in response) throw new Error(response.error);
        // Stylelint loads its timing module lazily during linting; an empty
        // workspace therefore legitimately exits without printing a table.
        const rules = response.timingExpected ? parseTimingOutput(output) : [];
        return {
            filesLinted: response.summary.filesLinted,
            errors: response.summary.errors,
            warnings: response.summary.warnings,
            rules,
            plugins: aggregatePluginTimings(rules),
            durationMs: performance.now() - started,
            ruleTimeMs: rules.reduce((total, rule) => total + rule.timeMs, 0),
            analyzedAt: new Date().toISOString(),
            scope: "Discovered workspace style files (respecting Stylelint ignores and overrides)",
            stylelintVersion: pkg.version,
            configRevision: settings.configRevision,
            diagnostics: [
                ...response.summary.diagnostics,
                "Native timing measures synchronous rule execution; asynchronous plugin work may be undercounted. Timings are rounded to 0.001 ms.",
            ],
        };
    } finally {
        await rm(tempPath, { recursive: true, force: true });
    }
}
