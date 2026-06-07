import { test, expect } from "@playwright/test";

test("verify basic compiler flow in UI", async ({ page }) => {
  await page.goto("/");

  const resultOutput = page.locator("#result-output");
  const statusLine = page.locator("#status-line");

  const runSample = async (value: string, expectedStatus: string | RegExp) => {
    const previousResult = (await resultOutput.textContent()) ?? "";
    await page.selectOption("#sample-select", value);
    await expect
      .poll(async () => (await resultOutput.textContent()) ?? "", {
        timeout: 10000,
      })
      .not.toBe(previousResult);
    await expect(statusLine).toHaveText(expectedStatus, {
      timeout: 10000,
    });
  };

  // Select sample
  try {
    await runSample("lexer", "Execution Finished");
  } catch (e) {
    const errorText = await resultOutput.textContent();
    console.error("Test Failed. Result Output Content:", errorText);
    throw e;
  }

  // Verify results for lexer sample (Step 2)
  const outputText = (await resultOutput.textContent()) ?? "";
  expect(outputText.match(/42/g)?.length).toBe(2); // dec + hex

  // Verify Step 9: Panic
  await runSample("panic", /Panic! Error code: 456/);
  const panicOutput = (await resultOutput.textContent()) ?? "";
  expect(panicOutput).toContain("123");
  expect(panicOutput).toContain("Panic! Error code: 456");

  // Verify Step 10: Scope
  await runSample("scope", "Execution Finished");
  const scopeOutput = (await resultOutput.textContent()) ?? "";
  expect(scopeOutput.trim()).toBe("2\n1");

  // Verify Step 11: Regions
  await runSample("regions", "Execution Finished");
  const regionsOutput = (await resultOutput.textContent()) ?? "";
  expect(regionsOutput.trim()).toBe("16\n16");

  // Verify Step 12: Borrow
  await runSample("borrow", "Execution Finished");

  // Verify Book 1-2: Hello World
  await runSample("book01_02_hello", "Execution Finished");
  const helloOutput = (await resultOutput.textContent()) ?? "";
  expect(helloOutput.trim()).toBe("Hello, world!");

  // Verify Book 2-0: Guessing Game Variables
  await runSample("book02_00_vars", "Execution Finished");
  const varsOutput = (await resultOutput.textContent()) ?? "";
  expect(varsOutput.trim()).toBe("5\n5");

  // Verify Book 4-1: Variable Scope
  await runSample("book04_01_scope", "Execution Finished");
  const scopeChapterOutput = (await resultOutput.textContent()) ?? "";
  expect(scopeChapterOutput.trim()).toBe("inner y: \n20\nouter x: \n10");
});
