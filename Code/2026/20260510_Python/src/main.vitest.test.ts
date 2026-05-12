import { describe, it, expect, vi, beforeEach } from "vitest";

// Set up DOM before importing main.ts
const setupDOM = () => {
  document.body.innerHTML = `
    <textarea id="editor"></textarea>
    <div id="lex-output"></div>
    <div id="ast-output"></div>
    <div id="wat-output"></div>
    <div id="wasm-output"></div>
    <div id="result-output"></div>
    <div id="status-line"></div>
    <button id="compile-btn"></button>
    <button id="load-file-btn"></button>
    <button id="save-btn"></button>
    <input type="file" id="file-input">
    <select id="sample-select">
        <option value="test.py">Test</option>
    </select>
    <button class="tab-btn" data-tab="lex"></button>
    <div id="lex-content" class="tab-content"></div>
  `;
};

describe("main.ts", () => {
  beforeEach(() => {
    setupDOM();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("WebAssembly", {
      instantiate: vi.fn().mockResolvedValue({
        instance: {
          exports: {
            main: () => 42,
          },
        },
      }),
    });
    // Mock URL.createObjectURL and URL.revokeObjectURL
    if (typeof URL.createObjectURL === "undefined") {
      Object.defineProperty(URL, "createObjectURL", {
        value: vi.fn().mockReturnValue("blob:test"),
      });
      Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn() });
    }
  });

  it("should initialize and handle compile button click", async () => {
    // Reset modules to ensure top-level code runs again with fresh DOM
    vi.resetModules();
    await import("./main.js");

    const editor = document.getElementById("editor") as HTMLTextAreaElement;
    const compileBtn = document.getElementById("compile-btn")!;
    const resultOutput = document.getElementById("result-output")!;

    editor.value = "def main():\n    return 42";
    compileBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Wait for async execution
    await vi.waitFor(
      () => {
        return resultOutput.textContent?.includes("Result: 42");
      },
      { timeout: 2000 },
    );

    expect(resultOutput.textContent).toContain("Result: 42");
  });

  it("should handle keyboard shortcuts", async () => {
    vi.resetModules();
    await import("./main.js");
    const resultOutput = document.getElementById("result-output")!;
    const editor = document.getElementById("editor") as HTMLTextAreaElement;
    editor.value = "def main():\n    return 42";

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F8", bubbles: true }),
    );

    await vi.waitFor(
      () => {
        return resultOutput.textContent?.includes("Result: 42");
      },
      { timeout: 2000 },
    );
    expect(resultOutput.textContent).toContain("Result: 42");
  });

  it("should handle tab key in editor", async () => {
    vi.resetModules();
    await import("./main.js");
    const editor = document.getElementById("editor") as HTMLTextAreaElement;

    // Test Tab
    editor.value = "def f():";
    editor.selectionStart = editor.selectionEnd = 8;
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(editor.value).toBe("    def f():");

    // Test Shift+Tab
    editor.selectionStart = editor.selectionEnd = 4;
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(editor.value).toBe("def f():");

    // Test Enter
    editor.value = "    line1";
    editor.selectionStart = editor.selectionEnd = 9;
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(editor.value).toBe("    line1\n    ");
  });

  it("should handle tab switching", async () => {
    vi.resetModules();
    await import("./main.js");
    const tabBtn = document.querySelector(".tab-btn") as HTMLElement;
    tabBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(tabBtn.classList.contains("active")).toBe(true);
  });

  it("should handle sample selection", async () => {
    vi.resetModules();
    await import("./main.js");
    const sampleSelect = document.getElementById(
      "sample-select",
    ) as HTMLSelectElement;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("print(1)"),
    });
    vi.stubGlobal("fetch", mockFetch);

    sampleSelect.value = "test.py";
    sampleSelect.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      return (
        (document.getElementById("editor") as HTMLTextAreaElement).value ===
        "print(1)"
      );
    });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle error highlighting", async () => {
    vi.resetModules();
    await import("./main.js");
    const editor = document.getElementById("editor") as HTMLTextAreaElement;
    const compileBtn = document.getElementById("compile-btn")!;
    const resultOutput = document.getElementById("result-output")!;

    editor.value = "def main():\nreturn 42"; // Missing indent
    compileBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() => {
      return resultOutput.innerHTML.includes("####");
    });
    expect(resultOutput.innerHTML).toContain("####");
  });

  it("should handle Ctrl+O and Ctrl+S shortcuts", async () => {
    vi.resetModules();
    await import("./main.js");
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "o", ctrlKey: true, bubbles: true }),
    );
    expect(clickSpy).toHaveBeenCalled();

    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
    );
    expect(anchorClickSpy).toHaveBeenCalled();
  });
});
