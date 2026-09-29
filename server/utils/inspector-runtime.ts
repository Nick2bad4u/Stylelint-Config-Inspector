import type { CliInspectorOptions } from "../../src/cli-options";
import type { InspectorRuntime } from "../../src/inspector-runtime";
import { resolve } from "node:path";
import process from "node:process";
import { normalizeCliInspectorOptions } from "../../src/cli-options";

let runtime: Promise<InspectorRuntime> | undefined;

export function getInspectorRuntime() {
    const cwd = process.cwd();
    const options = normalizeCliInspectorOptions<CliInspectorOptions>({});
    runtime ??= import("../../src/inspector-runtime").then(
        ({ createInspectorRuntime }) =>
            createInspectorRuntime({
                cwd,
                chdir: false,
                userConfigPath: options.config,
                userBasePath: options.basePath,
                targetFilePath: options.target,
                statsWorkerPath: resolve(
                    cwd,
                    ".cache/stats-runtime/stats-worker.mjs"
                ),
            })
    );
    return runtime;
}

export async function closeInspectorRuntime() {
    if (runtime) await (await runtime).close();
    runtime = undefined;
}
