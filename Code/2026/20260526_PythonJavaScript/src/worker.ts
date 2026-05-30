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
      class Tuple extends Array {
        constructor(...args: any[]) {
          super();
          const elements =
            args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          this.push(...elements);
          Object.freeze(this);
        }
        [Symbol.toPrimitive](_hint: string) {
          return this.toString();
        }
        toString() {
          if (this.length === 1) return `(${this[0]},)`;
          return `(${this.join(", ")})`;
        }
      }

      const runtime: any = {
        print: (val: any) => {
          const format = (v: any): string => {
            if (v instanceof Tuple) return v.toString();
            if (v instanceof Set)
              return `set([${Array.from(v)
                .map((x) => format(x))
                .join(", ")}])`;
            if (v instanceof Uint8Array)
              return `b'${Array.from(v)
                .map((b) => "\\x" + b.toString(16).padStart(2, "0"))
                .join("")}'`;
            if (Array.isArray(v))
              return `[${v.map((x) => format(x)).join(", ")}]`;
            if (v !== null && typeof v === "object" && !(v instanceof Date)) {
              if (v instanceof Map) {
                return `{${Array.from(v.entries())
                  .map(([k, val]) => `${format(k)}: ${format(val)}`)
                  .join(", ")}}`;
              }
              return `{${Object.entries(v)
                .map(([k, val]) => `${JSON.stringify(k)}: ${format(val)}`)
                .join(", ")}}`;
            }
            return String(v);
          };
          self.postMessage({ type: "log", payload: format(val) });
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
          if (obj instanceof Set || obj instanceof Map) return obj.size;
          if (obj instanceof Uint8Array) return obj.length;
          if (typeof obj === "object") return Object.keys(obj).length;
          return 0;
        },
        abs: (val: number) => Math.abs(val),
        math: Math,
        int: (val: any) => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            try {
              if (trimmed === "") throw new Error("empty string");
              const truncated = trimmed.split(".")[0];
              const b = BigInt(truncated);
              if (
                b <= BigInt(Number.MAX_SAFE_INTEGER) &&
                b >= BigInt(Number.MIN_SAFE_INTEGER)
              ) {
                return Number(b);
              }
              return b;
            } catch {
              throw new Error(
                `invalid literal for int() with base 10: '${val}'`,
              );
            }
          }
          if (typeof val === "number") return Math.trunc(val);
          if (typeof val === "bigint") return val;
          if (typeof val === "boolean") return val ? 1 : 0;
          throw new Error(
            `int() argument must be a string, a bytes-like object or a real number, not '${typeof val}'`,
          );
        },
        float: (val: any) => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            const floatLiteralPattern =
              /^[+-]?(?:Infinity|NaN|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/i;
            if (!floatLiteralPattern.test(trimmed)) {
              throw new Error(`could not convert string to float: '${val}'`);
            }
            return Number(trimmed);
          }
          if (typeof val === "number") return val;
          if (typeof val === "bigint") return Number(val);
          if (typeof val === "boolean") return val ? 1.0 : 0.0;
          throw new Error(
            `float() argument must be a string or a real number, not '${typeof val}'`,
          );
        },
        bool: (val: any) => {
          return runtime.__true(val);
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
          if (val instanceof Uint8Array && val.length === 1) {
            return val[0];
          }
          throw new Error(
            "ord() expected a string of length 1 or bytes of length 1",
          );
        },
        tuple: (val: any) => {
          if (val === undefined) return new Tuple();
          if (Array.isArray(val)) return new Tuple(val);
          if (typeof val[Symbol.iterator] === "function")
            return new Tuple([...val]);
          return new Tuple([val]);
        },
        set: (val: any) => {
          if (val === undefined) return new Set();
          if (typeof val[Symbol.iterator] === "function") return new Set(val);
          return new Set([val]);
        },
        frozenset: (val: any) => {
          // Note: Object.freeze() does not make JS Set immutable.
          return runtime.set(val);
        },
        bytes: (val: any, _encoding?: string) => {
          if (val === undefined) return new Uint8Array();
          if (typeof val === "number") return new Uint8Array(val);
          if (typeof val === "string") {
            return new TextEncoder().encode(val);
          }
          if (Array.isArray(val) || val instanceof Uint8Array)
            return new Uint8Array(val);
          return new Uint8Array();
        },
        bytearray: (val: any) => {
          return runtime.bytes(val);
        },
        dict: (val: any) => {
          if (val === undefined) return Object.create(null);
          if (Array.isArray(val)) {
            const res: any = Object.create(null);
            for (const item of val) {
              if (Array.isArray(item) && item.length === 2) {
                res[item[0]] = item[1];
              }
            }
            return res;
          }
          return Object.assign(Object.create(null), val);
        },
        sum: (iterable: any, start: any = 0) => {
          let res = start;
          for (const item of iterable) {
            res = runtime.__add(res, item);
          }
          return res;
        },
        any: (iterable: any) => {
          for (const item of iterable) {
            if (runtime.__true(item)) return true;
          }
          return false;
        },
        all: (iterable: any) => {
          for (const item of iterable) {
            if (!runtime.__true(item)) return false;
          }
          return true;
        },
        max: (...args: any[]) => {
          let iterable = args;
          if (args.length === 1) {
            iterable = args[0];
          }
          // Simple implementation without key/default for now to keep it lean
          let res: any = undefined;
          for (const item of iterable) {
            if (res === undefined || runtime.__gt(item, res)) res = item;
          }
          if (res === undefined)
            throw new Error("max() arg is an empty sequence");
          return res;
        },
        min: (...args: any[]) => {
          let iterable = args;
          if (args.length === 1) {
            iterable = args[0];
          }
          let res: any = undefined;
          for (const item of iterable) {
            if (res === undefined || runtime.__lt(item, res)) res = item;
          }
          if (res === undefined)
            throw new Error("min() arg is an empty sequence");
          return res;
        },
        enumerate: (iterable: any, start: number = 0) => {
          const res = [];
          let i = start;
          for (const item of iterable) {
            res.push(new Tuple([i++, item]));
          }
          return res;
        },
        zip: (...iterables: any[]) => {
          const iters = iterables.map((it) => Array.from(it));
          const minLen = Math.min(...iters.map((it) => it.length));
          const res = [];
          for (let i = 0; i < minLen; i++) {
            res.push(new Tuple(iters.map((it) => it[i])));
          }
          return res;
        },
        reversed: (seq: any) => {
          const arr = Array.from(seq);
          arr.reverse();
          return arr;
        },
        sorted: (iterable: any, _key?: any, reverse: boolean = false) => {
          const arr = Array.from(iterable);
          arr.sort((a, b) => {
            const va = a;
            const vb = b;
            if (runtime.__lt(va, vb)) return reverse ? 1 : -1;
            if (runtime.__gt(va, vb)) return reverse ? -1 : 1;
            return 0;
          });
          return arr;
        },
        type: (obj: any) => {
          if (obj === null) return "NoneType";
          if (obj instanceof Tuple) return "tuple";
          if (obj instanceof Set) return "set";
          if (obj instanceof Uint8Array) return "bytes";
          if (Array.isArray(obj)) return "list";
          return typeof obj;
        },
        isinstance: (obj: any, typeInfo: any) => {
          const t = runtime.type(obj);
          if (Array.isArray(typeInfo)) {
            return typeInfo.some((ti) => t === ti);
          }
          return t === typeInfo;
        },
        callable: (obj: any) => typeof obj === "function",
        __true: (val: any) => {
          if (val === null || val === undefined) return false;
          if (typeof val === "boolean") return val;
          if (typeof val === "number") return val !== 0;
          if (typeof val === "bigint") return val !== 0n;
          if (typeof val === "string") return val.length > 0;
          if (Array.isArray(val)) return val.length > 0;
          if (val instanceof Set || val instanceof Map) return val.size > 0;
          if (val instanceof Uint8Array) return val.length > 0;
          if (typeof val === "object") {
            if (Object.keys(val).length === 0) return false;
            return true;
          }
          return true;
        },
        __and: async (aFn: any, bFn: any) => {
          const a = await aFn();
          return runtime.__true(a) ? await bFn() : a;
        },
        __or: async (aFn: any, bFn: any) => {
          const a = await aFn();
          return runtime.__true(a) ? a : await bFn();
        },
        __item: (obj: any, idx: any) => {
          if (
            typeof idx === "number" &&
            idx < 0 &&
            (Array.isArray(obj) ||
              typeof obj === "string" ||
              obj instanceof Uint8Array)
          ) {
            return obj[obj.length + idx];
          }
          return obj[idx];
        },
        __add: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) + BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a + b;
        },
        __sub: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) - BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a - b;
        },
        __mul: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) * BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a * b;
        },
        __div: (a: any, b: any) => {
          return Number(a) / Number(b);
        },
        __eq: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            return BigInt(a) === BigInt(b);
          }
          return a === b;
        },
        __ne: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            return BigInt(a) !== BigInt(b);
          }
          return a !== b;
        },
        __lt: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            return BigInt(a) < BigInt(b);
          }
          return a < b;
        },
        __gt: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            return BigInt(a) > BigInt(b);
          }
          return a > b;
        },
        __le: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            return BigInt(a) <= BigInt(b);
          }
          return a <= b;
        },
        __ge: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            return BigInt(a) >= BigInt(b);
          }
          return a >= b;
        },
        __floordiv: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const ab = BigInt(a);
            const bb = BigInt(b);
            let res = ab / bb;
            if (ab < 0n !== bb < 0n && ab % bb !== 0n) res -= 1n;
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return Math.floor(Number(a) / Number(b));
        },
        __mod: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const ab = BigInt(a);
            const bb = BigInt(b);
            const res = ab % bb;
            const res_py = ((res % bb) + bb) % bb;
            return res_py <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res_py >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res_py)
              : res_py;
          }
          const res = Number(a) % Number(b);
          return ((res % Number(b)) + Number(b)) % Number(b); // Python-style modulo
        },
        __pow: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const ab = BigInt(a);
            const bb = BigInt(b);
            if (bb < 0n) return Math.pow(Number(a), Number(b));
            const res = ab ** bb;
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return Math.pow(Number(a), Number(b));
        },
        __and_bw: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) & BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a & b;
        },
        __or_bw: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) | BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a | b;
        },
        __xor_bw: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) ^ BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a ^ b;
        },
        __lshift: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) << BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a << b;
        },
        __rshift: (a: any, b: any) => {
          if (
            (typeof a === "bigint" || Number.isInteger(a)) &&
            (typeof b === "bigint" || Number.isInteger(b))
          ) {
            const res = BigInt(a) >> BigInt(b);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return a >> b;
        },
        __invert: (a: any) => {
          if (typeof a === "bigint" || Number.isInteger(a)) {
            const res = ~BigInt(a);
            return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
              res >= BigInt(Number.MIN_SAFE_INTEGER)
              ? Number(res)
              : res;
          }
          return ~a;
        },
        __in: (item: any, container: any) => {
          if (Array.isArray(container) || typeof container === "string") {
            return container.includes(item);
          }
          if (container instanceof Set || container instanceof Map) {
            return container.has(item);
          }
          if (container instanceof Uint8Array) {
            return container.includes(item);
          }
          if (typeof container === "object" && container !== null) {
            return Object.prototype.hasOwnProperty.call(container, item);
          }
          return false;
        },
        __slice: (obj: any, start: any, stop: any, step: any) => {
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
          if (typeof obj === "string") return res.join("");
          if (obj instanceof Uint8Array) return new Uint8Array(res);
          if (obj instanceof Tuple) return new Tuple(res);
          return res;
        },
        __iter: (obj: any) => {
          if (obj && obj[Symbol.asyncIterator]) return obj;
          if (obj && obj[Symbol.iterator]) return obj;
          return obj;
        },
        __tuple: (elements: any[]) => new Tuple(elements),
        __set: (elements: any[]) => new Set(elements),
        __dict: (entries: [any, any][]) => {
          const res: any = Object.create(null);
          for (const [k, v] of entries) res[k] = v;
          return res;
        },
        __bytes: (val: string) => {
          const res = new Uint8Array(val.length);
          for (let i = 0; i < val.length; i++) res[i] = val.charCodeAt(i);
          return res;
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
