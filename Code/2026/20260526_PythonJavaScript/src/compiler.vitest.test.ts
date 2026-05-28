import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";

describe("Compiler Integration (JavaScript)", () => {
  const cases = [
    {
      name: "Basic Return",
      code: "def main():\n    return 42",
      expectedResult: 42,
    },
    {
      name: "Variables and Math",
      code: "def main():\n    x = 10\n    y = 20\n    return x + y",
      expectedResult: 30,
    },
    {
      name: "Subtraction and Locals",
      code: "def main():\n    a = 100\n    b = 40\n    c = a - b\n    return c - 10",
      expectedResult: 50,
    },
    {
      name: "Complex Math",
      code: "def main():\n    return (10 + 5) - (2 + 3)",
      expectedResult: 10,
    },
    {
      name: "Pass Statement Integration",
      code: "def main():\n    x = 42\n    if x == 42:\n        pass\n    else:\n        x = 0\n    return x",
      expectedResult: 42,
    },
  ];

  const runtime = {
    print: () => {},
    sleep: async () => {},
    range: (start: number, stop?: number, step: number = 1) => {
      if (stop === undefined) {
        stop = start;
        start = 0;
      }
      const res = [];
      for (let i = start; i < stop; i += step) res.push(i);
      return res;
    },
    len: (obj: any) => obj.length,
    abs: Math.abs,
    math: Math,
    _slice: (obj: any, start: any, stop: any, step: any) => {
      const len = obj.length;
      if (step === undefined || step === null) step = 1;
      if (start === undefined || start === null) start = step > 0 ? 0 : len - 1;
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
  };

  for (const c of cases) {
    it(`should pass case: ${c.name}`, async () => {
      const lexer = new Lexer(c.code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();

      const jsCode = compiler.compileJS(ast);

      // Execute using data URL or eval
      // For Node.js (Vitest), we can use eval if we wrap it
      // but dynamic import with data URL is cleaner if supported.
      // However, data URLs in Node require certain flags.
      // Let's use a simpler approach for tests: eval with a wrapper.

      const wrappedJs = jsCode.replace(
        "export async function main_wrapper",
        "async function main_wrapper",
      );
      const execute = new Function(
        "runtime",
        `
        ${wrappedJs}
        return main_wrapper(runtime);
      `,
      );

      const globals = await execute(runtime);
      expect(globals.__result__).toBe(c.expectedResult);
    });
  }
});
