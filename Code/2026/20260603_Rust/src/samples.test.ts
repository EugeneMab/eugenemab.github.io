import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

async function runRust(code: string): Promise<{ logs: string[]; result: any }> {
  const INDEX_OUT_OF_BOUNDS_PANIC_CODE = 101;
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const emitter = new Emitter(ast, code);
  const wasm = emitter.emitWASM();

  const logs: string[] = [];
  let instance: any;
  const getMemoryView = () => {
    if (!(instance?.exports as any)?.memory) {
      throw new Error("WASM memory is not initialized");
    }
    return new DataView(((instance.exports as any).memory as WebAssembly.Memory).buffer);
  };
  const validateIndex = (ptr: number, idx: number) => {
    const view = getMemoryView();
    if (!Number.isInteger(ptr) || ptr < 0 || ptr + 4 > view.byteLength) {
      throw new Error(`Invalid collection pointer: ${ptr}`);
    }
    const len = view.getUint32(ptr, true);
    if (idx < 0 || idx >= len) {
      throw new Error(`Panic! Error code: ${INDEX_OUT_OF_BOUNDS_PANIC_CODE}`);
    }
    return view;
  };
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
      get_item: (ptr: number, idx: number) => {
        const view = validateIndex(ptr, idx);
        const addr = ptr + 4 + idx;
        if (addr < 0 || addr >= view.byteLength) {
          throw new Error(`Invalid byte address: ${addr}`);
        }
        return view.getUint8(addr);
      },
      get_item_i32: (ptr: number, idx: number) => {
        const view = validateIndex(ptr, idx);
        const addr = ptr + 4 + idx * 4;
        if (addr < 0 || addr + 4 > view.byteLength) {
          throw new Error(`Invalid i32 address: ${addr}`);
        }
        return view.getInt32(addr, true);
      },
      set_item: (ptr: number, idx: number, val: number) => {
        const view = validateIndex(ptr, idx);
        const addr = ptr + 4 + idx;
        if (addr < 0 || addr >= view.byteLength) {
          throw new Error(`Invalid byte address: ${addr}`);
        }
        view.setUint8(addr, val & 0xff);
        return 0;
      },
      set_item_i32: (ptr: number, idx: number, val: number) => {
        const view = validateIndex(ptr, idx);
        const addr = ptr + 4 + idx * 4;
        if (addr < 0 || addr + 4 > view.byteLength) {
          throw new Error(`Invalid i32 address: ${addr}`);
        }
        view.setInt32(addr, val | 0, true);
        return 0;
      },
    },
  };

  const { instance: inst } = (await WebAssembly.instantiate(
    wasm,
    importObject,
  )) as any;
  instance = inst;
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

    it("Book 1-3: Hello Cargo", async () => {
      const code = loadSample("book01_03_hello_cargo.rs");
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

    it("Book 2-0: Guessing Game If/Else", async () => {
      const code = loadSample("book02_00_if_else.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["x is five", "x is small"]);
      expect(result).toBe(0);
    });

    it("Book 2-0: Guessing Game Loop", async () => {
      const code = loadSample("book02_00_loop.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["1", "3", "4", "done"]);
      expect(result).toBe(0);
    });

    it("Book 2-0: Break Error (Negative at Emit)", async () => {
      const code = loadSample("book02_00_break_error.rs");
      await expect(runRust(code)).rejects.toThrow("'break' outside of loop");
    });

    it("Book 3-1: Immutability Error (Negative at Emit)", async () => {
      const code = loadSample("book03_01_immutability_error.rs");
      await expect(runRust(code)).rejects.toThrow(
        "Cannot assign to immutable variable: x",
      );
    });

    it("Book 3-1: Mutability", async () => {
      const code = loadSample("book03_01_mutability.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual([
        "The value of x is: ",
        "5",
        "The value of x is: ",
        "6",
      ]);
      expect(result).toBe(0);
    });

    it("Book 3-1: Constants", async () => {
      const code = loadSample("book03_01_constants.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["Seconds: ", "10800"]);
      expect(result).toBe(0);
    });

    it("Book 3-1: Shadowing", async () => {
      const code = loadSample("book03_01_shadowing.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["Inner x: ", "12", "Outer x: ", "6"]);
      expect(result).toBe(0);
    });

    it("Book 3-2: Data Types - Boolean", async () => {
      const code = loadSample("book03_02_booleans.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["t", "false"]);
      expect(result).toBe(0);
    });

    it("Book 3-3: Functions", async () => {
      const code = loadSample("book03_03_functions.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["The value of x is: ", "5", "5"]);
      expect(result).toBe(0);
    });

    it("Book 3-5: while Loop", async () => {
      const code = loadSample("book03_05_while.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["3", "2", "1", "LIFTOFF!"]);
      expect(result).toBe(0);
    });

    it("Book 3-5: if as Expression", async () => {
      const code = loadSample("book03_05_if_let.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["5"]);
      expect(result).toBe(0);
    });

    it("Book 4-1: Variable Scope", async () => {
      const code = loadSample("book04_01_scope.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["inner y: ", "20", "outer x: ", "10"]);
      expect(result).toBe(0);
    });

    it("Book 4-2: References and Borrowing", async () => {
      const code = loadSample("book04_02_borrow.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["borrowed mutably", "x after borrow: ", "6"]);
      expect(result).toBe(0);
    });

    it("Book 4-2: Mutable Borrow Conflict (Negative at Emit)", async () => {
      const code = loadSample("book04_02_mut_borrow_error.rs");
      await expect(runRust(code)).rejects.toThrow(
        "Cannot borrow 'x' as mutable: already borrowed",
      );
    });

    it("Book 4-3: Byte Index", async () => {
      const code = loadSample("book04_03_index.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["5"]);
      expect(result).toBe(0);
    });

    it("Book 4-3: String Slice", async () => {
      const code = loadSample("book04_03_slice.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["hello", "world"]);
      expect(result).toBe(0);
    });

    it("Book 4-3: First Word Slice", async () => {
      const code = loadSample("book04_03_first_word_slice.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["hello"]);
      expect(result).toBe(0);
    });

    it("Book 4-3: Slice Error (Negative at Compile)", async () => {
      const code = loadSample("book04_03_slice_error.rs");
      await expect(runRust(code)).rejects.toThrow(
        "Cannot use 's' while it is mutably borrowed",
      );
    });

    it("Book 4-3: Slice as Parameter", async () => {
      const code = loadSample("book04_03_slice_param.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual([
        "hello ",
        "hello world",
        "hello world",
        "hello ",
        "hello world",
        "hello world",
      ]);
      expect(result).toBe(0);
    });

    it("Book 4-3: Array Slice", async () => {
      const code = loadSample("book04_03_array_slice.rs");
      const { logs, result } = await runRust(code);
      expect(logs).toEqual(["2", "3"]);
      expect(result).toBe(0);
    });

    it("Book 4-3: Array Slice Out of Bounds (Negative at Execute)", async () => {
      const code = `fn main() {
    let a = [1, 2, 3, 4, 5];
    let slice = &a[1..3];
    if slice[0] == 2 {
        println!("{}", slice[9]);
    }
    if slice[1] == 3 {
        println!("{}", slice[1]);
    }
}`;
      await expect(runRust(code)).rejects.toThrow("Panic! Error code: 101");
    });
  });
});
