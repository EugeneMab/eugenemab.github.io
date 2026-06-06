import { test, expect } from "@playwright/test";

test("verify basic compiler flow in UI", async ({ page }) => {
  await page.goto("http://localhost:7878");

  // Select sample
  await page.selectOption("#sample-select", "lexer");

  // Check output
  const resultOutput = page.locator("#result-output");
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

  // Verify results for lexer sample (Step 2)
  await expect(resultOutput).toContainText("42");
  const outputText = (await resultOutput.textContent()) ?? "";
  expect(outputText.match(/42/g)?.length).toBe(2); // dec + hex
});
