import { test, expect } from "@playwright/test";

test("verify basic compiler flow in UI", async ({ page }) => {
  await page.goto("/");

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
  const outputText = (await resultOutput.textContent()) ?? "";
  expect(outputText.match(/42/g)?.length).toBe(2); // dec + hex

  // Verify Step 9: Panic
  await page.selectOption("#sample-select", "panic");
  await expect(statusLine).toContainText("Panic! Error code: 456", {
    timeout: 10000,
  });
  const panicOutput = (await resultOutput.textContent()) ?? "";
  expect(panicOutput).toContain("123");
  expect(panicOutput).toContain("Panic! Error code: 456");

  // Verify Step 10: Scope
  await page.selectOption("#sample-select", "scope");
  await expect(statusLine).toHaveText("Execution Finished", { timeout: 10000 });
  const scopeOutput = (await resultOutput.textContent()) ?? "";
  expect(scopeOutput.trim()).toBe("2\n1");

  // Verify Step 11: Regions
  await page.selectOption("#sample-select", "regions");
  await expect(statusLine).toHaveText("Execution Finished", { timeout: 10000 });
  const regionsOutput = (await resultOutput.textContent()) ?? "";
  expect(regionsOutput.trim()).toBe("16\n16");

  // Verify Step 12: Borrow
  await page.selectOption("#sample-select", "borrow");
  await expect(statusLine).toHaveText("Execution Finished", { timeout: 10000 });

  // Verify Book 1-2: Hello World
  await page.selectOption("#sample-select", "book01_02_hello");
  await expect(statusLine).toHaveText("Execution Finished", { timeout: 10000 });
  const helloOutput = (await resultOutput.textContent()) ?? "";
  expect(helloOutput.trim()).toBe("Hello, world!");
});
