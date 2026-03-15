import { describe, expect, it } from 'vitest'
import {
  configMatchesPluginFilters,
  configMatchesRulePluginFilters,
  getConfigPluginFilters,
  resolveConfigPluginFilter,
  ruleMatchesPluginFilters,
} from '../shared/config-plugin-filters'

describe('config plugin filters', () => {
  it('maps plugin package names to the corresponding rule plugin filter', () => {
    const knownRulePlugins = new Set(['defensive-css', '@acme/layout'])

    expect(
      resolveConfigPluginFilter(
        'stylelint-plugin-defensive-css',
        knownRulePlugins,
      ),
    ).toBe('defensive-css')

    expect(
      resolveConfigPluginFilter(
        '@acme/stylelint-plugin-layout',
        knownRulePlugins,
      ),
    ).toBe('@acme/layout')
  })

  it('collects config plugin filters from explicit plugins and configured rule prefixes', () => {
    const knownRulePlugins = new Set(['defensive-css', '@acme/layout'])
    const config = {
      index: 0,
      plugins: {
        'stylelint-plugin-defensive-css': {},
        '@acme/stylelint-plugin-layout': {},
      },
      rules: {
        'defensive-css/require-background-repeat': true,
        '@acme/layout/no-gap-hack': true,
        'color-no-invalid-hex': true,
      },
    }

    expect(getConfigPluginFilters(config, knownRulePlugins)).toEqual([
      '@acme/layout',
      'defensive-css',
    ])
  })

  it('matches configs against selected plugin filters', () => {
    const knownRulePlugins = new Set(['defensive-css'])
    const config = {
      index: 0,
      plugins: {
        'stylelint-plugin-defensive-css': {},
      },
      rules: {
        'defensive-css/require-background-repeat': true,
      },
    }

    expect(
      configMatchesPluginFilters(config, ['defensive-css'], knownRulePlugins),
    ).toBe(true)
    expect(
      configMatchesPluginFilters(config, ['stylelint'], knownRulePlugins),
    ).toBe(false)
  })

  it('matches rule names against selected plugin filters', () => {
    expect(
      ruleMatchesPluginFilters('defensive-css/require-background-repeat', ['defensive-css']),
    ).toBe(true)
    expect(
      ruleMatchesPluginFilters('@acme/layout/no-gap-hack', ['@acme/layout']),
    ).toBe(true)
    expect(
      ruleMatchesPluginFilters('color-no-invalid-hex', ['defensive-css']),
    ).toBe(false)
  })

  it('matches config plugin filters only when the config actually declares plugin-scoped rules', () => {
    const config = {
      index: 0,
      plugins: {
        'stylelint-plugin-use-nesting': {},
      },
      rules: {
        'color-no-invalid-hex': true,
      },
    }

    expect(
      configMatchesRulePluginFilters(config, ['use-nesting']),
    ).toBe(false)
  })
})
