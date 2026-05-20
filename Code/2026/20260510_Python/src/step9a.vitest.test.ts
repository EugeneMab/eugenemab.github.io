import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";

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
      let instance: any;
      const importObject = {
        env: {
          print: (val: number) => {
            logs.push(val);
            return 0;
          },
          print_str: (ptr: number) => {
            const view = new Int32Array(instance.exports.memory.buffer);
            const len = view[ptr / 4];
            let str = "";
            for (let i = 0; i < len; i++) {
              str += String.fromCharCode(view[ptr / 4 + 1 + i]);
            }
            logs.push(str);
            return 0;
          },
          itoa: (val: number) => {
            const s = String(val);
            const ptr = instance.exports.heap_ptr.value;
            const view = new Int32Array(instance.exports.memory.buffer);
            view[ptr / 4] = s.length;
            for (let i = 0; i < s.length; i++) {
              view[ptr / 4 + 1 + i] = s.charCodeAt(i);
            }
            instance.exports.heap_ptr.value += (s.length + 1) * 4;
            return ptr;
          },
          concat: (ptr1: number, ptr2: number) => {
            const view = new Int32Array(instance.exports.memory.buffer);
            const len1 = view[ptr1 / 4];
            const len2 = view[ptr2 / 4];
            const ptr = instance.exports.heap_ptr.value;
            view[ptr / 4] = len1 + len2;
            for (let i = 0; i < len1; i++) {
              view[ptr / 4 + 1 + i] = view[ptr1 / 4 + 1 + i];
            }
            for (let i = 0; i < len2; i++) {
              view[ptr / 4 + 1 + len1 + i] = view[ptr2 / 4 + 1 + i];
            }
            instance.exports.heap_ptr.value += (len1 + len2 + 1) * 4;
            return ptr;
          },
          sleep: () => 0,
        },
      };

      const { instance: inst } = await WebAssembly.instantiate(wasm, importObject);
      instance = inst;
      const func = instance.exports[funcName] as Function;
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
