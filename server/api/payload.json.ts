import { getInspectorRuntime } from "../utils/inspector-runtime";

export default lazyEventHandler(async () => {
    const { ws } = await getInspectorRuntime();

    return defineEventHandler(() => {
        return ws.getData();
    });
});
