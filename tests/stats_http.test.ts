import type { StatsState } from "../shared/stats";
import { createApp } from "h3";
import { describe, expect, it, vi } from "vitest";
import { createStatsHandlers } from "../src/stats-http";

function setup() {
    let state: StatsState = { mode: "live", status: "idle", stale: false };
    const run = vi.fn(async () => {
        state = { ...state, status: "running" };
        return state;
    });
    const handlers = createStatsHandlers({ getState: () => state, run });
    const app = createApp();
    app.use("/api/stats.json", handlers.read);
    app.use("/api/stats/run", handlers.run);
    return { app, run };
}

describe("stats HTTP boundaries", () => {
    it("reads without triggering a run and disables response caching", async () => {
        const { app, run } = setup();
        const response = await app.fetch(
            new Request("http://localhost/api/stats.json")
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({
            status: "idle",
            mode: "live",
        });
        expect(run).not.toHaveBeenCalled();
    });

    it("starts same-origin requests without accepting caller options", async () => {
        const { app, run } = setup();
        const response = await app.fetch(
            new Request("http://localhost/api/stats/run", {
                method: "POST",
                headers: {
                    origin: "http://localhost",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    cwd: "/untrusted",
                    config: "/untrusted",
                }),
            })
        );
        expect(response.status).toBe(202);
        expect(await response.json()).toMatchObject({ status: "running" });
        expect(run).toHaveBeenCalledExactlyOnceWith();
    });

    it.each([
        { origin: "https://unrelated.example" },
        { origin: "null" },
        { "sec-fetch-site": "cross-site" },
        {
            origin: "https://unrelated.example",
            "x-forwarded-host": "unrelated.example",
            "x-forwarded-proto": "https",
        },
    ])("rejects cross-origin requests: %j", async (headers) => {
        const { app, run } = setup();
        const response = await app.fetch(
            new Request("http://localhost/api/stats/run", {
                method: "POST",
                headers,
            })
        );
        expect(response.status).toBe(403);
        expect(run).not.toHaveBeenCalled();
    });

    it("allows non-browser clients without Origin", async () => {
        const { app } = setup();
        const response = await app.fetch(
            new Request("http://localhost/api/stats/run", { method: "POST" })
        );
        expect(response.status).toBe(202);
    });

    it.each([
        ["GET", "/api/stats/run"],
        ["POST", "/api/stats.json"],
    ])("rejects %s on %s", async (method, path) => {
        const { app, run } = setup();
        const response = await app.fetch(
            new Request(`http://localhost${path}`, { method })
        );
        expect(response.status).toBe(405);
        expect(run).not.toHaveBeenCalled();
    });
});
