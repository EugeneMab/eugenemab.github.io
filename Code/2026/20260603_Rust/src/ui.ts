// REM Rust-to-WASM Port (RUST)
let worker: Worker | null = null;

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

  const samples: Record<string, string> = {
    basic: `fn main() {\n    let x = 10;\n    let y = 20;\n    let z = (x + y) * 2;\n    print!(z);\n    z;\n}`,
    bitwise: `fn main() {\n    let bit = (1 << 5) | 1;\n    print!(bit);\n    bit;\n}`,
    panic: `fn main() {\n    print!(1);\n    panic!(42);\n    print!(2);\n}`,
  };

  sampleSelect?.addEventListener("change", () => {
    if (sampleSelect.value) {
      editor.value = samples[sampleSelect.value] || "";
      runCode();
    }
  });

  const runCode = () => {
    if (worker) {
      worker.terminate();
    }

    const startPerf = performance.now();
    const startTime = new Date().toLocaleTimeString();
    statusLine!.textContent = "Compiling...";
    Object.values(outputs).forEach((o) => (o.textContent = ""));
    outputs.info.textContent = `[${startTime}] Start\n`;

    worker = new Worker("./js/worker.js", { type: "module" });

    const timeoutValue = parseInt(timeoutInput.value) || 10;
    const timeout = timeoutValue * 1000;

    let timer: any = null;
    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      if (worker) {
        worker.terminate();
        worker = null;
        statusLine!.textContent = "Execution Timed Out";
        const duration = performance.now() - startPerf;
        outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End Error: Timeout duration=${duration.toFixed(2)}ms\n`;
      }
      timer = null;
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
          statusLine!.textContent = "Execution Finished";
          const successDuration = performance.now() - startPerf;
          outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End okay return code=${payload} duration=${successDuration.toFixed(2)}ms\n`;
          break;
        case "error":
          clearTimer();
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
      statusLine!.textContent = "Aborted";
      // We don't have an easy way to clear the local 'timer' inside runCode from here,
      // but runCode handles cleanup of old workers.
      // However, we can track the active timer globally if needed.
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

initUI();
