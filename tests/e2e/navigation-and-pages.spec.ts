import { expect, test } from '@playwright/test'
import { configSummarySlotCount, orderedNavLinkTestIds, testIds } from '../../shared/test-ids'
import {
  extendSpecifier,
  MOCK_PAYLOAD,
  mockPayload,
  secondaryExtendSpecifier,
} from './fixtures/mock-payload'

test.describe('navigation and page regressions', () => {
  test('navbar links navigate to each page and toggle active state', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/configs')

    const navTargets = [
      { testId: testIds.nav.configsLink, path: '/configs' },
      { testId: testIds.nav.rulesLink, path: '/rules' },
      { testId: testIds.nav.extendsLink, path: '/extends' },
      { testId: testIds.nav.filesLink, path: '/files' },
      { testId: testIds.nav.devLink, path: '/dev' },
    ] as const

    for (const target of navTargets) {
      const link = page.getByTestId(target.testId)

      await link.click()
      await expect(page).toHaveURL(new RegExp(`${target.path}/?$`))
      await expect(link).toHaveClass(/btn-action-active/)
    }
  })

  test('navbar keeps expected tab order', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/configs')

    const links = orderedNavLinkTestIds.map(testId => page.getByTestId(testId).first())

    for (const link of links)
      await expect(link).toBeVisible()

    const boxes = await Promise.all(links.map(link => link.boundingBox()))
    const xs = boxes.map(box => box?.x ?? -1)

    expect(xs.every(x => x >= 0)).toBe(true)
    expect(xs).toEqual(xs.toSorted((left, right) => left - right))
  })

  test('configs page keeps fixed icon slots for summary alignment', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/configs')

    const summaryRows = page.getByTestId(testIds.configs.summaryGrid)
    await expect(summaryRows).toHaveCount(3)

    const slotCounts = await summaryRows.evaluateAll(rows =>
      rows.map(row => row.childElementCount),
    )

    expect(slotCounts).toEqual([configSummarySlotCount, configSummarySlotCount, configSummarySlotCount])
  })

  test('files page supports collapsible matched-file sections', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/files')

    await page.getByTestId(testIds.files.viewListButton).click()

    const groupDetails = page.getByTestId(testIds.files.matchedListDetails)
    await expect(groupDetails).toHaveAttribute('open', '')

    const summary = page.getByTestId(testIds.files.matchedListSummary)
    await summary.click()
    await expect(groupDetails).not.toHaveAttribute('open', '')

    await summary.click()
    await expect(groupDetails).toHaveAttribute('open', '')
  })

  test('files page toggles between list and group tabs with visible active mode', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/files')

    const listModeButton = page.getByTestId(testIds.files.viewListButton)
    const groupModeButton = page.getByTestId(testIds.files.viewGroupsButton)

    await groupModeButton.click()
    await expect(groupModeButton).toHaveClass(/btn-action-active/)
    await expect(page.getByTestId(testIds.files.groupIdentityLabel).first()).toBeVisible()

    await listModeButton.click()
    await expect(listModeButton).toHaveClass(/btn-action-active/)
    await expect(page.getByTestId(testIds.files.matchedListDetails)).toBeVisible()
  })

  test('files page renders context labels for group type metadata', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/files')

    await page.getByTestId(testIds.files.viewGroupsButton).click()

    const groupLabels = page.getByTestId(testIds.files.groupIdentityLabel)
    await expect(groupLabels.filter({ hasText: 'Config' }).first()).toBeVisible()
    await expect(groupLabels.filter({ hasText: 'Workspace scan' }).first()).toBeVisible()
    await expect(groupLabels.filter({ hasText: 'Glob' }).first()).toBeVisible()
  })

  test('extends page renders rule list in list layout and includes all exported rules', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/extends')

    await expect(page.getByTestId(testIds.extends.specifierButton).filter({ hasText: extendSpecifier }).first()).toBeVisible()
    await expect(page.getByText('stylelint/color-hex-length').first()).toBeVisible()
    await expect(page.getByText('stylelint/alpha-value-notation').first()).toBeVisible()

    const rulesListContainer = page.getByTestId(testIds.extends.rulesListContainer)

    await expect(rulesListContainer).toBeVisible()

    await expect(rulesListContainer.locator('div[style*="grid-template-columns"]').first()).toHaveAttribute('style', /40px/)
  })

  test('extends page switches active extends entry and updates visible rules', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/extends')

    const primaryButton = page.getByTestId(testIds.extends.specifierButton).filter({ hasText: extendSpecifier }).first()
    const secondaryButton = page.getByTestId(testIds.extends.specifierButton).filter({ hasText: secondaryExtendSpecifier }).first()
    const rulesListContainer = page.getByTestId(testIds.extends.rulesListContainer)

    await expect(primaryButton).toBeVisible()
    await expect(secondaryButton).toBeVisible()

    await secondaryButton.click()

    await expect(secondaryButton).toHaveClass(/bg-active/)
    await expect(rulesListContainer.getByText('stylelint/at-rule-no-unknown')).toBeVisible()
    await expect(rulesListContainer.getByText('stylelint/color-hex-length')).toHaveCount(0)
    await expect(page.locator('a[href="/configs?index=2"]').first()).toBeVisible()
  })

  test('extends docs button only appears for entries with docs metadata', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/extends')

    const primaryButton = page.getByTestId(testIds.extends.specifierButton).filter({ hasText: extendSpecifier }).first()
    const secondaryButton = page.getByTestId(testIds.extends.specifierButton).filter({ hasText: secondaryExtendSpecifier }).first()
    const docsButton = page.getByRole('link', { name: 'Docs' })

    await primaryButton.click()
    await expect(docsButton).toBeVisible()
    await expect(docsButton).toHaveAttribute('href', 'https://example.com/stylelint-config-recommended')

    await secondaryButton.click()
    await expect(docsButton).toHaveCount(0)
  })

  test('extends page shows fallback metadata copy when description/plugins/syntax are missing', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/extends')

    const primaryButton = page.getByTestId(testIds.extends.specifierButton).filter({ hasText: extendSpecifier }).first()
    await primaryButton.click()

    await expect(page.getByText('No package description metadata was found for this extended config.')).toBeVisible()
    await expect(page.getByText('No direct extends entries were detected.')).toBeVisible()
    await expect(page.getByText('No plugin metadata detected.')).toBeVisible()
    await expect(page.getByText('No custom syntax metadata detected.')).toBeVisible()
  })

  test('extends page renders a no-extends empty state when payload has no extends info', async ({ page }) => {
    await mockPayload(page, {
      ...MOCK_PAYLOAD,
      extendsInfo: [],
    })
    await page.goto('/extends')

    await expect(page.getByText('No extended configs were found in the current payload.')).toBeVisible()
    await expect(page.getByTestId(testIds.extends.specifierButton)).toHaveCount(0)
  })
})
