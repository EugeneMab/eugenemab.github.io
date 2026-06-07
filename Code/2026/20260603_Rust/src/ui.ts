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
          outputs.wat.textContent = payload;
          break;
        case "wasm":
          outputs.wasm.textContent = Array.from(payload as Uint8Array)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
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
}
