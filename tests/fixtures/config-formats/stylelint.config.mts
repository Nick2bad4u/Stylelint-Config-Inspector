export default {
  defaultSeverity: 'warning',
  ignoreFiles: ['**/dist/**', '**/*.min.css'],
  reportNeedlessDisables: true,
  reportInvalidScopeDisables: true,
  rules: {
    'alpha-value-notation': 'number',
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': [
      true,
      {
        ignore: ['consecutive-duplicates-with-different-values'],
      },
    ],
    'selector-class-pattern': [
      '^[a-z][a-z0-9-]+$',
      {
        resolveNestedSelectors: true,
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.scss'],
      rules: {
        'block-no-empty': true,
        'selector-class-pattern': null,
      },
    },
  ],
}
