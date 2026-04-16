interface NuxtLike {
    options: {
        experimental: Record<string, unknown>;
    };
}

function forcePayloadExtraction(_options: unknown, nuxt: NuxtLike) {
    nuxt.options.experimental.payloadExtraction = true;
}

export default defineNuxtConfig({
    ssr: false,

    modules: [
        forcePayloadExtraction,
        "@vueuse/nuxt",
        "@unocss/nuxt",
        "@nuxt/eslint",
        "nuxt-eslint-auto-explicit-import",
    ],

    eslint: {
        config: {
            standalone: false,
        },
    },

    experimental: {
        typedPages: true,
        clientNodeCompat: true,
        componentIslands: false,
    },

    features: {
        inlineStyles: false,
    },

    css: ["@unocss/reset/tailwind.css"],

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
        sourceMap: false,
    },

    app: {
        baseURL: "./",
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
                    rel: "alternate icon",
                    type: "image/svg+xml",
                    href: "/stylelint/stylelint-icon-black.svg",
                },
                {
                    rel: "alternate icon",
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

    vite: {
        base: "./",
    },

    devtools: {
        enabled: false,
    },

    compatibilityDate: "2024-07-17",
});
