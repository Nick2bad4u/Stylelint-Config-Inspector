export interface StatsTiming {
    name: string;
    plugin: string;
    timeMs: number;
    percentage: number;
}

export interface StatsPluginTiming {
    name: string;
    timeMs: number;
    percentage: number;
    rules: StatsTiming[];
}

export interface StatsReport {
    rules: StatsTiming[];
    plugins: StatsPluginTiming[];
    durationMs: number;
    ruleTimeMs: number;
    filesLinted: number;
    errors: number;
    warnings: number;
    analyzedAt: string;
    scope: string;
    stylelintVersion: string;
    configRevision: number;
    diagnostics: string[];
}

export interface StatsState {
    status:
        | "idle"
        | "running"
        | "complete"
        | "error"
        | "unsupported";
    mode: "live" | "static";
    report?: StatsReport;
    error?: string;
    stale: boolean;
}
