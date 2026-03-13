// @ts-check
import antfu from '@antfu/eslint-config'
import nuxt from './.nuxt/eslint.config.mjs'

export default await nuxt()
  .prepend(
    await antfu(
      {
        unocss: true,
        vue: {
          overrides: {
            'vue/no-extra-parens': 'off',
          },
        },
      },
    ),
  )
  .append({
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  })
  .append({
    files: [
      '.github/**/**/*.{md,yml,yaml}',
      '.github/instructions/**/*.{md,yml,yaml}',
      'stylelint.config.mjs',
      '.github/hooks/*.{json,jsonl,yml,yaml}',
      '.pre-commit-config.yaml',
      '.github/instructions/Typescript_5.instructions.md',
      '.github/instructions/Tests-Folder.instructions.md',
      '**/.github/instructions/Docs-Folder.instructions.md',
    ],
    rules: {
      'yaml/quotes': 'off',
      'yaml/plain-scalar': 'off',
      'yaml/indent': 'off',
      'style/member-delimiter-style': 'off',
      'ts/consistent-type-definitions': 'off',
      'style/semi': 'off',
      'style/indent': 'off',
      'style/quotes': 'off',
      'antfu/if-newline': 'off',
      'style/operator-linebreak': 'off',
      'jsonc/indent': 'off',
    },
  })
