import { vi, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
const logFile = path.join(process.cwd(), "test_output", "console.log");
// Ensure directory exists
if (!fs.existsSync(path.dirname(logFile))) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
}
// Clear log file at start
fs.writeFileSync(logFile, "");
beforeAll(() => {
    const logToDir = (type, ...args) => {
        const message = args
            .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
            .join(" ");
        fs.appendFileSync(logFile, `[${type}] ${message}\n`);
    };
    vi.spyOn(console, "log").mockImplementation((...args) => logToDir("LOG", ...args));
    vi.spyOn(console, "error").mockImplementation((...args) => logToDir("ERROR", ...args));
    vi.spyOn(console, "warn").mockImplementation((...args) => logToDir("WARN", ...args));
});
afterAll(() => {
    vi.restoreAllMocks();
});
