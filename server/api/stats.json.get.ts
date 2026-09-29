import { getInspectorRuntime } from "../utils/inspector-runtime";

export default defineEventHandler(async (event) => {
    const { stats } = await getInspectorRuntime();
    setResponseHeader(event, "Cache-Control", "no-store");
    return stats.getState();
});
