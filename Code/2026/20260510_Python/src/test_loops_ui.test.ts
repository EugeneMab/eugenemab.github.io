import { test, expect } from "@playwright/test";

test("verify loops and strings sample in UI", async ({ page }) => {
  await page.goto("http://localhost:7895");

  // Select the "Loops & Strings" sample
  await page.selectOption("#sample-select", "sample/loops_and_strings.py");

  // Monitor for console errors
  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`);
    }
  });

  // Wait for result to appear (timeout 5s)
  const resultOutput = page.locator("#result-output");
  await expect(resultOutput).not.toBeEmpty({ timeout: 10000 });
  
  // Check for error in result
  const text = await resultOutput.innerText();
  if (text.includes("Error:")) {
      console.error("UI Error detected:", text);
  }
  
  expect(text).not.toContain("Error:");
  expect(text).toContain("1 * 1 = 1");
  expect(text).toContain("9 * 9 = 81");
  expect(text).toContain("Print: 4"); // last iteration of do-while
});

test("verify comprehensions sample in UI", async ({ page }) => {
    await page.goto("http://localhost:7895");
  
    // Select the "Comprehensions" sample
    await page.selectOption("#sample-select", "sample/comprehensions.py");
  
    // Wait for result to appear
    const resultOutput = page.locator("#result-output");
    await expect(resultOutput).not.toBeEmpty({ timeout: 10000 });
    
    const text = await resultOutput.innerText();
    expect(text).not.toContain("Error:");
    expect(text).toContain("Result: 0");
  });
