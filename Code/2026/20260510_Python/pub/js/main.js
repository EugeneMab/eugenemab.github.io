// src/main.ts
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
const VERSION = "1.0.3 - " + new Date().toLocaleTimeString();
async function compileAndRun() {
    console.log(`[${VERSION}] Main: Starting compileAndRun...`);
    const editor = document.getElementById("editor");
    const lexOutput = document.getElementById("lex-output");
    const astOutput = document.getElementById("ast-output");
    const watOutput = document.getElementById("wat-output");
    const wasmOutput = document.getElementById("wasm-output");
    const resultOutput = document.getElementById("result-output");
    const statusLine = document.getElementById("status-line");
    const code = editor.value;
    console.log(`[${VERSION}] Main: Code to compile (len=${code.length}):`, code.substring(0, 30));
    let phase = "Initialization";
    try {
        statusLine.textContent = "Compiling";
        statusLine.classList.remove("error");
        // Clear previous outputs
        lexOutput.textContent = "";
        astOutput.textContent = "";
        watOutput.textContent = "";
        wasmOutput.textContent = "";
        resultOutput.textContent = "Compiling...";
        if (!code.trim()) {
            statusLine.textContent = "Ready";
            console.warn(`[${VERSION}] Main: Code is empty, stopping.`);
            resultOutput.textContent = "Error: Code is empty";
            return;
        }
        // 1. Lexing
        try {
            phase = "Lexing";
            console.log(`[${VERSION}] Main: Step 1 - Lexing...`);
            const lexer = new Lexer(code);
            const tokens = lexer.tokenize();
            console.log(`[${VERSION}] Main: Lexing produced ${tokens.length} tokens`);
            lexOutput.textContent = tokens
                .map((t) => `${t.type} ${t.line} ${t.col} "${t.value}"`)
                .join("\n");
            // 2. Parsing
            phase = "Parsing";
            console.log(`[${VERSION}] Main: Step 2 - Parsing...`);
            const parser = new Parser(tokens);
            const ast = parser.parse();
            console.log(`[${VERSION}] Main: Parsing complete`);
            astOutput.textContent = JSON.stringify(ast, null, 2);
            // 3. Compiling
            phase = "Compiling";
            console.log(`[${VERSION}] Main: Step 3 - Emitter...`);
            const compiler = new Compiler();
            const wat = compiler.compileWAT(ast);
            watOutput.textContent = wat;
            const wasm = compiler.compileWASM(ast);
            console.log(`[${VERSION}] Main: WASM binary generated, size: ${wasm.length} bytes`);
            wasmOutput.textContent = Array.from(wasm)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(" ");
            // 4. Execution
            phase = "Execution";
            statusLine.textContent = "Executing";
            console.log(`[${VERSION}] Main: Step 4 - Execution...`);
            const { instance } = (await WebAssembly.instantiate(wasm));
            const result = instance.exports.main();
            console.log(`[${VERSION}] Main: Execution result:`, result);
            resultOutput.textContent = `Result: ${result}`;
            statusLine.textContent = "Ready";
        }
        catch (e) {
            statusLine.textContent = `Error: ${phase}: ${e.message || e}`;
            statusLine.classList.add("error");
            // Visual error marker
            const msg = e.message || "";
            const match = msg.match(/line (\d+), col (\d+)/);
            if (match) {
                const l = parseInt(match[1]);
                const c = parseInt(match[2]);
                const sourceLines = code.split("\n");
                const errorLineText = sourceLines[l - 1] || "";
                // Construct a line that inserts #### at the error point
                const highlightedLine = errorLineText.substring(0, c - 1) +
                    "####" +
                    errorLineText.substring(c - 1);
                resultOutput.innerHTML = `<div style="color: #f44747; font-family: monospace; white-space: pre;">Error: ${phase}: ${msg}<br/><br/>${errorLineText}<br/><span style="color: #4ec9b0; font-weight: bold;">${highlightedLine}</span></div>`;
            }
            else {
                resultOutput.textContent = `Error: ${phase}: ${e}`;
            }
        }
    }
    catch (e) {
        console.error(`[${VERSION}] Main: ERROR during compilation:`, e);
        statusLine.textContent = `Error: Initialization: ${e.message || e}`;
        statusLine.classList.add("error");
        resultOutput.textContent = "Error: " + e;
    }
}
// Tab Switching Logic
document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const tabId = btn.dataset.tab;
        console.log(`[${VERSION}] UI: Tab clicked:`, tabId);
        document
            .querySelectorAll(".tab-btn")
            .forEach((b) => b.classList.remove("active"));
        document
            .querySelectorAll(".tab-content")
            .forEach((c) => c.classList.add("hidden"));
        btn.classList.add("active");
        document.getElementById(`${tabId}-content`)?.classList.remove("hidden");
    });
});
// Sample Loading Logic
const sampleSelect = document.getElementById("sample-select");
if (sampleSelect) {
    console.log(`[${VERSION}] UI: Attaching change listener to #sample-select`);
    sampleSelect.addEventListener("change", async (e) => {
        const path = e.target.value;
        console.log(`[${VERSION}] UI: Sample dropdown changed to:`, path);
        if (path) {
            try {
                console.log(`[${VERSION}] UI: Fetching sample from:`, path);
                const response = await fetch(path).catch((err) => {
                    throw new Error(`Connection to server lost. Is start.cmd still running? (${err.message})`);
                });
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                console.log(`[${VERSION}] UI: Fetch status:`, response.status);
                const text = await response.text();
                console.log(`[${VERSION}] UI: Fetched content length:`, text.length);
                const editor = document.getElementById("editor");
                editor.value = text;
                console.log(`[${VERSION}] UI: Auto-triggering compilation...`);
                await compileAndRun();
            }
            catch (err) {
                console.error(`[${VERSION}] UI: Failed to load sample:`, err);
            }
        }
    });
}
else {
    console.error(`[${VERSION}] UI: Could not find #sample-select element!`);
}
// Compile Button
const compileBtn = document.getElementById("compile-btn");
const editor = document.getElementById("editor");
if (editor) {
    editor.placeholder = "def main():\n    return 42";
    editor.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            if (e.ctrlKey)
                return; // Allow Ctrl+Tab to navigate
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const value = editor.value;
            // Find start of the current line
            const lineStart = value.lastIndexOf("\n", start - 1) + 1;
            if (e.shiftKey) {
                // Shift+Tab: Decrease indentation by up to 4 spaces
                const lineEnd = value.indexOf("\n", start);
                const line = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
                const leadingSpaces = line.match(/^\s*/)?.[0] || "";
                const spacesToRemove = Math.min(leadingSpaces.length, 4);
                if (spacesToRemove > 0) {
                    editor.value =
                        value.substring(0, lineStart) +
                            line.substring(spacesToRemove) +
                            value.substring(lineEnd === -1 ? value.length : lineEnd);
                    editor.selectionStart = Math.max(lineStart, start - spacesToRemove);
                    editor.selectionEnd = Math.max(lineStart, end - spacesToRemove);
                }
            }
            else {
                // Tab: Increase indentation of the current line by 4 spaces
                editor.value =
                    value.substring(0, lineStart) + "    " + value.substring(lineStart);
                editor.selectionStart = start + 4;
                editor.selectionEnd = end + 4;
            }
        }
        else if (e.key === "Enter") {
            e.preventDefault();
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const value = editor.value;
            // Find indentation of the current line
            const lineStart = value.lastIndexOf("\n", start - 1) + 1;
            const currentLine = value.substring(lineStart, start);
            const indentation = currentLine.match(/^\s*/)?.[0] || "";
            // Insert newline and same indentation
            const before = value.substring(0, start);
            const after = value.substring(end);
            editor.value = before + "\n" + indentation + after;
            // Move cursor to end of new indentation
            const newPos = start + 1 + indentation.length;
            editor.selectionStart = editor.selectionEnd = newPos;
        }
    });
}
if (compileBtn) {
    console.log(`[${VERSION}] UI: Attaching click listener to #compile-btn`);
    compileBtn.addEventListener("click", () => {
        console.log(`[${VERSION}] UI: Compile button clicked`);
        compileAndRun();
    });
}
else {
    console.error(`[${VERSION}] UI: Could not find #compile-btn element!`);
}
// Open File Logic
const loadFileBtn = document.getElementById("load-file-btn");
const fileInput = document.getElementById("file-input");
function openFile() {
    fileInput.click();
}
if (loadFileBtn && fileInput) {
    loadFileBtn.addEventListener("click", () => openFile());
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (editor) {
                    editor.value = event.target?.result;
                    compileAndRun();
                }
            };
            reader.readAsText(file);
        }
    });
}
// Save File Logic
const saveBtn = document.getElementById("save-btn");
function saveFile() {
    if (!editor)
        return;
    const code = editor.value;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.py";
    a.click();
    URL.revokeObjectURL(url);
}
if (saveBtn) {
    saveBtn.addEventListener("click", () => saveFile());
}
// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
    if (e.key === "F8") {
        e.preventDefault();
        compileAndRun();
    }
    else if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        openFile();
    }
    else if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveFile();
    }
});
console.log(`[${VERSION}] Python-to-WASM Compiler Initialized`);
