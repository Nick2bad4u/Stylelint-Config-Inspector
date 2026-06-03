<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useRouter } from "#app/composables/router";
import { useRuntimeConfig } from "#app/nuxt";
import {
    errorInfo,
    init,
    isFetching,
    isLoading,
    payloadFetchError,
    retryPayload,
} from "~/composables/payload";

import "./composables/dark";

const config = useRuntimeConfig();
const router = useRouter();
const isRouteNavigating = ref(false);
let routeSpinnerTimeout: ReturnType<typeof setTimeout> | undefined;

const removeBeforeEach = router.beforeEach(() => {
    if (routeSpinnerTimeout) clearTimeout(routeSpinnerTimeout);

    isRouteNavigating.value = true;
});

const removeAfterEach = router.afterEach(() => {
    routeSpinnerTimeout = setTimeout(() => {
        isRouteNavigating.value = false;
    }, 150);
});

const removeRouteError = router.onError(() => {
    if (routeSpinnerTimeout) clearTimeout(routeSpinnerTimeout);

    isRouteNavigating.value = false;
});

onBeforeUnmount(() => {
    removeBeforeEach();
    removeAfterEach();
    removeRouteError();
});

init(config.app.baseURL);
</script>

<template>
    <NuxtLoadingIndicator
        :height="3"
        :throttle="0"
        color="repeating-linear-gradient(90deg, #8b5cf6 0px, #a78bfa 32px, #8b5cf6 64px)"
    />

    <div
        v-if="isRouteNavigating && !isLoading && !errorInfo"
        class="pointer-events-none fixed right-3 top-3 z-60 inline-flex items-center gap-2 border border-violet-300/45 rounded-full bg-white/85 px-3 py-1.5 text-xs text-violet-700 shadow-lg backdrop-blur-sm dark:border-violet-300/25 dark:bg-zinc-950/70 dark:text-violet-200"
    >
        <div i-svg-spinners-90-ring-with-bg text-sm />
        Loading view...
    </div>

    <div
        v-if="errorInfo"
        class="inspector-viewport-state"
        grid
        w-full
        place-content-center
        whitespace-pre-line
        p4
    >
        <ConfigInspectorBadge mb6 text-xl font-200 />

        <div text-2xl text-red5 font-bold>
            Failed to resolve Stylelint config<br />
        </div>

        <div text-lg text-red font-mono>
            {{ errorInfo.error }}
        </div>

        <div v-if="errorInfo.message" mt3 max-w-3xl text-sm font-mono op75>
            {{ errorInfo.message }}
        </div>

        <div mt6 op50>
            Note that
            <a
                href="https://stylelint.io/user-guide/configure"
                target="_blank"
                rel="noopener noreferrer"
                hover:underline
                >Stylelint configuration</a
            >
            must be discoverable for the selected target file.
        </div>
        <div v-if="payloadFetchError" mt3 max-w-3xl text-sm text-red font-mono>
            {{ payloadFetchError }}
        </div>
        <button
            mt6
            btn-action
            justify-self-center
            :disabled="isFetching"
            @click="retryPayload()"
        >
            <div
                :class="
                    isFetching
                        ? 'i-svg-spinners-90-ring-with-bg'
                        : 'i-ph-arrow-clockwise-duotone'
                "
            />
            Retry payload
        </button>
    </div>
    <div
        v-else-if="isLoading"
        class="inspector-viewport-state"
        flex="~ col"
        w-full
        items-center
        justify-center
        p4
    >
        <div flex="~ gap-2 items-center" flex-auto animate-pulse text-xl>
            <div i-svg-spinners-90-ring-with-bg />
            Loading config...
        </div>
        <ConfigInspectorBadge mt6 text-xl font-200 :show-version="false" />
    </div>
    <div v-else px4 py6 lg:px14 lg:py10>
        <NavBar />
        <NuxtPage />
    </div>
</template>
