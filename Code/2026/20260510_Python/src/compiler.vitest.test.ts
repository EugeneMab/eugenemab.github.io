import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getImportObject } from "./test-utils.ts";

describe("Compiler Integration", () => {
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
  ];

  for (const c of cases) {
    it(`should pass case: ${c.name}`, async () => {
      const lexer = new Lexer(c.code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();

      compiler.compileWAT(ast);
      const wasm = compiler.compileWASM(ast);

      const instanceRef = { instance: null as any };
      const importObject = getImportObject(instanceRef);

      // Verify by running in WASM runtime
      const { instance } = (await WebAssembly.instantiate(
        wasm,
        importObject,
      )) as any;
      instanceRef.instance = instance;
      const result = (instance.exports.main as Function)();

      expect(result).toBe(c.expectedResult);
    });
  }
});
