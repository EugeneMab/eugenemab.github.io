import { test, expect } from "@playwright/test";

const samples = [
  {
    name: "Basic Return",
    value: "sample/basic.py",
    wat: ["func $main", "i32.const 42"],
  },
  {
    name: "Variables & Math",
    value: "sample/variables.py",
    wat: ["local.set $x", "local.get $x"],
  },
  {
    name: "Complex Math",
    value: "sample/complex.py",
    wat: ["i32.add", "i32.mul"],
  },
  {
    name: "Function Parameters",
    value: "sample/params.py",
    wat: ["param $a", "param $b", "call $add"],
  },
  {
    name: "Lists & Slicing",
    value: "sample/slicing.py",
    wat: ["call $_slice", "call $_get_item"],
  },
  {
    name: "Comprehensions",
    value: "sample/comprehensions.py",
    wat: ["loop", "i32.store", "local.get $i"],
  },
];

test("verify all samples in UI including WAT", async ({ page }) => {
  await page.goto("http://localhost:7895");

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
    const watOutput = page.locator("#wat-output");

    // Wait for result box to contain "Result:"
    await expect(resultOutput).toContainText("Result:");

    // Verify WAT content
    const watText = (await watOutput.textContent()) || "";
    for (const marker of sample.wat) {
      expect(watText).toContain(marker);
    }

    console.log(`✅ Sample ${sample.name} passed.`);
  }

  expect(errors).toHaveLength(0);
});
