// REM Rust-to-WASM Port (RUST)
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";

self.onmessage = async (e) => {
  const { type, code } = e.data;
  if (type === "compile") {
    try {
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      self.postMessage({ type: "lex", payload: tokens });

      const parser = new Parser(tokens, code);
      const ast = parser.parse();
      self.postMessage({ type: "ast", payload: ast });

      const emitter = new Emitter(ast);
      const wat = emitter.emitWAT();
      self.postMessage({ type: "wat", payload: wat });

      const wasm = emitter.emitWASM();
      self.postMessage({ type: "wasm", payload: wasm });

      const importObject = {
        env: {
          print: (val: number) => {
            self.postMessage({ type: "log", payload: String(val) });
          },
          panic: (code: number) => {
            throw new Error(`Panic! Error code: ${code}`);
          },
        },
      };

      const { instance } = (await WebAssembly.instantiate(
        wasm,
        importObject,
      )) as any;
      if ((instance.exports as any).main) {
        const result = (instance.exports as any).main();
        self.postMessage({ type: "result", payload: result });
      } else {
        self.postMessage({ type: "error", payload: "No main function found" });
      }
    } catch (err: any) {
      self.postMessage({ type: "error", payload: err.stack || err.message });
    }
  }
};
