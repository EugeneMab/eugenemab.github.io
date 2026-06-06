import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

async function runRust(code: string): Promise<{ logs: string[]; result: any }> {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const emitter = new Emitter(ast, code);
  const wasm = emitter.emitWASM();

  const logs: string[] = [];
  const importObject = {
    env: {
      print: (val: number) => {
        logs.push(String(val));
        return 0;
      },
      print_str: (ptr: number) => {
        const mem = new Uint8Array((instance.exports.memory as any).buffer);
        const view = new DataView(mem.buffer);
        if (!Number.isInteger(ptr) || ptr < 0 || ptr + 4 > mem.length) {
          throw new Error(`Invalid string pointer: ${ptr}`);
        }
        const len = view.getUint32(ptr, true);
        const start = ptr + 4;
        if (len > mem.length - start) {
          throw new Error(
            `Invalid string length ${len} at pointer ${ptr} for memory size ${mem.length}`,
          );
        }
        const str = new TextDecoder().decode(mem.subarray(start, start + len));
        logs.push(str);
        return 0;
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
  const result = (instance.exports as any).main();
  return { logs, result };
}

function loadSample(name: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const samplePath = path.join(__dirname, "..", "samples", name);
  return fs.readFileSync(samplePath, "utf-8");
}

describe("UI Samples Regression Tests", () => {
  it("Step 2: Literals & Keywords", async () => {
    const code = loadSample("step02_lexer.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["42", "42"]);
    expect(result).toBe(0);
  });

  it("Step 3: Implicit Return", async () => {
    const code = loadSample("step03_parser.rs");
    const { result } = await runRust(code);
    expect(result).toBe(30);
  });

  it("Step 6: Math & Logic", async () => {
    const code = loadSample("step06_math.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["20", "30", "1"]);
    expect(result).toBe(51);
  });

  it("Step 6: Bitwise Ops", async () => {
    const code = loadSample("step06_bitwise.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["0", "255", "16"]);
    expect(result).toBe(8);
  });

  it("Step 7: Comments", async () => {
    const code = loadSample("step07_comments.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["1"]);
    expect(result).toBe(1);
  });

  it("Step 8: Print Macro", async () => {
    const code = loadSample("step08_print.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["111", "222", "333"]);
    expect(result).toBe(0);
  });

  it("Step 9: Panic (Negative at Execute)", async () => {
    const code = loadSample("step09_panic.rs");
    await expect(runRust(code)).rejects.toThrow("Panic! Error code: 456");
  });

  it("Step 10: Scope Detection", async () => {
    const code = loadSample("step10_scope.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["2", "1"]);
    expect(result).toBe(0);
  });

  it("Step 11: Region-Based Memory", async () => {
    const code = loadSample("step11_regions.rs");
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["16", "16"]);
    expect(result).toBe(0);
  });

  it("Step 12: Borrow Checker", async () => {
    // Valid borrow
    const codeLegal = loadSample("step12_borrow.rs");
    await runRust(codeLegal);

    // Multiple mutable borrows (Illegal)
    const codeIllegal1 = `fn main() {\n    let mut x = 5;\n    let y = &mut x;\n    let z = &mut x;\n    0\n}`;
    await expect(runRust(codeIllegal1)).rejects.toThrow(
      "Cannot borrow 'x' as mutable: already borrowed",
    );
    // Check for source location in error message
    await expect(runRust(codeIllegal1)).rejects.toThrow(
      "Error at line 4, column 13",
    );

    // Use while borrowed (Illegal)
    const codeIllegal2 = `fn main() {\n    let mut x = 5;\n    let y = &mut x;\n    print!(x);\n    0\n}`;
    await expect(runRust(codeIllegal2)).rejects.toThrow(
      "Cannot use 'x' while it is mutably borrowed",
    );
    await expect(runRust(codeIllegal2)).rejects.toThrow(
      "Error at line 4, column 12",
    );
  });

  describe("Rust Book Samples", () => {
    it("Book 1-2: Hello World", async () => {
      const code = loadSample("book01_02_hello_world.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["Hello, world!"]);
      expect(result).toBe(0);
    });

    it("Book 2-0: Guessing Game Variables", async () => {
      const code = loadSample("book02_00_variables.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["5", "5"]);
      expect(result).toBe(0);
    });
  });
});
