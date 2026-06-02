import { test, expect } from '@playwright/test'

function mockFetch(page: any, body: any) {
  return page.addInitScript(`
    (() => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/scan') && init?.method === 'POST') {
          return new Response(JSON.stringify(${JSON.stringify(body)}), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(input, init);
      };
    })();
  `)
}

const mockFindings = {
  findings: [
    { check_name: 'perm-check', severity: 'High', file_path: 'src/lib.rs', line: 10, function_name: 'transfer', description: 'Permalink finding' },
  ],
}

test('creates permalink and navigates to it', async ({ page, context }) => {
  await mockFetch(page, mockFindings)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.goto('/')
  await page.locator('textarea').first().fill('pub fn test() {}')
  await page.locator('button:has-text("Scan Contract")').click()
  await page.waitForURL(/\/results/)

  // Click the copy results link button (has title)
  await page.click('button[title="Copy results link"]')

  // Read clipboard and navigate to copied URL
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  await page.goto(copied)

  // Verify findings are displayed
  await expect(page.locator('text=perm-check')).toBeVisible()
  await expect(page.locator('text=Permalink finding')).toBeVisible()
})
