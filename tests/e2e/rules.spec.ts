import { expect, test } from '@playwright/test'
import { mockPayload, pluginRuleName } from './fixtures/mock-payload'

async function openRulesPage(page: import('@playwright/test').Page): Promise<void> {
  await mockPayload(page)
  await page.goto('/rules')
  await expect(page.getByPlaceholder('Search rules...')).toBeVisible()
  await expect(page.getByText('out of 4 rules')).toBeVisible()
}

async function filterToRule(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.getByPlaceholder('Search rules...').fill(name)
  await expect(page.locator('.colorized-rule-name').filter({ hasText: name }).first()).toBeVisible()
}

test.describe('rules page regressions', () => {
  test('plugin-prefixed rules expose clear provenance in tooltip and popup', async ({ page }) => {
    await openRulesPage(page)
    await filterToRule(page, pluginRuleName)

    const ruleBadgeButton = page.locator('.colorized-rule-name').filter({ hasText: pluginRuleName }).first()
    const prefixHintButton = ruleBadgeButton.locator('xpath=preceding-sibling::button[1]')

    await expect(prefixHintButton).toBeVisible()

    await prefixHintButton.hover()
    const hintTooltip = page.locator('.v-popper--theme-tooltip .v-popper__inner').first()
    await expect(hintTooltip).toContainText('generic plugin/ prefix')

    await ruleBadgeButton.click()

    const rulePopup = page.locator('.v-popper--theme-dropdown .v-popper__inner').filter({ hasText: 'Copy name' }).first()
    await expect(rulePopup).toBeVisible()
    await expect(rulePopup).toContainText('Rule name')
    await expect(rulePopup.locator('code').filter({ hasText: pluginRuleName })).toBeVisible()
  })

  test('rule badge button is visually reset (no default button chrome)', async ({ page }) => {
    await openRulesPage(page)
    await filterToRule(page, pluginRuleName)

    const ruleBadgeButton = page.locator('.colorized-rule-name--button').filter({ hasText: pluginRuleName }).first()
    await expect(ruleBadgeButton).toBeVisible()

    const css = await ruleBadgeButton.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        borderTopWidth: style.borderTopWidth,
        borderStyle: style.borderStyle,
        paddingLeft: style.paddingLeft,
      }
    })

    expect(css.borderTopWidth).toBe('0px')
    expect(css.borderStyle).toBe('none')
    expect(css.paddingLeft).toBe('0px')
  })

  test('rule-name tooltip wraps long content and uses multiline styling', async ({ page }) => {
    await openRulesPage(page)
    await filterToRule(page, pluginRuleName)

    const ruleBadgeButton = page.locator('.colorized-rule-name').filter({ hasText: pluginRuleName }).first()
    await ruleBadgeButton.hover()

    const tooltip = page.locator('.v-popper--theme-tooltip .v-popper__inner').first()
    await expect(tooltip).toBeVisible()

    const tooltipStyles = await tooltip.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        whiteSpace: style.whiteSpace,
        overflowWrap: style.overflowWrap,
        maxInlineSize: style.maxInlineSize,
      }
    })

    expect(tooltipStyles.whiteSpace).toBe('pre-line')
    expect(tooltipStyles.overflowWrap).toBe('anywhere')
    expect(tooltipStyles.maxInlineSize).not.toBe('none')
  })

  test('plugin filter chips visibly react on hover (clickable affordance)', async ({ page }) => {
    await openRulesPage(page)

    const pluginFilterChip = page.getByRole('button', { name: 'All plugins' })
    await expect(pluginFilterChip).toBeVisible()

    const beforeHoverShadow = await pluginFilterChip.evaluate(element => getComputedStyle(element).boxShadow)
    await pluginFilterChip.hover()
    const afterHoverShadow = await pluginFilterChip.evaluate(element => getComputedStyle(element).boxShadow)

    expect(beforeHoverShadow).not.toBe(afterHoverShadow)
    expect(afterHoverShadow).not.toBe('none')
  })

  test('list/grid toggle works and preserves rule visibility', async ({ page }) => {
    await openRulesPage(page)

    const gridButton = page.getByRole('button', { name: 'Grid' })
    await gridButton.click()
    await expect(gridButton).toHaveClass(/btn-action-active/)

    await expect(page.locator('.colorized-rule-name').first()).toBeVisible()

    const listButton = page.getByRole('button', { name: 'List' })
    await listButton.click()
    await expect(listButton).toHaveClass(/btn-action-active/)
    await expect(page.locator('.colorized-rule-name').first()).toBeVisible()
  })
})
