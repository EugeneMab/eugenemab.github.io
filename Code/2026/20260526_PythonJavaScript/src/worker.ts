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
      self.postMessage({
        type: "ast",
        payload: JSON.stringify(
          ast,
          (key, value) =>
            typeof value === "bigint" ? value.toString() + "n" : value,
          2,
        ),
      });

      // 3. Compiling
      const compiler = new Compiler();
      const jsCode = compiler.compileJS(ast);
      self.postMessage({ type: "js", payload: jsCode });

      // 4. Execution
      const runtime = {
        print: (val: any) => {
          let payload;
          if (Array.isArray(val)) {
            payload = `[${val.map((v) => String(v)).join(", ")}]`;
          } else {
            payload = String(val);
          }
          self.postMessage({ type: "log", payload });
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
        int: (val: any) => {
          if (typeof val === "string") {
            try {
              const truncated = val.split(".")[0];
              const b = BigInt(truncated);
              if (
                b <= BigInt(Number.MAX_SAFE_INTEGER) &&
                b >= BigInt(Number.MIN_SAFE_INTEGER)
              ) {
                return Number(b);
              }
              return b;
            } catch {
              return 0;
            }
          }
          if (typeof val === "number") return Math.trunc(val);
          if (typeof val === "bigint") return val;
          if (typeof val === "boolean") return val ? 1 : 0;
          return 0;
        },
        float: (val: any) => {
          if (typeof val === "string") return parseFloat(val);
          if (typeof val === "number") return val;
          if (typeof val === "bigint") return Number(val);
          if (typeof val === "boolean") return val ? 1.0 : 0.0;
          return 0.0;
        },
        bool: (val: any) => {
          return runtime._is_truthy(val);
        },
        chr: (val: any) => {
          const codePoint = Number(val);
          if (
            !Number.isInteger(codePoint) ||
            codePoint < 0 ||
            codePoint > 0x10ffff
          ) {
            throw new Error("chr() arg not in range(0x110000)");
          }
          return String.fromCodePoint(codePoint);
        },
        ord: (val: any) => {
          if (typeof val === "string" && Array.from(val).length === 1) {
            return val.codePointAt(0);
          }
          throw new Error("ord() expected a string of length 1");
        },
        _is_truthy: (val: any) => {
          if (val === null || val === undefined) return false;
          if (typeof val === "boolean") return val;
          if (typeof val === "number") return val !== 0;
          if (typeof val === "bigint") return val !== 0n;
          if (typeof val === "string") return val.length > 0;
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === "object") {
            if (Object.keys(val).length === 0) return false;
            return true;
          }
          return true;
        },
        _binop: (op: string, a: any, b: any) => {
          const isAInt = typeof a === "bigint" || Number.isInteger(a);
          const isBInt = typeof b === "bigint" || Number.isInteger(b);

          if (isAInt && isBInt) {
            const ba = BigInt(a);
            const bb = BigInt(b);
            let res;
            switch (op) {
              case "+":
                res = ba + bb;
                break;
              case "-":
                res = ba - bb;
                break;
              case "*":
                res = ba * bb;
                break;
              case "/":
                res = Number(ba) / Number(bb);
                break;
              case "===":
                return ba === bb;
              case "!==":
                return ba !== bb;
              case "<":
                return ba < bb;
              case ">":
                return ba > bb;
              case "<=":
                return ba <= bb;
              case ">=":
                return ba >= bb;
              default:
                throw new Error(`Operator ${op} not implemented for integers`);
            }
            if (
              res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
            ) {
              return Number(res);
            }
            return res;
          }

          switch (op) {
            case "+":
              return a + b;
            case "-":
              return a - b;
            case "*":
              return a * b;
            case "/":
              return a / b;
            case "===":
              return a === b;
            case "!==":
              return a !== b;
            case "<":
              return a < b;
            case ">":
              return a > b;
            case "<=":
              return a <= b;
            case ">=":
              return a >= b;
            default:
              throw new Error(`Operator ${op} not implemented`);
          }
        },
        _slice: (obj: any, start: any, stop: any, step: any) => {
          const len = obj.length;
          if (step === undefined || step === null) step = 1;
          if (start === undefined || start === null)
            start = step > 0 ? 0 : len - 1;
          if (stop === undefined || stop === null) stop = step > 0 ? len : -1;

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
        _iter: (obj: any) => {
          // If it's already an async iterator, return as is
          if (obj && obj[Symbol.asyncIterator]) return obj;
          // If it's a sync iterable (like an Array), return its sync iterator
          // JS 'for await' handles sync iterables, but we can be explicit
          return obj;
        },
      };

      // Use a data URL to import the generated JS code as a module
      const blob = new Blob([jsCode], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      try {
        const module = await import(url);
        const globals = await module.main_wrapper(runtime);
        const result = globals.__result__;
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
