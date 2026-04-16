// @ts-check
import antfu from "@antfu/eslint-config";
import nuxt from "./.nuxt/eslint.config.mjs";

export default await nuxt()
    .prepend(
        await antfu({
            stylistic: false,
            unocss: true,
            vue: {
                overrides: {
                    "vue/html-closing-bracket-newline": "off",
                    "vue/html-indent": "off",
                    "vue/html-self-closing": "off",
                    "vue/multiline-html-element-content-newline": "off",
                    "vue/no-extra-parens": "off",
                    "vue/singleline-html-element-content-newline": "off",
                },
            },
        })
    )
    .append({
        files: ["src/**/*.ts"],
        rules: {
            "no-console": "off",
            "dot-notation": "off",
        },
    })
    .append({
        files: [
            "**/.github/instructions/Docs-Folder.instructions.md",
            ".checkov.yml",
            ".devskim.json",
            ".github/**/**/*.{md,yml,yaml}",
            ".github/hooks/*.{json,jsonl,yml,yaml}",
            ".github/instructions/**/*.{md,yml,yaml}",
            ".github/instructions/Tests-Folder.instructions.md",
            ".github/instructions/Typescript_5.instructions.md",
            ".grype.yaml",
            ".markdown-link-check.json",
            ".mega-linter.yml",
            ".ncurc.json",
            ".npmpackagejsonlintrc.json",
            ".pre-commit-config.yaml",
            ".remarkrc.mjs",
            ".secretlintrc.json",
            "ActionLintConfig.yaml",
            "codecov.yml",
            "commitlint.config.mjs",
            "jscpd.json",
            "kics.yaml",
            "knip.config.ts",
            "markdownlint.json",
            "node.config.json",
            "npm-badges.json",
            "package.json",
            "prettier.config.ts",
            "scripts/**",
            "stryker.config.mjs",
            "stylelint.config.mjs",
            "tsconfig.build.json",
            "tsconfig.cli.json",
            "tsconfig.eslint.json",
            "tsconfig.js.json",
            "tsconfig.json",
            "tsdoc.json",
            "vite.config.ts",
            "vitest.stryker.config.ts",
        ],
        rules: {
            "jsonc/sort-keys": "off",
            "antfu/if-newline": "off",
            "e18e/prefer-static-regex": "off",
            "jsdoc/require-returns-description": "off",
            "jsonc/indent": "off",
            "ts/consistent-type-definitions": "off",
            "yaml/indent": "off",
            "yaml/plain-scalar": "off",
            "yaml/quotes": "off",
        },
    });
