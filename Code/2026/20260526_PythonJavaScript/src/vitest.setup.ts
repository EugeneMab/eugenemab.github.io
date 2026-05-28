import { vi, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";

// Use per-worker log file to avoid race conditions during parallel test execution
const workerId = process.env.VITEST_POOL_ID || process.pid;
const logFile = path.join(
  process.cwd(),
  "test_output",
  `console.${workerId}.log`,
);

// Ensure directory exists
if (!fs.existsSync(path.dirname(logFile))) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

// Clear log file at start of each worker
fs.writeFileSync(logFile, "");

beforeAll(() => {
  const logToDir = (type: string, ...args: any[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        try {
          return util.inspect(arg, { depth: null, colors: false });
        } catch (e) {
          return `[Unserializable object: ${e}]`;
        }
      })
      .join(" ");
    fs.appendFileSync(logFile, `[${type}] ${message}\n`);
  };

  vi.spyOn(console, "log").mockImplementation((...args) =>
    logToDir("LOG", ...args),
  );
  vi.spyOn(console, "error").mockImplementation((...args) =>
    logToDir("ERROR", ...args),
  );
  vi.spyOn(console, "warn").mockImplementation((...args) =>
    logToDir("WARN", ...args),
  );
});

afterAll(() => {
  vi.restoreAllMocks();
});
