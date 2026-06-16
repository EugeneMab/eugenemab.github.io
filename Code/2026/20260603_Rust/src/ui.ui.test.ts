import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";

// Increase test timeout to allow longer compile/run cycles for many samples
test.setTimeout(300000);

// Prepare logging: write per-sample logs to test-results/ with timestamped file
const LOG_DIR = path.resolve(process.cwd(), "test-results");
const LOG_FILE = path.join(
  LOG_DIR,
  `ui-test-${new Date().toISOString().replace(/[:.]/g, "-")}.log`,
);

async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function writeLog(scope: string, message: string) {
  const line = `${new Date().toISOString()} ${scope} ${message}`;
  try {
    await fs.appendFile(LOG_FILE, line + "\n");
  } catch (e) {
    // If logging fails, print to stderr but do not fail the test
    // eslint-disable-next-line no-console
    console.error("Failed to write test log:", e);
  }
}

test("verify basic compiler flow in UI", async ({ page }) => {
  await ensureLogDir();
  // Announce log file path for CI visibility
  // eslint-disable-next-line no-console
  console.log(`UI test log: ${LOG_FILE}`);
  await writeLog("general", "starting test server");

  // Connect client to page
  await page.goto("/");
  await writeLog("general", "client connected to page /");

  const resultOutput = page.locator("#result-output");
  const statusLine = page.locator("#status-line");

  const runSample = async (value: string, expectedStatus?: string | RegExp) => {
    await writeLog(`case:${value}`, "loading sample");

    // Capture previous status so we can detect progress
    const prevStatus = (await statusLine.textContent()) ?? "";

    // Force change event to fire even if the option was already selected
    await page.evaluate((v) => {
      const sel = document.querySelector<HTMLSelectElement>("#sample-select");
      if (!sel) return;
      sel.value = v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);

    await writeLog(`case:${value}`, "sample change event dispatched");

    // Wait for compile to start (if it does), then for it to finish.
    let compileStarted = false;
    try {
      await page.waitForFunction(
        () => {
          const el = document.getElementById("status-line");
          if (!el) return false;
          return (el.textContent || "").trim() === "Compiling...";
        },
        { timeout: 2000 },
      );
      compileStarted = true;
      await writeLog(`case:${value}`, "compile started");
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
    await writeLog(`case:${value}`, `status:${status.replace(/\r?\n/g, " ")}`);

    if (expectedStatus) {
      await expect(statusLine).toHaveText(expectedStatus, { timeout: 20000 });
    }

    return { status, compileStarted };
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
      await writeLog(
        `case:${val}`,
        "fetching sample text to determine expectation",
      );
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
        const { status } = await runSample(val);
        await writeLog(
          `case:${val}`,
          `expect negative; final status:${status}`,
        );
        const lower = status.toLowerCase();
        if (!lower.includes("error")) {
          const debugOut = await resultOutput.textContent();
          await writeLog(
            `case:${val}`,
            `unexpected success; output:${(debugOut || "").replace(/\r?\n/g, " ")}`,
          );
          throw new Error(
            `Negative sample '${val}' did not error as expected. Status: ${status}`,
          );
        }
      } else {
        // Positive case: must finish successfully (no Error status)
        const { status } = await runSample(val);
        await writeLog(
          `case:${val}`,
          `expect positive; final status:${status}`,
        );
        // Strict: require Execution Finished
        const finished = /^Execution Finished/.test(status);
        if (!finished) {
          const debugOut = await resultOutput.textContent();
          await writeLog(
            `case:${val}`,
            `failure; output:${(debugOut || "").replace(/\r?\n/g, " ")}`,
          );
          throw new Error(
            `Positive sample '${val}' did not finish successfully. Status: ${status}\nResult output:\n${debugOut}`,
          );
        }
      }

      await writeLog(`case:${val}`, "completed sample run successfully");
    } catch (err) {
      const debugOut = await resultOutput.textContent();
      await writeLog(
        `case:${val}`,
        `sample failed; output:${(debugOut || "").replace(/\r?\n/g, " ")}`,
      );
      // eslint-disable-next-line no-console
      console.error(`Sample '${val}' failed. Result output:`, debugOut);
      throw err;
    }
  }
});
