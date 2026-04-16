import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/cli.ts"],
    attw: true,
    failOnWarn: true,
    checks: {
        cannotCallNamespace: true,
        circularDependency: true,
        commonJsVariableInEsm: true,
        configurationFieldConflict: true,
        eval: true,
        filenameConflict: true,
        importIsUndefined: true,
        legacyCjs: false,
        mixedExports: true,
        unresolvedEntry: true,
        unresolvedImport: true,
        unsupportedTsconfigOption: true,
    },
    tsconfig: "./tsconfig.cli.json",
    format: ["esm", "cjs"],
    sourcemap: true,
    dts: {
        build: true,
    },
    platform: "node",
    deps: {
        onlyBundle: false,
    },
    clean: false,
    inputOptions: {
        experimental: {
            resolveNewUrlToAsset: false,
        },
    },
});
