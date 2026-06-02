import { test, expect } from '@playwright/test'
import fs from 'fs/promises'

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
    { check_name: 'export-check', severity: 'Medium', file_path: 'src/lib.rs', line: 2, function_name: 'foo', description: 'Export test' },
  ],
}

test.describe('Export downloads', () => {
  test('downloads JSON, CSV and Markdown', async ({ page }) => {
    await mockFetch(page, mockFindings)

    await page.goto('/')
    await page.locator('textarea').first().fill('pub fn test() {}')
    await page.locator('button:has-text("Scan Contract")').click()
    await page.waitForURL(/\/results/)

    // JSON
    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download JSON")'),
    ])
    const jsonPath = await jsonDownload.path()
    const jsonContent = await fs.readFile(jsonPath!, 'utf8')
    expect(jsonContent).toContain('export-check')

    // CSV
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download CSV")'),
    ])
    const csvPath = await csvDownload.path()
    const csvContent = await fs.readFile(csvPath!, 'utf8')
    expect(csvContent).toContain('check_name')
    expect(csvContent).toContain('export-check')

    // Markdown
    const [mdDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download Markdown")'),
    ])
    const mdPath = await mdDownload.path()
    const mdContent = await fs.readFile(mdPath!, 'utf8')
    expect(mdContent).toContain('# Soroban Guard Security Report')
    expect(mdContent).toContain('export-check')
  })
})
