export default defineNuxtConfig({
    ssr: false,

    modules: [
        "@vueuse/nuxt",
        "@unocss/nuxt",
        "@nuxt/eslint",
        "nuxt-eslint-auto-explicit-import",
    ],

    eslint: {
        config: {
            standalone: false,
            stylistic: false,
        },
    },

    experimental: {
        typedPages: true,
    },

    features: {
        inlineStyles: false,
    },

    vite: {
        build: {
            modulePreload: {
                polyfill: false,
            },
            rollupOptions: {
                onwarn(warning, warn) {
                    const isVueUsePureAnnotationWarning =
                        warning.id?.includes("@vueuse/core/dist/index.js") &&
                        warning.message.includes("#__PURE__");

                    if (isVueUsePureAnnotationWarning) return;

                    warn(warning);
                },
            },
        },
    },

    css: [
        "@unocss/reset/tailwind.css",
        "floating-vue/dist/style.css",
        "~/styles/global.css",
    ],

    routeRules: {
        "/": {
            prerender: true,
        },
        "/200.html": {
            prerender: true,
        },
        "/404.html": {
            prerender: true,
        },
        "/*": {
            prerender: false,
        },
    },

    nitro: {
        preset: "static",
        storage: {
            "internal:nuxt:prerender": {
                driver: "fs",
                base: "./.nuxt/cache/nitro/prerender",
            },
        },
        output: {
            dir: "./dist",
        },
        sourceMap: false,
    },

    app: {
        head: {
            viewport: "width=device-width,initial-scale=1",
            meta: [
                { name: "theme-color", content: "#5B21B6" },
                {
                    name: "apple-mobile-web-app-title",
                    content: "Stylelint Inspector",
                },
            ],
            link: [
                { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
                {
                    rel: "icon",
                    type: "image/svg+xml",
                    href: "/stylelint/stylelint-icon-black.svg",
                },
                {
                    rel: "icon",
                    type: "image/png",
                    href: "/stylelint/stylelint-icon-white-512.png",
                },
                {
                    rel: "apple-touch-icon",
                    href: "/stylelint/stylelint-icon-white-512.png",
                },
            ],
            title: "Stylelint Config Inspector",
        },
    },

    devtools: {
        enabled: false,
    },

    compatibilityDate: "2024-07-17",
});
