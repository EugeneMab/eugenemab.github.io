import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";

async function runRust(code: string): Promise<{ logs: string[]; result: any }> {
  const INDEX_OUT_OF_BOUNDS_PANIC_CODE = 101;
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const emitter = new Emitter(ast, code);
  const wasm = emitter.emitWASM();

  const logs: string[] = [];
  const runtimeState: { instance: any } = { instance: null };
  const getMemoryView = () => {
    if (!(runtimeState.instance?.exports as any)?.memory) {
      throw new Error("WASM memory is not initialized");
    }
    return new DataView(
      ((runtimeState.instance.exports as any).memory as WebAssembly.Memory).buffer,
    );
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
        if (!Number.isInteger(ptr) || ptr < 0 || ptr + 4 > mem.length) {
          throw new Error(`Invalid string pointer: ${ptr}`);
        }
        const view = new DataView(mem.buffer);
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
  runtimeState.instance = inst;
  const instance = runtimeState.instance;
  const result = (instance.exports as any).main();
  return { logs, result };
}

describe("Return Statement Tests", () => {
  it("Simple return", async () => {
    const code = `
      fn main() -> i32 {
        return 42;
        100
      }
    `;
    const { result } = await runRust(code);
    expect(result).toBe(42);
  });

  it("Return in if branch", async () => {
    const code = `
      fn main() -> i32 {
        if true {
          return 1;
        }
        2
      }
    `;
    const { result } = await runRust(code);
    expect(result).toBe(1);
  });

  it("Return in loop", async () => {
    const code = `
      fn main() -> i32 {
        let mut i = 0;
        while i < 10 {
          if i == 5 {
            return i;
          }
          i = i + 1;
        }
        i
      }
    `;
    const { result } = await runRust(code);
    expect(result).toBe(5);
  });

  it("Return with no argument", async () => {
    const code = `
      fn main() -> i32 {
        return;
        42
      }
    `;
    const { result } = await runRust(code);
    expect(result).toBe(0);
  });

  it("Return &str (pointer as i32)", async () => {
    const code = `
      fn main() -> &str {
        return "hello";
      }
    `;
    const { result } = await runRust(code);
    expect(typeof result).toBe("number");
  });

  it("Return &str from helper", async () => {
    const code = `
      fn get_str() -> &str {
        return "hello";
      }
      fn main() -> i32 {
        let s = get_str();
        println!("{}", s);
        0
      }
    `;
    const { logs } = await runRust(code);
    expect(logs).toContain("hello");
  });
});
