// REM Rust-to-WASM Port (RUST)
let worker = null;
let activeTimer = null;
let startPerf = 0;
export function initUI() {
    const editor = document.getElementById("editor");
    const compileBtn = document.getElementById("compile-btn");
    const abortBtn = document.getElementById("abort-btn");
    const loadFileBtn = document.getElementById("load-file-btn");
    const saveBtn = document.getElementById("save-btn");
    const fileInput = document.getElementById("file-input");
    const timeoutInput = document.getElementById("timeout-input");
    const statusLine = document.getElementById("status-line");
    const sampleSelect = document.getElementById("sample-select");
    const outputs = {
        info: document.getElementById("info-output"),
        lex: document.getElementById("lex-output"),
        ast: document.getElementById("ast-output"),
        wat: document.getElementById("wat-output"),
        wasm: document.getElementById("wasm-output"),
        exec: document.getElementById("result-output"),
    };
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            document
                .querySelectorAll(".tab-content")
                .forEach((c) => c.classList.add("hidden"));
            document.getElementById(`${target}-content`).classList.remove("hidden");
            tabs.forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
        });
    });
    const samples = {
        lexer: `// Step 2: Lexer (Literals & Keywords)\nfn main() {\n    let dec = 42;\n    let hex = 0x2A;\n    let s = "Rust";\n    print!(dec);\n    print!(hex);\n    0\n}`,
        parser: `// Step 3: Parser (Implicit Return)\nfn main() {\n    let x = 1;\n    {\n        let x = 2;\n        x\n    };\n    10 + 20\n}`,
        math: `// Step 6: Math & Logic\nfn main() {\n    let a = 10 + 5 * 2;\n    let b = (10 + 5) * 2;\n    let c = 100 % 3;\n    print!(a); // 20\n    print!(b); // 30\n    print!(c); // 1\n    a + b + c\n}`,
        bitwise: `// Step 6: Bitwise Ops\nfn main() {\n    let x = 0x0F & 0xF0; // 0\n    let y = 0x0F | 0xF0; // 255\n    let z = 1 << 4;      // 16\n    print!(x);\n    print!(y);\n    print!(z);\n    z >> 1 // 8\n}`,
        comments: `// Step 7: Comments\n/// This is a doc comment\nfn main() {\n    // Single line comment\n    let x = 1; // Inline comment\n    print!(x);\n    x\n}`,
        print: `// Step 8: Print Macro\nfn main() {\n    print!(111);\n    print!(222);\n    print!(333);\n    0\n}`,
    };
    sampleSelect?.addEventListener("change", () => {
        if (sampleSelect.value) {
            editor.value = samples[sampleSelect.value] || "";
            runCode();
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
        statusLine.textContent = "Compiling...";
        Object.values(outputs).forEach((o) => (o.textContent = ""));
        outputs.info.textContent = `[${startTime}] Start (Timeout: ${timeoutValue}s)\n`;
        worker = new Worker("./js/worker.js", { type: "module" });
        activeTimer = setTimeout(() => {
            if (worker) {
                worker.terminate();
                worker = null;
                statusLine.textContent = "Execution Timed Out";
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
                    }
                    else {
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
                    outputs.wasm.textContent = Array.from(payload)
                        .map((b) => b.toString(16).padStart(2, "0"))
                        .join(" ");
                    break;
                case "log":
                    outputs.exec.textContent += payload + "\n";
                    break;
                case "result":
                    clearTimer();
                    worker = null; // Mark as finished
                    statusLine.textContent = "Execution Finished";
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
                    statusLine.textContent = payload.short;
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
            statusLine.textContent = "Aborted";
            const abortDuration = performance.now() - startPerf;
            outputs.info.textContent += `[${new Date().toLocaleTimeString()}] End Error: Aborted duration=${abortDuration.toFixed(2)}ms\n`;
        }
    });
    // File IO
    loadFileBtn?.addEventListener("click", () => fileInput.click());
    fileInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (e) => {
            editor.value = e.target?.result;
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
