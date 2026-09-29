import type { EventHandler } from "h3";
import type { StatsState } from "../shared/stats";
import {
    assertMethod,
    createError,
    eventHandler,
    getRequestHeader,
    getRequestURL,
    setResponseHeader,
    setResponseStatus,
} from "h3";

interface StatsController {
    getState: () => StatsState;
    run: () => Promise<StatsState>;
}

interface StatsHandlers {
    read: EventHandler;
    run: EventHandler;
}

export function isStatsRequestAllowed(
    origin: string | undefined,
    fetchSite: string | undefined,
    expectedOrigin: string
): boolean {
    return (
        fetchSite !== "cross-site" &&
        (origin === undefined || origin === expectedOrigin)
    );
}

/** HTTP boundaries never accept workspace paths or collector options. */
export function createStatsHandlers(
    controller: StatsController
): StatsHandlers {
    return {
        read: eventHandler((event) => {
            assertMethod(event, "GET");
            setResponseHeader(event, "Cache-Control", "no-store");
            return controller.getState();
        }),
        run: eventHandler((event) => {
            assertMethod(event, "POST");
            const origin = getRequestHeader(event, "origin");
            const fetchSite = getRequestHeader(event, "sec-fetch-site");
            const expectedOrigin = getRequestURL(event, {
                xForwardedHost: false,
                xForwardedProto: false,
            }).origin;
            if (!isStatsRequestAllowed(origin, fetchSite, expectedOrigin)) {
                throw createError({
                    statusCode: 403,
                    statusMessage:
                        "Stats analysis requires a same-origin request",
                });
            }
            setResponseHeader(event, "Cache-Control", "no-store");
            setResponseStatus(event, 202);
            void controller.run();
            return controller.getState();
        }),
    };
}
