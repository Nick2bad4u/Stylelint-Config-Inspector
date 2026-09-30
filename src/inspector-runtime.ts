import type { StatsManager } from "./stats/index";
import type { CreateWsServerOptions, WsServerHandle } from "./ws";
import { collectStats, createStatsManager } from "./stats/index";
import { createWsServer } from "./ws";

/** Share the configuration watcher and profiling lifecycle within one server. */
export interface InspectorRuntime {
    ws: WsServerHandle;
    stats: StatsManager;
    close: () => Promise<void>;
}

export async function createInspectorRuntime(
    options: CreateWsServerOptions & { statsWorkerPath?: string }
): Promise<InspectorRuntime> {
    const ws = await createWsServer(options);
    const workerPath = options.statsWorkerPath;
    const stats = createStatsManager(options, {
        getConfigRevision: async () =>
            (await ws.getData())?.meta.lastUpdate ?? 0,
        ...(workerPath
            ? {
                  run: (readOptions, settings) =>
                      collectStats(readOptions, {
                          ...settings,
                          workerPath,
                      }),
              }
            : {}),
    });
    ws.watcher.on("change", () => stats.markStale());
    return {
        ws,
        stats,
        async close() {
            stats.close();
            ws.wss.clients.forEach((client) => client.terminate());
            await Promise.all([
                ws.watcher.close(),
                new Promise<void>((resolve, reject) => {
                    ws.wss.close((error) =>
                        error ? reject(error) : resolve()
                    );
                }),
            ]);
        },
    };
}
