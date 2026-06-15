import { test, expect } from "@playwright/test";

// Increase test timeout to allow longer compile/run cycles for many samples
test.setTimeout(300000);

test("verify basic compiler flow in UI", async ({ page }) => {
  await page.goto("/");

  const resultOutput = page.locator("#result-output");
  const statusLine = page.locator("#status-line");

  const runSample = async (value: string, expectedStatus?: string | RegExp) => {
    // Capture previous status so we can detect progress
    const prevStatus = (await statusLine.textContent()) ?? "";

    // Force change event to fire even if the option was already selected
    await page.evaluate((v) => {
      const sel = document.querySelector<HTMLSelectElement>("#sample-select");
      if (!sel) return;
      sel.value = v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);

    // Wait for compile to start (if it does), then for it to finish.
    try {
      await page.waitForFunction(
        () => {
          const el = document.getElementById("status-line");
          if (!el) return false;
          return (el.textContent || "").trim() === "Compiling...";
        },
        { timeout: 2000 },
      );
    } catch {
      // compile may start quickly; continue anyway
    }

    await page.waitForFunction(
      (prev) => {
        const el = document.getElementById("status-line");
        if (!el) return true;
        const txt = (el.textContent || "").trim();
        return txt !== "Compiling..." && txt !== prev;
      },
      prevStatus,
      { timeout: 180000 },
    );

    const status = (await statusLine.textContent()) ?? "";

    if (expectedStatus) {
      await expect(statusLine).toHaveText(expectedStatus, { timeout: 20000 });
    }

    return status;
  };

  // Ensure every sample option in the UI can be loaded and exercised to avoid regressions
  const options = await page.$$eval("#sample-select option", (opts) =>
    opts
      .map((o) => ({ value: o.value, text: (o.textContent || "").trim() }))
      .filter((v) => v.value && v.value.length > 0),
  );

  const origin = new URL(await page.url()).origin;

  for (const opt of options) {
    const val = opt.value;
    try {
      // Fetch sample text to decide positive vs negative expectations
      const sampleUrl = new URL(`/samples/${val}.rs`, origin).href;
      let sampleText = "";
      try {
        const resp = await page.request.get(sampleUrl);
        if (resp.ok()) sampleText = await resp.text();
      } catch {
        // ignore, fallback to runtime-loaded content
      }

      const isNegative =
        /negative/i.test(val) ||
        /negative/i.test(opt.text) ||
        /Negative|expected to fail|FAIL/i.test(sampleText);

      if (isNegative) {
        // Negative case: must produce an error status
        const status = await runSample(val);
        expect(status.toLowerCase()).toContain("error");
      } else {
        // Positive case: must finish successfully (no Error status)
        const status = await runSample(val);
        // Strict: require Execution Finished
        const finished = /^Execution Finished/.test(status);
        if (!finished) {
          const debugOut = await resultOutput.textContent();
          throw new Error(
            `Positive sample '${val}' did not finish successfully. Status: ${status}\nResult output:\n${debugOut}`,
          );
        }
      }
    } catch (err) {
      const debugOut = await resultOutput.textContent();
      console.error(`Sample '${val}' failed. Result output:`, debugOut);
      throw err;
    }
  }
});
