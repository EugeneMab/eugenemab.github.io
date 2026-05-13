// src/worker.ts
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";

self.onmessage = async (e) => {
  const { type, code } = e.data;

  if (type === "compile") {
    try {
      // 1. Lexing
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      self.postMessage({
        type: "lex",
        payload: tokens
          .map((t) => `${t.type} ${t.line} ${t.col} "${t.value}"`)
          .join("\n"),
      });

      // 2. Parsing
      const parser = new Parser(tokens);
      const ast = parser.parse();
      self.postMessage({ type: "ast", payload: JSON.stringify(ast, null, 2) });

      // 3. Compiling
      const compiler = new Compiler();
      const wat = compiler.compileWAT(ast);
      self.postMessage({ type: "wat", payload: wat });

      const wasm = compiler.compileWASM(ast);
      self.postMessage({
        type: "wasm",
        payload: Array.from(wasm)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      });

      // 4. Execution
      // We provide a print and sleep function to the WASM instance
      const importObject = {
        env: {
          print: (val: number) => {
            self.postMessage({ type: "log", payload: val });
          },
          sleep: (ms: number) => {
            if (typeof SharedArrayBuffer !== "undefined") {
              const shared = new Int32Array(new SharedArrayBuffer(4));
              Atomics.wait(shared, 0, 0, ms);
            } else {
              // Fallback to busy-wait if SharedArrayBuffer is not available
              const start = Date.now();
              while (Date.now() - start < ms) {
                // Spinning...
              }
            }
          },
        },
      };

      const { instance } = (await WebAssembly.instantiate(
        wasm,
        importObject,
      )) as any;
      
      // If the code is an infinite loop, this will never return
      // unless the worker is terminated.
      const result = (instance.exports.main as Function)();
      
      self.postMessage({ type: "result", payload: `Result: ${result}` });
    } catch (err: any) {
      self.postMessage({ type: "error", payload: err.message || String(err) });
    }
  }
};
