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
      const jsCode = compiler.compileJS(ast);
      self.postMessage({ type: "js", payload: jsCode });

      // 4. Execution
      const runtime = {
        print: (val: any) => {
          self.postMessage({ type: "log", payload: String(val) });
          return 0;
        },
        sleep: (ms: number) => {
          return new Promise((resolve) => setTimeout(resolve, ms));
        },
        range: (start: number, stop?: number, step: number = 1) => {
          if (stop === undefined) {
            stop = start;
            start = 0;
          }
          const res = [];
          for (let i = start; i < stop; i += step) res.push(i);
          return res;
        },
        len: (obj: any) => {
          if (Array.isArray(obj) || typeof obj === "string") return obj.length;
          if (typeof obj === "object") return Object.keys(obj).length;
          return 0;
        },
        abs: (val: number) => Math.abs(val),
        math: Math,
        _slice: (obj: any, start: any, stop: any, step: any) => {
          const len = obj.length;
          if (step === undefined || step === null) step = 1;
          if (start === undefined || start === null)
            start = step > 0 ? 0 : len - 1;
          if (stop === undefined || stop === null)
            stop = step > 0 ? len : -1;

          if (start < 0) start += len;
          if (stop < 0) stop += len;

          const res = [];
          if (step > 0) {
            for (let i = start; i < stop; i += step)
              if (i >= 0 && i < len) res.push(obj[i]);
          } else {
            for (let i = start; i > stop; i += step)
              if (i >= 0 && i < len) res.push(obj[i]);
          }
          return typeof obj === "string" ? res.join("") : res;
        },
      };

      // Use a data URL to import the generated JS code as a module
      const blob = new Blob([jsCode], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      try {
        const module = await import(url);
        const result = await module.main_wrapper(runtime);
        self.postMessage({
          type: "result",
          payload: `Result: ${result === undefined ? "None" : result}`,
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      self.postMessage({ type: "error", payload: err.message || String(err) });
    }
  }
};
