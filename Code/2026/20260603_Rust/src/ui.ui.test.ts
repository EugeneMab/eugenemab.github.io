import { test, expect } from "@playwright/test";

test("verify basic compiler flow in UI", async ({ page }) => {
  await page.goto("http://localhost:7878");

  // Select sample
  await page.selectOption("#sample-select", "basic");

  // Trigger compile
  await page.click("#compile-btn");

  // Check output
  const resultOutput = page.locator("#result-output");
  const watOutput = page.locator("#wat-output");
  const statusLine = page.locator("#status-line");

  // Wait for execution finished
  try {
    await expect(statusLine).toHaveText("Execution Finished", {
      timeout: 10000,
    });
  } catch (e) {
    const errorText = await resultOutput.textContent();
    console.error("Test Failed. Result Output Content:", errorText);
    throw e;
  }

  // Verify results
  await expect(resultOutput).toContainText("60");

  const watText = (await watOutput.textContent()) || "";
  expect(watText).toContain('func (export "main")');
  expect(watText).toContain("i32.add");
});
