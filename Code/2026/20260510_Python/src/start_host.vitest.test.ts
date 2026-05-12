import { describe, it, expect, vi } from "vitest";

// Define mocks before any imports
const mockSpawn = vi.fn(() => ({
  pid: 123,
  on: vi.fn(),
}));
const mockExec = vi.fn((cmd, cb) => {
  if (cb) cb(null, { stdout: "", stderr: "" });
});

vi.mock("child_process", () => ({
  spawn: mockSpawn,
  exec: mockExec,
  default: {
    spawn: mockSpawn,
    exec: mockExec,
  },
}));

describe("start_host.ts", () => {
  it("should spawn titler and server and handle exit", async () => {
    const onHandlers: Record<string, any> = {};
    const mockProcess = {
      pid: 123,
      on: vi.fn((event, handler) => {
        onHandlers[event] = handler;
      }),
    };
    mockSpawn.mockReturnValue(mockProcess as any);

    const processOnHandlers: Record<string, any> = {};
    vi.stubGlobal("process", {
      ...process,
      exit: vi.fn(),
      on: vi.fn((event, handler) => {
        processOnHandlers[event] = handler;
      }),
    });

    vi.resetModules();
    await import("./start_host.js");

    expect(mockSpawn).toHaveBeenCalled();

    // Trigger titler exit
    if (onHandlers["exit"]) {
      onHandlers["exit"](0);
    }
    expect(mockExec).toHaveBeenCalled();

    // Trigger SIGINT
    if (processOnHandlers["SIGINT"]) {
      await processOnHandlers["SIGINT"]();
    }
  });
});
