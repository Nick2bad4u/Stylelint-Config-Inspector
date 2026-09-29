import { isStatsRequestAllowed } from "../../../src/stats-http";
import { getInspectorRuntime } from "../../utils/inspector-runtime";

export default defineEventHandler(async (event) => {
    const origin = getRequestHeader(event, "origin");
    const fetchSite = getRequestHeader(event, "sec-fetch-site");
    const expectedOrigin = getRequestURL(event, {
        xForwardedHost: false,
        xForwardedProto: false,
    }).origin;
    if (!isStatsRequestAllowed(origin, fetchSite, expectedOrigin)) {
        return new Response("Stats analysis requires a same-origin request", {
            status: 403,
        });
    }
    const { stats } = await getInspectorRuntime();
    void stats.run();
    return Response.json(stats.getState(), {
        status: 202,
        headers: { "Cache-Control": "no-store" },
    });
});
