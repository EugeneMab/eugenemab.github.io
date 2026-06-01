import { test, expect } from "@playwright/test";

const samples = [
  {
    name: "Basic Return",
    value: "sample/basic.py",
    js: ["main = async function", "return 42"],
  },
  {
    name: "Variables & Math",
    value: "sample/variables.py",
    js: ["x = 10", "y = 20"],
  },
  {
    name: "Complex Math",
    value: "sample/complex.py",
    js: ["__add", "__mul", "__div"],
  },
  {
    name: "Function Parameters",
    value: "sample/params.py",
    js: ["add = async function(a, b)", "await add(10, 32)"],
  },
  {
    name: "Lists & Slicing",
    value: "sample/slicing.py",
    js: ["__slice", "[10, 20, 30, 40, 50]"],
  },
  {
    name: "Comprehensions",
    value: "sample/comprehensions.py",
    js: ["__iter", "res.push", "const i"],
  },
  {
    name: "Context Managers",
    value: "sample/context_managers.py",
    js: ["__enter__", "__exit__", "try", "finally"],
  },
  {
    name: "Types & Casting",
    value: "sample/types_casting.py",
    js: ["int", "float", "bool", "chr", "ord", "__true"],
  },
  {
    name: "Core Collection Types",
    value: "sample/collections.py",
    js: ["__tuple", "__set", "__dict", "__bytes"],
  },
  {
    name: "Foundational Operators",
    value: "sample/operators.py",
    js: [
      "__floordiv",
      "__mod",
      "__pow",
      "__and_bw",
      "__or_bw",
      "__xor_bw",
      "__invert",
      "__lshift",
      "__rshift",
      "__in",
    ],
  },
  {
    name: "Global Built-ins",
    value: "sample/builtins.py",
    js: [
      "sum",
      "min",
      "max",
      "any",
      "all",
      "enumerate",
      "zip",
      "reversed",
      "sorted",
      "type",
      "isinstance",
      "callable",
    ],
  },
  {
    name: "Scoping & Assignment",
    value: "sample/scoping_assignment.py",
    js: ["__call", "slice", "__unpack"],
  },
  {
    name: "Functional Programming",
    value: "sample/functional.py",
    js: ["async", "=>", "map", "filter", "reduce"],
  },
  {
    name: "Basic Classes & Objects",
    value: "sample/methods.py",
    js: [
      "strip",
      "split",
      "join",
      "upper",
      "replace",
      "append",
      "extend",
      "insert",
      "remove",
      "pop",
      "sort",
      "reverse",
    ],
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
    const statusLine = page.locator("#status-line");

    // Wait for result box to contain "Result:" or an error
    try {
      await expect(resultOutput).toContainText(/Result:|Error:/, {
        timeout: 15000,
      });
    } catch (_e) {
      const statusText = await statusLine.textContent();
      const resultText = await resultOutput.textContent();
      throw new Error(
        `Timeout waiting for result in ${sample.name}. Status: ${statusText}, Result: ${resultText}`,
        { cause: _e },
      );
    }

    const resultText = (await resultOutput.textContent()) || "";
    if (resultText.includes("Error:")) {
      errors.push(`Sample ${sample.name} failed with: ${resultText}`);
    }

    // Verify JS content
    const jsText = (await jsOutput.textContent()) || "";
    for (const marker of sample.js) {
      if (!jsText.includes(marker)) {
        errors.push(`Sample ${sample.name} missing JS marker: ${marker}`);
      }
    }

    // Verify Lexicon and AST are not empty
    const lexOutput = page.locator("#lex-output");
    const astOutput = page.locator("#ast-output");
    const lexText = (await lexOutput.textContent()) || "";
    const astText = (await astOutput.textContent()) || "";

    if (lexText.trim() === "") {
      errors.push(`Sample ${sample.name} has empty Lexicon`);
    }
    if (astText.trim() === "" || astText.trim() === "null") {
      errors.push(`Sample ${sample.name} has empty or null AST`);
    }
  }

  expect(errors).toEqual([]);
});
