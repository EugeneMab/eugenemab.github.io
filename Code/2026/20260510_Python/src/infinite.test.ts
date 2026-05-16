import { test, expect } from "@playwright/test";

test("verify infinite loop and abort", async ({ page }) => {
  await page.goto("http://localhost:7895");

  console.log("Testing Infinite Loop Sample");

  // Select infinite loop sample
  await page.selectOption("#sample-select", "sample/infinite.py");

  // Verify editor content - wait for it to load
  const editor = page.locator("#editor");
  await expect(editor).toHaveValue(/while True:/, { timeout: 10000 });

  // Trigger compile & run
  await page.click("#compile-btn");

  const resultOutput = page.locator("#result-output");

  // Wait for at least 5 print iterations
  console.log("Waiting for 5 iterations...");
  for (let i = 0; i < 5; i++) {
    await expect(resultOutput).toContainText(`Print: ${i}`, { timeout: 10000 });
    console.log(`Iteration ${i} detected.`);
  }

  // Abort execution
  console.log("Aborting execution...");
  await page.click("#abort-btn");

  // Verify status
  const statusLine = page.locator("#status-line");
  await expect(statusLine).toContainText("Error: Aborted");
  await expect(resultOutput).toContainText("Execution aborted by user.");

  console.log("✅ Infinite Loop test passed.");
});
