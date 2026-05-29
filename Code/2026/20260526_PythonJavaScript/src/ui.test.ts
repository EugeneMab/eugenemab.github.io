import { test, expect } from "@playwright/test";

const samples = [
  {
    name: "Basic Return",
    value: "sample/basic.py",
    js: ["async function main", "return 42"],
  },
  {
    name: "Variables & Math",
    value: "sample/variables.py",
    js: ["x = 10", "y = 20"],
  },
  {
    name: "Complex Math",
    value: "sample/complex.py",
    js: ["+", "*", "/"],
  },
  {
    name: "Function Parameters",
    value: "sample/params.py",
    js: ["async function add(a, b)", "await add(10, 32)"],
  },
  {
    name: "Lists & Slicing",
    value: "sample/slicing.py",
    js: ["runtime._slice", "[10, 20, 30, 40, 50]"],
  },
  {
    name: "Comprehensions",
    value: "sample/comprehensions.py",
    js: ["for await", "res.push", "const i"],
  },
  {
    name: "Context Managers",
    value: "sample/context_managers.py",
    js: ["__enter__", "__exit__", "try", "finally"],
  },
  {
    name: "Types & Casting",
    value: "sample/types_casting.py",
    js: ["int", "float", "bool", "chr", "ord", "runtime._is_truthy"],
  },
];

test("verify all samples in UI including JS", async ({ page }) => {
  await page.goto("http://localhost:17957");

  // Monitor for console errors
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
      console.log(`Browser Error: ${msg.text()}`);
    }
  });

  for (const sample of samples) {
    console.log(`Testing Sample: ${sample.name}`);

    // Select sample
    await page.selectOption("#sample-select", sample.value);

    // Wait for editor to be populated
    await page.waitForFunction(
      () =>
        (document.getElementById("editor") as HTMLTextAreaElement).value
          .length > 0,
    );

    // Trigger compile
    await page.click("#compile-btn");

    // Check outputs
    const resultOutput = page.locator("#result-output");
    const jsOutput = page.locator("#js-output");

    // Wait for result box to contain "Result:"
    await expect(resultOutput).toContainText("Result:");

    // Verify JS content
    const jsText = (await jsOutput.textContent()) || "";
    for (const marker of sample.js) {
      expect(jsText).toContain(marker);
    }

    console.log(`✅ Sample ${sample.name} passed.`);
  }

  expect(errors).toHaveLength(0);
});
