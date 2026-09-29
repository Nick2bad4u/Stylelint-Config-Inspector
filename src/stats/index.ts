import type { StatsReport, StatsState } from "../../shared/stats";
import type { ReadConfigOptions } from "../inspectors/contracts";
import type { CollectStatsOptions } from "./collector";
import { collectStats, UnsupportedStatsVersionError } from "./collector";

export { collectStats, UnsupportedStatsVersionError } from "./collector";

export interface StatsManager {
    getState: () => StatsState;
    run: () => Promise<StatsState>;
    markStale: () => void;
    close: () => void;
}

export interface StatsManagerOptions {
    getConfigRevision: () => number | Promise<number>;
    run?: (
        options: ReadConfigOptions,
        settings: CollectStatsOptions
    ) => Promise<StatsReport>;
}

export function createStatsManager(
    options: ReadConfigOptions,
    settings: StatsManagerOptions
): StatsManager {
    let state: StatsState = { status: "idle", mode: "live", stale: false };
    let active: Promise<StatsState> | undefined;
    let controller: AbortController | undefined;
    let generation = 0;
    let closed = false;
    return {
        getState: () => state,
        markStale: () => {
            generation++;
            if (state.report) state = { ...state, stale: true };
        },
        close: () => {
            closed = true;
            controller?.abort();
        },
        run: () => {
            if (active) return active;
            if (closed) return Promise.resolve(state);
            const previousReport = state.report;
            const startGeneration = generation;
            controller = new AbortController();
            const signal = controller.signal;
            state = {
                status: "running",
                mode: "live",
                stale: state.stale,
                ...(previousReport ? { report: previousReport } : {}),
            };
            active = Promise.resolve().then(async () => {
                try {
                    const configRevision = await settings.getConfigRevision();
                    const report = await (settings.run ?? collectStats)(
                        options,
                        { configRevision, signal }
                    );
                    state = {
                        status: "complete",
                        mode: "live",
                        stale: generation !== startGeneration,
                        report,
                    };
                } catch (error) {
                    state = {
                        status:
                            error instanceof UnsupportedStatsVersionError
                                ? "unsupported"
                                : "error",
                        mode: "live",
                        stale: state.stale,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                        ...(previousReport ? { report: previousReport } : {}),
                    };
                } finally {
                    active = undefined;
                    controller = undefined;
                }
                return state;
            });
            return active;
        },
    };
}
