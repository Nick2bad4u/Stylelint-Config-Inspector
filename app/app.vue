<script setup lang="ts">
import { useRouter } from "#app/composables/router";
import { useRuntimeConfig } from "#app/nuxt";
import { onBeforeUnmount, ref } from "vue";
import { errorInfo, init, isLoading } from "~/composables/payload";

import "floating-vue/dist/style.css";
import "./styles/global.css";
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
        grid
        h-full
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

        <div mt6 op50>
            Note that
            <a
                href="https://stylelint.io/user-guide/configure"
                target="_blank"
                hover:underline
                >Stylelint configuration</a
            >
            must be discoverable for the selected target file.
        </div>
    </div>
    <div
        v-else-if="isLoading"
        flex="~ col"
        h-full
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
