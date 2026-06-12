// REM Rust-to-WASM Port (RUST)
let worker: Worker | null = null;
let activeTimer: any = null;
let startPerf = 0;

export function initUI() {
  const editor = document.getElementById("editor") as HTMLTextAreaElement;
  const compileBtn = document.getElementById("compile-btn");
  const abortBtn = document.getElementById("abort-btn");
  const loadFileBtn = document.getElementById("load-file-btn");
  const saveBtn = document.getElementById("save-btn");
  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const timeoutInput = document.getElementById(
    "timeout-input",
  ) as HTMLInputElement;
  const statusLine = document.getElementById("status-line");
  const sampleSelect = document.getElementById(
    "sample-select",
  ) as HTMLSelectElement;
  let isEscapedMode = false;

  const setEditorMode = (escapedMode: boolean) => {
    isEscapedMode = escapedMode;
    editor.dataset.mode = escapedMode ? "escape" : "edit";
  };

  const formatWASMBytes = (bytes: Uint8Array): string => {
    const values = Array.from(bytes).map((b) =>
      b.toString(16).padStart(2, "0"),
    );
    const rows: string[] = [];
    for (let i = 0; i < values.length; i += 16) {
      rows.push(values.slice(i, i + 16).join(" "));
    }
    return rows.join("\n");
  };

  const formatWAT = (wat: string): string => {
    const lines = wat.split("\n");
    // If emitter already includes nested control-flow indentation,
    // avoid adding UI indentation on top of it.
    if (lines.some((l) => /^\s{6,}(block|loop|if|else|end)\b/i.test(l))) {
      return wat;
    }
    const formatted: string[] = [];
    let blockIndent = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        formatted.push("");
        continue;
      }

      const lower = line.toLowerCase();
      const isEnd = lower === "end" || lower.startsWith("end ");
      const isElse = lower === "else";

      if (isEnd || isElse) {
        blockIndent = Math.max(0, blockIndent - 1);
      }

      const existingIndent = rawLine.match(/^\s*/)?.[0] ?? "";
      formatted.push(existingIndent + "  ".repeat(blockIndent) + line);

      const startsBlock =
        lower.startsWith("if") ||
        lower.startsWith("block") ||
        lower.startsWith("loop");
      if (startsBlock || isElse) {
        blockIndent++;
      }
    }

    return formatted.join("\n");
  };

  const handleIndentation = (isShift: boolean) => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const block = value.substring(lineStart, lineEnd);
    const lines = block.split("\n");

    if (isShift) {
      const removedPerLine = lines.map((line) => {
        const leadingSpaces = line.match(/^\s*/)?.[0] ?? "";
        return Math.min(leadingSpaces.length, 4);
      });
      const adjusted = lines.map((line, idx) =>
        line.substring(removedPerLine[idx]),
      );
      editor.value =
        value.substring(0, lineStart) +
        adjusted.join("\n") +
        value.substring(lineEnd);

      const removedFirst = removedPerLine[0] ?? 0;
      const removedTotal = removedPerLine.reduce((sum, n) => sum + n, 0);
      if (start === end) {
        const newPos = Math.max(lineStart, start - removedFirst);
        editor.selectionStart = newPos;
        editor.selectionEnd = newPos;
      } else {
        editor.selectionStart = Math.max(lineStart, start - removedFirst);
        editor.selectionEnd = Math.max(
          editor.selectionStart,
          end - removedTotal,
        );
      }
      return;
    }

    const adjusted = lines.map((line) => `    ${line}`);
    editor.value =
      value.substring(0, lineStart) +
      adjusted.join("\n") +
      value.substring(lineEnd);
    if (start === end) {
      const newPos = start + 4;
      editor.selectionStart = newPos;
      editor.selectionEnd = newPos;
    } else {
      editor.selectionStart = start + 4;
      editor.selectionEnd = end + 4 * lines.length;
    }
  };

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditorMode(!isEscapedMode);
      return;
    }

    if (isEscapedMode) {
      if (e.key === "Tab") {
        return;
      }
      if (
        (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) ||
        e.key === "Enter" ||
        e.key === "Backspace" ||
        e.key === "Delete"
      ) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      handleIndentation(e.shiftKey);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const value = editor.value;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const currentLine = value.substring(lineStart, start);
      const indentation = currentLine.match(/^\s*/)?.[0] ?? "";
      editor.value =
        value.substring(0, start) + "\n" + indentation + value.substring(end);
      const newPos = start + 1 + indentation.length;
      editor.selectionStart = newPos;
      editor.selectionEnd = newPos;
    }
  });

  const outputs: Record<string, HTMLElement> = {
    info: document.getElementById("info-output")!,
    lex: document.getElementById("lex-output")!,
    ast: document.getElementById("ast-output")!,
    wat: document.getElementById("wat-output")!,
    wasm: document.getElementById("wasm-output")!,
    exec: document.getElementById("result-output")!,
  };

  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = (tab as HTMLElement).dataset.tab!;
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.add("hidden"));
      document.getElementById(`${target}-content`)!.classList.remove("hidden");
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });

  const sampleFiles: Record<string, string> = {
    lexer: "step02_lexer.rs",
    parser: "step03_parser.rs",
    math: "step06_math.rs",
    bitwise: "step06_bitwise.rs",
    comments: "step07_comments.rs",
    print: "step08_print.rs",
    panic: "step09_panic.rs",
    scope: "step10_scope.rs",
    regions: "step11_regions.rs",
    borrow: "step12_borrow.rs",
    book01_02_hello: "book01_02_hello_world.rs",
    book01_03_hello_cargo: "book01_03_hello_cargo.rs",
    book02_00_vars: "book02_00_variables.rs",
    book02_00_if_else: "book02_00_if_else.rs",
    book02_00_loop: "book02_00_loop.rs",
    book02_00_break_error: "book02_00_break_error.rs",
    book03_01_mut_err: "book03_01_immutability_error.rs",
    book03_01_mut: "book03_01_mutability.rs",
    book03_01_const: "book03_01_constants.rs",
    book03_01_shadow: "book03_01_shadowing.rs",
    book03_02_bool: "book03_02_booleans.rs",
    book03_03_fn: "book03_03_functions.rs",
    book03_05_while: "book03_05_while.rs",
    book03_05_if_let: "book03_05_if_let.rs",
    book04_01_scope: "book04_01_scope.rs",
    book04_02_borrow: "book04_02_borrow.rs",
    book04_02_mut_borrow_err: "book04_02_mut_borrow_error.rs",
    book04_03_index: "book04_03_index.rs",
    book04_03_slice: "book04_03_slice.rs",
    book04_03_first_word_slice: "book04_03_first_word_slice.rs",
    book04_03_slice_error: "book04_03_slice_error.rs",
    book04_03_slice_param: "book04_03_slice_param.rs",
    book04_03_array_slice: "book04_03_array_slice.rs",
    book05_02_separate_variables: "book05_02_separate_variables.rs",
    book05_02_tuples: "book05_02_tuples.rs",
    book05_02_structs: "book05_02_structs.rs",
    book05_02_print_struct_error: "book05_02_print_struct_error.rs",
    book05_02_debug_trait: "book05_02_debug_trait.rs",
    book05_02_dbg_macro: "book05_02_dbg_macro.rs",
    book05_03_method_syntax: "book05_03_method_syntax.rs",
    book05_03_method_field_interaction: "book05_03_method_field_interaction.rs",
    book05_03_can_hold: "book05_03_can_hold.rs",
    book05_03_associated_functions: "book05_03_associated_functions.rs",
    book05_03_multiple_impl_blocks: "book05_03_multiple_impl_blocks.rs",
  };

  sampleSelect?.addEventListener("change", async () => {
    const fileName = sampleFiles[sampleSelect.value];
    if (fileName) {
      try {
        const response = await fetch(`./samples/${fileName}`);
        if (!response.ok) throw new Error(`Failed to load ${fileName}`);
        editor.value = await response.text();
        runCode();
      } catch (err: any) {
        outputs.exec.textContent = `Error loading sample: ${err.message}`;
      }
    }
  });

  const clearTimer = () => {
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
  };

  const runCode = () => {
    if (worker) {
      worker.terminate();
    }
    clearTimer();

    startPerf = performance.now();
    const startTime = new Date().toLocaleTimeString();
    const timeoutValue = parseInt(timeoutInput.value) || 10;
    const timeout = timeoutValue * 1000;

    statusLine!.textContent = "Compiling...";
    Object.values(outputs).forEach((o) => (o.textContent = ""));
    outputs.info.textContent = `[${startTime}] Start (Timeout: ${timeoutValue}s)\n`;

    worker = new Worker("./js/worker.js", { type: "module" });

    activeTimer = setTimeout(() => {
      if (worker) {
        worker.terminate();
        worker = null;
        statusLine!.textContent = "Execution Timed Out";
        const duration = performance.now() - startPerf;
        outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End Error: Timeout duration=${duration.toFixed(2)}ms\n`;
      }
      activeTimer = null;
    }, timeout);

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      switch (type) {
        case "phase":
          if (payload.event === "enter") {
            outputs.info.textContent += `[${payload.timestamp}] enter ${payload.phase}\n`;
          } else {
            outputs.info.textContent += `[${payload.timestamp}] leave ${payload.phase} duration=${payload.duration.toFixed(2)}ms\n`;
          }
          break;
        case "lex":
          outputs.lex.textContent = JSON.stringify(payload, null, 2);
          break;
        case "ast":
          outputs.ast.textContent = JSON.stringify(payload, null, 2);
          break;
        case "wat":
          outputs.wat.textContent = formatWAT(payload);
          break;
        case "wasm":
          outputs.wasm.textContent = formatWASMBytes(payload as Uint8Array);
          break;
        case "log":
          outputs.exec.textContent += payload + "\n";
          break;
        case "result":
          clearTimer();
          worker = null; // Mark as finished
          statusLine!.textContent = "Execution Finished";
          const successDuration = performance.now() - startPerf;
          outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End okay return code=${payload} duration=${successDuration.toFixed(2)}ms\n`;
          break;
        case "error":
          clearTimer();
          worker = null; // Mark as finished
          outputs.exec.textContent += payload.detail + "\n";
          outputs.info.textContent += payload.detail + "\n";
          const errDuration = performance.now() - startPerf;
          outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End Error: ${payload.short} duration=${errDuration.toFixed(2)}ms\n`;
          statusLine!.textContent = payload.short;
          break;
      }
    };

    worker.postMessage({ type: "compile", code: editor.value });
  };

  compileBtn?.addEventListener("click", runCode);
  abortBtn?.addEventListener("click", () => {
    if (worker) {
      worker.terminate();
      worker = null;
      clearTimer();
      statusLine!.textContent = "Aborted";
      const abortDuration = performance.now() - startPerf;
      outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End Error: Aborted duration=${abortDuration.toFixed(2)}ms\n`;
    }
  });

  // File IO
  loadFileBtn?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      editor.value = e.target?.result as string;
    };
    reader.readAsText(file);
  });

  saveBtn?.addEventListener("click", () => {
    const blob = new Blob([editor.value], { type: "text/rust" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "program.rs";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "F8") {
      e.preventDefault();
      runCode();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      fileInput.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveBtn?.click();
    }
  });

  outputs.info.textContent =
    "Ready. Port: 7878\nRust-to-WASM Compiler Initialized.";
  setEditorMode(false);
}
