// src/main.ts

import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";

const VERSION = "1.0.3 - " + new Date().toLocaleTimeString();

async function compileAndRun() {
  console.log(`[${VERSION}] Main: Starting compileAndRun...`);

  const editor = document.getElementById("editor") as HTMLTextAreaElement;
  const lexOutput = document.getElementById("lex-output")!;
  const astOutput = document.getElementById("ast-output")!;
  const watOutput = document.getElementById("wat-output")!;
  const wasmOutput = document.getElementById("wasm-output")!;
  const resultOutput = document.getElementById("result-output")!;
  const statusLine = document.getElementById("status-line")!;

  const code = editor.value;
  console.log(
    `[${VERSION}] Main: Code to compile (len=${code.length}):`,
    code.substring(0, 30),
  );

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
      console.log(`[${VERSION}] Main: Step 1 - Lexing...`);
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      console.log(`[${VERSION}] Main: Lexing produced ${tokens.length} tokens`);

      lexOutput.textContent = tokens
        .map((t) => `[${t.type}] "${t.value}" (L${t.line}:C${t.col})`)
        .join("\n");

      // 2. Parsing
      console.log(`[${VERSION}] Main: Step 2 - Parsing...`);
      const parser = new Parser(tokens);
      const ast = parser.parse();
      console.log(`[${VERSION}] Main: Parsing complete`);
      astOutput.textContent = JSON.stringify(ast, null, 2);

      // 3. Compiling
      console.log(`[${VERSION}] Main: Step 3 - Emitter...`);
      const compiler = new Compiler();
      const wat = compiler.compileWAT(ast);
      watOutput.textContent = wat;

      const wasm = compiler.compileWASM(ast);
      console.log(
        `[${VERSION}] Main: WASM binary generated, size: ${wasm.length} bytes`,
      );
      wasmOutput.textContent = Array.from(wasm)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");

      // 4. Execution
      statusLine.textContent = "Executing";
      console.log(`[${VERSION}] Main: Step 4 - Execution...`);
      const { instance } = (await WebAssembly.instantiate(wasm)) as any;
      const result = (instance.exports.main as Function)();
      console.log(`[${VERSION}] Main: Execution result:`, result);
      resultOutput.textContent = `Result: ${result}`;

      statusLine.textContent = "Ready";
    } catch (e: any) {
      let phase = "Lexing";
      if (astOutput.textContent === "") phase = "Lexing";
      else if (watOutput.textContent === "") phase = "Parsing";
      else if (wasmOutput.textContent === "") phase = "WASM";
      else phase = "Execution";

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
        const highlightedLine =
          errorLineText.substring(0, c - 1) +
          "####" +
          errorLineText.substring(c - 1);

        resultOutput.innerHTML = `<div style="color: #f44747; font-family: monospace; white-space: pre;">Error: ${phase}: ${msg}<br/><br/>${errorLineText}<br/><span style="color: #4ec9b0; font-weight: bold;">${highlightedLine}</span></div>`;
      } else {
        resultOutput.textContent = `Error: ${phase}: ${e}`;
      }
    }
  } catch (e: any) {
    console.error(`[${VERSION}] Main: ERROR during compilation:`, e);
    statusLine.textContent = `Error: Initialization: ${e.message || e}`;
    statusLine.classList.add("error");
    resultOutput.textContent = "Error: " + e;
  }
}

// Tab Switching Logic
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabId = (btn as HTMLElement).dataset.tab;
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
    const path = (e.target as HTMLSelectElement).value;
    console.log(`[${VERSION}] UI: Sample dropdown changed to:`, path);
    if (path) {
      try {
        console.log(`[${VERSION}] UI: Fetching sample from:`, path);
        const response = await fetch(path).catch((err) => {
          throw new Error(
            `Connection to server lost. Is start.cmd still running? (${err.message})`,
          );
        });

        if (!response.ok) {
          throw new Error(
            `Server returned ${response.status}: ${response.statusText}`,
          );
        }

        console.log(`[${VERSION}] UI: Fetch status:`, response.status);
        const text = await response.text();
        console.log(`[${VERSION}] UI: Fetched content length:`, text.length);

        const editor = document.getElementById("editor") as HTMLTextAreaElement;
        editor.value = text;

        console.log(`[${VERSION}] UI: Auto-triggering compilation...`);
        await compileAndRun();
      } catch (err) {
        console.error(`[${VERSION}] UI: Failed to load sample:`, err);
      }
    }
  });
} else {
  console.error(`[${VERSION}] UI: Could not find #sample-select element!`);
}

// Compile Button
const compileBtn = document.getElementById("compile-btn");
const editor = document.getElementById("editor") as HTMLTextAreaElement;

if (editor) {
  editor.placeholder = "def main():\n    return 42";
}

if (compileBtn) {
  console.log(`[${VERSION}] UI: Attaching click listener to #compile-btn`);
  compileBtn.addEventListener("click", () => {
    console.log(`[${VERSION}] UI: Compile button clicked`);
    compileAndRun();
  });
} else {
  console.error(`[${VERSION}] UI: Could not find #compile-btn element!`);
}

console.log(`[${VERSION}] Python-to-WASM Compiler Initialized`);
