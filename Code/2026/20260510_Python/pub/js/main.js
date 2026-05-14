"use strict";
// src/main.ts
const VERSION = "1.0.3 - " + new Date().toLocaleTimeString();
let isEscapedMode = false;
let escCount = 0;
let currentWorker = null;
let timeoutTimer = null;
let startTime = null;
function appendToInfo(text) {
    const infoOutput = document.getElementById("info-output");
    if (infoOutput) {
        infoOutput.textContent += text + "\n";
    }
}
function updateStatus(errorText) {
    const statusLine = document.getElementById("status-line");
    const modeIndicator = document.getElementById("mode-indicator");
    if (modeIndicator) {
        if (isEscapedMode) {
            modeIndicator.textContent = "ESC";
            modeIndicator.classList.add("visible");
        }
        else {
            modeIndicator.textContent = "";
            modeIndicator.classList.remove("visible");
        }
    }
    if (statusLine) {
        if (errorText) {
            statusLine.textContent = errorText;
            statusLine.classList.add("error");
        }
        else {
            statusLine.textContent = "Ready";
            statusLine.classList.remove("error");
        }
    }
}
function abortExecution(isNewStart = false, isTimeout = false) {
    if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
    }
    if (currentWorker) {
        currentWorker.terminate();
        currentWorker = null;
        if (!isNewStart) {
            const state = isTimeout ? "timeout" : "aborted";
            updateStatus(`Error: ${state.charAt(0).toUpperCase() + state.slice(1)}`);
            const resultOutput = document.getElementById("result-output");
            const abortLine = document.createElement("div");
            abortLine.textContent = isTimeout
                ? "Execution timed out."
                : "Execution aborted by user.";
            resultOutput.appendChild(abortLine);
            appendToInfo(`End state: ${state}`);
            appendToInfo(`End time: ${new Date().toLocaleTimeString()}`);
        }
    }
}
async function compileAndRun() {
    console.log(`[${VERSION}] Main: Starting compileAndRun...`);
    const editor = document.getElementById("editor");
    const lexOutput = document.getElementById("lex-output");
    const astOutput = document.getElementById("ast-output");
    const watOutput = document.getElementById("wat-output");
    const wasmOutput = document.getElementById("wasm-output");
    const resultOutput = document.getElementById("result-output");
    const infoOutput = document.getElementById("info-output");
    const timeoutInput = document.getElementById("timeout-input");
    const code = editor.value;
    const timeoutSeconds = parseInt(timeoutInput.value) || 10;
    if (currentWorker) {
        console.log(`[${VERSION}] Main: Aborting previous worker...`);
        abortExecution(true);
    }
    updateStatus(); // Reset status
    lexOutput.textContent = "";
    astOutput.textContent = "";
    watOutput.textContent = "";
    wasmOutput.textContent = "";
    resultOutput.textContent = "";
    startTime = new Date();
    infoOutput.textContent = `Start time: ${startTime.toLocaleTimeString()}\n`;
    appendToInfo(`Execution timeout in seconds: ${timeoutSeconds}`);
    if (!code.trim()) {
        resultOutput.textContent = "Error: Code is empty";
        appendToInfo("End state: Error (Empty code)");
        appendToInfo(`End time: ${new Date().toLocaleTimeString()}`);
        return;
    }
    // Create new worker
    currentWorker = new Worker("./js/worker.js", { type: "module" });
    // Set timeout
    timeoutTimer = setTimeout(() => {
        console.log(`[${VERSION}] Main: Execution timeout reached`);
        abortExecution(false, true);
    }, timeoutSeconds * 1000);
    currentWorker.onmessage = (e) => {
        const { type, payload } = e.data;
        switch (type) {
            case "lex":
                lexOutput.textContent = payload;
                break;
            case "ast":
                astOutput.textContent = payload;
                break;
            case "wat":
                watOutput.textContent = payload;
                break;
            case "wasm":
                wasmOutput.textContent = payload;
                break;
            case "log":
                const logLine = document.createElement("div");
                logLine.textContent = `Print: ${payload}`;
                resultOutput.appendChild(logLine);
                break;
            case "result":
                if (timeoutTimer)
                    clearTimeout(timeoutTimer);
                const resultLine = document.createElement("div");
                resultLine.textContent = payload;
                resultOutput.appendChild(resultLine);
                updateStatus();
                appendToInfo("End state: normal");
                appendToInfo(`End time: ${new Date().toLocaleTimeString()}`);
                currentWorker?.terminate();
                currentWorker = null;
                break;
            case "error":
                if (timeoutTimer)
                    clearTimeout(timeoutTimer);
                updateStatus(`Error: ${payload}`);
                const errorLine = document.createElement("div");
                const msg = payload || "";
                const match = msg.match(/line (\d+), col (\d+)/);
                if (match) {
                    const l = parseInt(match[1]);
                    const c = parseInt(match[2]);
                    const sourceLines = editor.value.split("\n");
                    const errorLineText = sourceLines[l - 1] || "";
                    const highlightedLine = errorLineText.substring(0, c - 1) +
                        "####" +
                        errorLineText.substring(c - 1);
                    errorLine.innerHTML =
                        `<div style="color: #f44747; font-family: monospace; white-space: pre-wrap;">` +
                            `Error: ${msg}<br/>` +
                            `line: ${errorLineText}<br/>` +
                            `line with marker: ${highlightedLine}</div>`;
                }
                else {
                    errorLine.textContent = `Error: #### ${payload} ####`;
                }
                resultOutput.appendChild(errorLine);
                appendToInfo(`End state: Error (${payload})`);
                appendToInfo(`End time: ${new Date().toLocaleTimeString()}`);
                currentWorker?.terminate();
                currentWorker = null;
                break;
        }
    };
    currentWorker.postMessage({ type: "compile", code });
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
    const handleIndentation = (isShift) => {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        if (isShift) {
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
            editor.value =
                value.substring(0, lineStart) + "    " + value.substring(lineStart);
            editor.selectionStart = start + 4;
            editor.selectionEnd = end + 4;
        }
    };
    editor.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            isEscapedMode = !isEscapedMode;
            escCount = isEscapedMode ? 1 : 2;
            updateStatus();
            return;
        }
        if (e.key === "Tab") {
            if (isEscapedMode && escCount === 1) {
                // ESC then Tab: Allow default navigation and clear mode
                isEscapedMode = false;
                escCount = 0;
                updateStatus();
            }
            else if (!isEscapedMode && escCount >= 2) {
                // ESC then ESC then Tab: Indentation
                e.preventDefault();
                handleIndentation(e.shiftKey);
                escCount = 0;
                updateStatus();
            }
            else {
                // Regular Tab in Editing mode or Escaped with sequence broken
                e.preventDefault();
                handleIndentation(e.shiftKey);
            }
            return;
        }
        if (isEscapedMode) {
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault(); // Block typing in escaped mode
            }
            if (e.key !== "Shift")
                escCount = 0;
            return;
        }
        if (e.key === "Enter") {
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
        if (e.key !== "Shift")
            escCount = 0;
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
const abortBtn = document.getElementById("abort-btn");
if (abortBtn) {
    abortBtn.addEventListener("click", () => {
        console.log(`[${VERSION}] UI: Abort button clicked`);
        abortExecution();
    });
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
const handleGlobalKeydown = (e) => {
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
    else {
        if (e.key !== "Shift")
            escCount = 0;
    }
};
const win = window;
if (win._pythonKeydown) {
    window.removeEventListener("keydown", win._pythonKeydown);
}
window.addEventListener("keydown", handleGlobalKeydown);
win._pythonKeydown = handleGlobalKeydown;
console.log(`[${VERSION}] Python-to-WASM Compiler Initialized`);
// Ensure the initial active tab is shown
const initialTab = document.querySelector(".tab-btn.active");
if (initialTab) {
    console.log(`[${VERSION}] UI: Selecting initial tab:`, initialTab.dataset.tab);
    initialTab.click();
}
