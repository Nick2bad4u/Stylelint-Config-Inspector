import { closeInspectorRuntime } from "../utils/inspector-runtime";

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook("close", closeInspectorRuntime);
});
