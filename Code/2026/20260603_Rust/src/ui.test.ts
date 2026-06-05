import { test, expect } from '@playwright/test';

test('verify basic compiler flow in UI', async ({ page }) => {
  await page.goto('http://localhost:7878');

  // Trigger compile
  await page.click('#compile-btn');

  // Check output
  const resultOutput = page.locator('#result-output');
  const watOutput = page.locator('#wat-output');
  const statusLine = page.locator('#status-line');

  // Wait for execution finished
  await expect(statusLine).toHaveText('Execution Finished', { timeout: 10000 });

  // Verify results
  await expect(resultOutput).toContainText('Return: 60');
  
  const watText = (await watOutput.textContent()) || '';
  expect(watText).toContain('func (export "main")');
  expect(watText).toContain('i32.add');
});
