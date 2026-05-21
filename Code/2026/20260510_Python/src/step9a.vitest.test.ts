import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getImportObject } from "./test-utils.ts";

describe("Step 9a & 9b: Loops and Strings", () => {
  describe("Execution (Multiplication Table)", () => {
    const run = async (code: string, funcName: string) => {
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();
      const wasm = compiler.compileWASM(ast);

      const logs: any[] = [];
      const instanceRef = { instance: null as any };
      const importObject = getImportObject(instanceRef, logs);

      const { instance: inst } = await WebAssembly.instantiate(
        wasm,
        importObject,
      );
      instanceRef.instance = inst;
      const func = instanceRef.instance.exports[funcName] as Function;
      const result = func();
      return { result, logs };
    };

    it("should execute multiplication table 1-9", async () => {
      const code = `
def main():
    for i from 1 to 10:
        for j from 1 to 10:
            print(f"{i} * {j} = {i*j}")
    return 0
`;
      const { logs } = await run(code, "main");
      expect(logs).toContain("1 * 1 = 1");
      expect(logs).toContain("9 * 9 = 81");
      expect(logs.length).toBe(81);
    });

    it("should support do-while loop", async () => {
      const code = `
def main():
    i = 0
    do:
        print(i)
        i = i + 1
    while i < 3
    return i
`;
      const { result, logs } = await run(code, "main");
      expect(logs).toEqual([0, 1, 2]);
      expect(result).toBe(3);
    });
  });
});
