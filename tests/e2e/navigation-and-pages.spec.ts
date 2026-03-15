import { expect, test } from '@playwright/test'
import { extendSpecifier, mockPayload } from './fixtures/mock-payload'

test.describe('navigation and page regressions', () => {
  test('navbar keeps expected tab order', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/configs')

    const links = [
      page.getByRole('link', { name: /configs/i }).first(),
      page.getByRole('link', { name: /rules/i }).first(),
      page.getByRole('link', { name: /extends/i }).first(),
      page.getByRole('link', { name: /files/i }).first(),
      page.getByRole('link', { name: /dev/i }).first(),
    ]

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

    const summaryRows = page.locator('.flat-config-item .grid-cols-7')
    await expect(summaryRows).toHaveCount(3)

    const slotCounts = await summaryRows.evaluateAll(rows =>
      rows.map(row => row.childElementCount),
    )

    expect(slotCounts).toEqual([7, 7, 7])
  })

  test('files page supports collapsible matched-file sections', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/files')

    const groupDetails = page.locator('details').filter({ hasText: 'Matched Local Files' }).first()
    await expect(groupDetails).toHaveAttribute('open', '')

    const summary = groupDetails.locator('summary').first()
    await summary.click()
    await expect(groupDetails).not.toHaveAttribute('open', '')

    await summary.click()
    await expect(groupDetails).toHaveAttribute('open', '')
  })

  test('files page renders context labels for group type metadata', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/files')

    await expect(page.getByText('Config').first()).toBeVisible()
    await expect(page.getByText('Workspace scan').first()).toBeVisible()
    await expect(page.getByText('Glob').first()).toBeVisible()
  })

  test('extends page renders rule list in list layout and includes all exported rules', async ({ page }) => {
    await mockPayload(page)
    await page.goto('/extends')

    await expect(page.getByRole('button', { name: extendSpecifier }).first()).toBeVisible()
    await expect(page.getByText('stylelint/color-hex-length').first()).toBeVisible()
    await expect(page.getByText('stylelint/alpha-value-notation').first()).toBeVisible()

    const rulesListContainer = page
      .locator('div[style*="grid-template-columns"]')
      .filter({ hasText: 'stylelint/color-hex-length' })
      .first()

    await expect(rulesListContainer).toBeVisible()
    await expect(rulesListContainer).toHaveAttribute('style', /40px/)
  })
})
