import type stylelintApi from "stylelint";
import type { Config, LinterOptions } from "stylelint";
import type { StatsWorkerRequest, StatsWorkerResponse } from "./protocol";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
    collectWorkspaceScanConfigs,
    createStylelintInspectorAdapter,
    discoverWorkspaceFiles,
    loadConfigFromPath,
} from "../inspectors/stylelint";

async function analyze(
    request: StatsWorkerRequest
): Promise<StatsWorkerResponse> {
    const { options } = request;
    const { basePath, configPath } =
        await createStylelintInspectorAdapter().resolveConfigPath(options);
    process.chdir(basePath);
    const module = (await import(
        pathToFileURL(request.stylelintPath).href
    )) as { default: typeof stylelintApi };
    const stylelint = module.default;
    if (!configPath)
        throw new Error("No Stylelint configuration found for profiling.");
    const config = (await loadConfigFromPath(configPath, basePath)).config;
    const configOptions = {
        cwd: basePath,
        config,
        configBasedir: dirname(configPath),
    };
    const discovery = await discoverWorkspaceFiles(
        await collectWorkspaceScanConfigs(
            config,
            basePath,
            dirname(configPath)
        ),
        basePath
    );
    const summary = {
        filesLinted: 0,
        errors: 0,
        warnings: 0,
        diagnostics: discovery.diagnostics,
    };
    if (discovery.files.length === 0) return { summary, timingExpected: false };
    // Stylelint's false API option does not override config.fix. The final
    // universal override also disables fixes inherited through extends/overrides.
    const readonlyConfig: Config = {
        ...config,
        fix: false,
        overrides: [
            ...(config.overrides ?? []),
            { files: ["**/*"], fix: false },
        ],
    };
    const lintOptions: LinterOptions = {
        ...configOptions,
        config: readonlyConfig,
        files: discovery.files.map((file) => resolve(basePath, file)),
        fix: false,
        cache: false,
        cacheLocation: request.cacheLocation,
        suppressAll: false,
        allowEmptyInput: true,
        ...(options.customSyntax ? { customSyntax: options.customSyntax } : {}),
    };
    const result = await stylelint.lint(lintOptions);
    for (const file of result.results) {
        if (file.ignored) continue;
        summary.filesLinted++;
        summary.errors +=
            file.parseErrors.length + file.invalidOptionWarnings.length;
        for (const warning of file.warnings) {
            if (warning.severity === "error") summary.errors++;
            else summary.warnings++;
        }
    }
    if (result.results.some((file) => file.invalidOptionWarnings.length > 0)) {
        throw new Error(
            "Stylelint configuration has invalid rule options. Resolve the configuration errors before profiling."
        );
    }
    return {
        summary,
        timingExpected: result.results.some(
            (file) =>
                !file.ignored &&
                file.parseErrors.length === 0 &&
                !file.warnings.some(
                    (warning) => warning.rule === "CssSyntaxError"
                )
        ),
    };
}

process.once("message", (request: StatsWorkerRequest) => {
    void analyze(request)
        .then((response) => {
            process.send?.(response, () => process.disconnect?.());
        })
        .catch((error: unknown) => {
            process.send?.(
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                () => process.disconnect?.()
            );
            process.exitCode = 1;
        });
});
