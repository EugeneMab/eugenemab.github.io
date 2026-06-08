import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";

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
        const len = view.getUint32(ptr, true);
        const start = ptr + 4;
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
    const { logs, result } = await runRust(code);
    // Since result is a pointer, we can't easily assert its value,
    // but we can try to print it.
    const code2 = `
      fn main() -> i32 {
        let s = get_str();
        print_str!(s);
        0
      }
      fn get_str() -> &str {
        return "hello";
      }
    `;
    // Wait, the current runner only calls main().
    // I need to use a single main function or update runRust.
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
