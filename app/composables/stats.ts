import type { StatsState } from "~~/shared/stats";
import { $fetch } from "ofetch";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRuntimeConfig } from "#app/nuxt";
import { payload } from "./payload";

/** Read the current server-owned analysis; page navigation never starts a run. */
export function useStats() {
    const config = useRuntimeConfig();
    const state = ref<StatsState>({
        status: "idle",
        mode: "live",
        stale: false,
    });
    const loading = ref(true);
    const requestError = ref<string>();
    const submitting = ref(false);
    const controller = new AbortController();
    let refreshing = false;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stale = computed(
        () =>
            state.value.stale ||
            (state.value.report !== undefined &&
                payload.value.meta.lastUpdate >
                    state.value.report.configRevision)
    );

    function schedulePoll() {
        if (timer !== undefined) clearTimeout(timer);
        if (
            !disposed &&
            state.value.mode === "live" &&
            state.value.status === "running"
        )
            timer = setTimeout(() => {
                void refresh();
            }, 750);
    }

    async function refresh() {
        if (disposed || refreshing) return;
        refreshing = true;
        if (timer !== undefined) clearTimeout(timer);
        requestError.value = undefined;
        try {
            const next = await $fetch<StatsState>("/api/stats.json", {
                baseURL: config.app.baseURL,
                signal: controller.signal,
                timeout: 15_000,
            });
            if (!disposed) state.value = next;
        } catch (error) {
            if (!disposed)
                requestError.value =
                    error instanceof Error
                        ? error.message
                        : "Unable to load analysis status.";
        } finally {
            refreshing = false;
            if (!disposed) loading.value = false;
            schedulePoll();
        }
    }

    async function run() {
        if (
            submitting.value ||
            state.value.mode === "static" ||
            state.value.status === "running" ||
            state.value.status === "unsupported"
        )
            return;
        submitting.value = true;
        requestError.value = undefined;
        try {
            const next = await $fetch<StatsState>("/api/stats/run", {
                baseURL: config.app.baseURL,
                method: "POST",
                signal: controller.signal,
                timeout: 15_000,
            });
            if (!disposed) state.value = next;
        } catch (error) {
            if (!disposed)
                requestError.value =
                    error instanceof Error
                        ? error.message
                        : "Unable to start analysis.";
        } finally {
            submitting.value = false;
            schedulePoll();
        }
    }

    onMounted(() => {
        void refresh();
    });
    onBeforeUnmount(() => {
        disposed = true;
        controller.abort();
        if (timer !== undefined) clearTimeout(timer);
    });
    return { state, loading, requestError, submitting, stale, run, refresh };
}
