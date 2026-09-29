import type { ReadConfigOptions } from "../inspectors/contracts";

export interface StatsWorkerRequest {
    options: ReadConfigOptions;
    stylelintPath: string;
    cacheLocation: string;
}

export interface StatsWorkerSummary {
    filesLinted: number;
    errors: number;
    warnings: number;
    diagnostics: string[];
}

export type StatsWorkerResponse =
    | { summary: StatsWorkerSummary; timingExpected: boolean }
    | { error: string };
