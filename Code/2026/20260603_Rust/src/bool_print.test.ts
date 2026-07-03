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
  const runtimeState: { instance: any } = { instance: null };
  const importObject = {
    env: {
      print: (val: number) => {
        logs.push(String(val));
        return 0;
      },
      print_str: (ptr: number) => {
        const mem = new Uint8Array(
          (runtimeState.instance.exports.memory as any).buffer,
        );
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
      get_item: () => 0,
      get_item_i32: () => 0,
      set_item: () => 0,
      set_item_i32: () => 0,
    },
  };

  const { instance } = await WebAssembly.instantiate(wasm, importObject);
  runtimeState.instance = instance;
  const result = (instance.exports.main as any)();
  return { logs, result };
}

describe("Boolean Printing Comprehensive Tests", () => {
  it("should print true and false for boolean literals", async () => {
    const { logs } = await runRust(`
      fn main() {
        println!(true);
        println!(false);
      }
    `);
    expect(logs).toEqual(["true", "\n", "false", "\n"]);
  });

  it("should print true and false for boolean variables", async () => {
    const { logs } = await runRust(`
      fn main() {
        let t = true;
        let f = false;
        println!(t);
        println!(f);
      }
    `);
    expect(logs).toEqual(["true", "\n", "false", "\n"]);
  });

  it("should print true and false for boolean expressions", async () => {
    const { logs } = await runRust(`
      fn main() {
        println!(1 == 1);
        println!(1 != 1);
        println!(true && true);
        println!(true || false);
        println!(!true);
      }
    `);
    expect(logs).toEqual([
      "true",
      "\n",
      "false",
      "\n",
      "true",
      "\n",
      "true",
      "\n",
      "false",
      "\n",
    ]);
  });

  it("should generate correct WAT for boolean literals", () => {
    const code = `fn main() { println!(true); }`;
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, code);
    const ast = parser.parse();
    const emitter = new Emitter(ast, code);
    const wat = emitter.emitWAT();
    expect(wat).toContain("i32.const 1");
    expect(wat).not.toContain("i32.const true");
  });

  it("should print true and false for boolean fields in structs with debug format", async () => {
    const { logs } = await runRust(`
      struct Flag {
        active: bool,
      }
      fn main() {
        let f = Flag { active: true };
        println!("{:?}", f);
      }
    `);
    expect(logs.join("")).toContain("active: true");
  });

  it("should print a newline for println!() with no arguments", async () => {
    const { logs } = await runRust(`
      fn main() {
        println!();
      }
    `);
    expect(logs).toEqual(["\n"]);
  });

  it("should print true and false for borrowed booleans", async () => {
    const { logs } = await runRust(`
      fn main() {
        let t = true;
        let rt = &t;
        println!(rt);
      }
    `);
    expect(logs).toEqual(["true", "\n"]);
  });

  it("should print true and false in tuples with debug format", async () => {
    const { logs } = await runRust(`
      fn main() {
        let t = (true, false);
        println!("{:?}", t);
      }
    `);
    expect(logs.join("")).toContain("(true, false)");
  });

  it("should print true and false for method return values", async () => {
    const { logs } = await runRust(`
      struct Rectangle {
        width: i32,
        height: i32,
      }
      impl Rectangle {
        fn can_hold(&self, other: &Rectangle) -> bool {
          self.width > other.width && self.height > other.height
        }
      }
      fn main() {
        let r1 = Rectangle { width: 30, height: 50 };
        let r2 = Rectangle { width: 10, height: 40 };
        println!("{}", r1.can_hold(&r2));
      }
    `);
    expect(logs).toContain("true");
  });
});
