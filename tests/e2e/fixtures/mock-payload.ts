import type { Page } from '@playwright/test'
import process from 'node:process'

export const pluginRuleName = 'plugin/no-unsupported-browser-features'
export const extendSpecifier = 'stylelint-config-recommended'
export const secondaryExtendSpecifier = '@scope/stylelint-config-team'

export const MOCK_PAYLOAD = {
  meta: {
    basePath: process.cwd(),
    configPath: 'stylelint.config.mjs',
    engine: 'stylelint',
    lastUpdate: Date.now(),
    targetFilePath: 'src/example.css',
  },
  configs: [
    {
      index: 0,
      name: 'stylelint/root',
      rules: {
        [pluginRuleName]: [
          true,
          {
            browsers: ['last 2 chrome versions'],
          },
        ],
        'stylelint/color-hex-length': 'short',
      },
      plugins: {
        'stylelint-no-unsupported-browser-features': {},
      },
      extends: [extendSpecifier],
    },
    {
      index: 1,
      name: 'stylelint/override-1',
      files: ['**/*.css'],
      rules: {
        'stylelint/alpha-value-notation': 'percentage',
      },
      extends: [secondaryExtendSpecifier],
    },
    {
      index: 2,
      name: 'stylelint/declared-only',
      files: ['**/*.scss'],
      rules: {
        'stylelint/at-rule-no-unknown': true,
      },
    },
  ],
  rules: {
    [pluginRuleName]: {
      name: pluginRuleName,
      plugin: 'no-unsupported-browser-features',
      pluginPackageName: 'stylelint-no-unsupported-browser-features',
      fixable: false,
      docs: {
        description: 'Disallow unsupported browser features.',
        descriptionSource: 'meta',
        recommended: false,
        url: 'https://example.com/plugin-rule',
        urlSource: 'meta',
      },
    },
    'stylelint/color-hex-length': {
      name: 'stylelint/color-hex-length',
      plugin: 'stylelint',
      fixable: true,
      docs: {
        description: 'Specify short or long notation for hex colors.',
        descriptionSource: 'meta',
        recommended: true,
        url: 'https://example.com/color-hex-length',
        urlSource: 'meta',
      },
    },
    'stylelint/alpha-value-notation': {
      name: 'stylelint/alpha-value-notation',
      plugin: 'stylelint',
      fixable: true,
      docs: {
        description: 'Specify number or percentage notation for alpha values.',
        descriptionSource: 'meta',
        recommended: true,
        url: 'https://example.com/alpha-value-notation',
        urlSource: 'meta',
      },
    },
    'stylelint/at-rule-no-unknown': {
      name: 'stylelint/at-rule-no-unknown',
      plugin: 'stylelint',
      fixable: false,
      docs: {
        description: 'Disallow unknown at-rules.',
        descriptionSource: 'meta',
        recommended: true,
        url: 'https://example.com/at-rule-no-unknown',
        urlSource: 'meta',
      },
    },
  },
  diagnostics: [],
  files: [
    {
      filepath: 'src/example.css',
      globs: ['**/*.css', 'src/**/*.css'],
      configs: [1],
    },
    {
      filepath: 'src/legacy.css',
      globs: ['**/*.css', 'src/**/*.css'],
      configs: [1],
    },
  ],
  extendsInfo: [
    {
      specifier: extendSpecifier,
      source: 'package',
      packageName: 'stylelint-config-recommended',
      docsUrl: 'https://example.com/stylelint-config-recommended',
      docsUrlSource: 'meta',
      ruleCount: 2,
      rules: ['stylelint/color-hex-length', 'stylelint/alpha-value-notation'],
      usedByConfigIndexes: [0],
    },
    {
      specifier: secondaryExtendSpecifier,
      source: 'package',
      packageName: '@scope/stylelint-config-team',
      description: 'Team conventions for stylelint baselines.',
      ruleCount: 1,
      rules: ['stylelint/at-rule-no-unknown'],
      usedByConfigIndexes: [1],
    },
  ],
}

export async function mockPayload(page: Page, payload = MOCK_PAYLOAD): Promise<void> {
  await page.route('**/api/payload.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })
}
