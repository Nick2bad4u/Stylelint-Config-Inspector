<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useHead } from "#app/composables/head";
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
// Static exports receive their deployment base at runtime through the CLI.
useHead({
    link: [
        {
            key: "inspector-favicon",
            rel: "icon",
            type: "image/svg+xml",
            href: `${config.app.baseURL}favicon.svg`,
        },
        {
            rel: "icon",
            type: "image/svg+xml",
            href: `${config.app.baseURL}stylelint/stylelint-icon-black.svg`,
        },
        {
            rel: "icon",
            type: "image/png",
            href: `${config.app.baseURL}stylelint/stylelint-icon-white-512.png`,
        },
        {
            rel: "apple-touch-icon",
            href: `${config.app.baseURL}stylelint/stylelint-icon-white-512.png`,
        },
    ],
});
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
    <NuxtLoadingIndicator :height="3" :throttle="0" color="#8080F2" />

    <output
        v-if="isRouteNavigating && !isLoading && !errorInfo"
        class="inspector-panel pointer-events-none fixed right-3 top-3 z-60 inline-flex items-center gap-2 px-3 py-1.5 text-xs"
    >
        <span i-svg-spinners-90-ring-with-bg text-sm />
        Loading view...
    </output>

    <div
        v-if="errorInfo"
        class="inspector-viewport-state"
        role="alert"
        grid
        w-full
        place-content-center
        whitespace-pre-line
        p4
    >
        <ConfigInspectorBadge mb6 text-xl font-200 />

        <h1 text-2xl text-rose-700 font-bold dark:text-rose-300>
            Failed to resolve Stylelint config<br />
        </h1>

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
            type="button"
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
        <output flex="~ gap-2 items-center" flex-auto animate-pulse text-xl>
            <span i-svg-spinners-90-ring-with-bg />
            Loading config...
        </output>
        <ConfigInspectorBadge mt6 text-xl font-200 :show-version="false" />
    </div>
    <div v-else class="inspector-shell" px4 py6 lg:px14 lg:py10>
        <NavBar />
        <main id="main-content" tabindex="-1">
            <NuxtPage />
        </main>
    </div>
</template>
