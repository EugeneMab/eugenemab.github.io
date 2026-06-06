import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";

async function runRust(code: string): Promise<{ logs: string[]; result: any }> {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const emitter = new Emitter(ast);
  const wasm = emitter.emitWASM();

  const logs: string[] = [];
  const importObject = {
    env: {
      print: (val: number) => {
        logs.push(String(val));
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

describe("UI Samples Regression Tests", () => {
  it("Step 2: Literals & Keywords", async () => {
    const code = `// Step 2: Lexer (Literals & Keywords)\nfn main() {\n    let dec = 42;\n    let hex = 0x2A;\n    let s = "Rust";\n    print!(dec);\n    print!(hex);\n    0\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["42", "42"]);
    expect(result).toBe(0);
  });

  it("Step 3: Implicit Return", async () => {
    // Nested block expression with implicit return
    const code = `// Step 3: Parser (Implicit Return)\nfn main() {\n    let x = 1;\n    {\n        let x = 2;\n        x\n    };\n    10 + 20\n}`;
    const { result } = await runRust(code);
    expect(result).toBe(30);
  });

  it("Step 6: Math & Logic", async () => {
    const code = `// Step 6: Math & Logic\nfn main() {\n    let a = 10 + 5 * 2;\n    let b = (10 + 5) * 2;\n    let c = 100 % 3;\n    print!(a); // 20\n    print!(b); // 30\n    print!(c); // 1\n    a + b + c\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["20", "30", "1"]);
    expect(result).toBe(51);
  });

  it("Step 6: Bitwise Ops", async () => {
    const code = `// Step 6: Bitwise Ops\nfn main() {\n    let x = 0x0F & 0xF0; // 0\n    let y = 0x0F | 0xF0; // 255\n    let z = 1 << 4;      // 16\n    print!(x);\n    print!(y);\n    print!(z);\n    z >> 1 // 8\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["0", "255", "16"]);
    expect(result).toBe(8);
  });

  it("Step 7: Comments", async () => {
    const code = `// Step 7: Comments\n/// This is a doc comment\nfn main() {\n    // Single line comment\n    let x = 1; // Inline comment\n    print!(x);\n    x\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["1"]);
    expect(result).toBe(1);
  });

  it("Step 8: Print Macro", async () => {
    const code = `// Step 8: Print Macro\nfn main() {\n    print!(111);\n    print!(222);\n    print!(333);\n    0\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["111", "222", "333"]);
    expect(result).toBe(0);
  });

  it("Step 9: Panic", async () => {
    const code = `// Step 9: Panic\nfn main() {\n    print!(123);\n    panic!(456);\n    print!(789);\n    0\n}`;
    await expect(runRust(code)).rejects.toThrow("Panic! Error code: 456");
  });

  it("Step 10: Scope Detection", async () => {
    const code = `// Step 10: Scope Detection\nfn main() {\n    let x = 1;\n    {\n        let x = 2;\n        print!(x); // Should be 2\n    }\n    print!(x); // Should be 1\n    0\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["2", "1"]);
    expect(result).toBe(0);
  });

  it("Step 11: Region-Based Memory", async () => {
    const code = `// Step 11: Region-Based Memory\nfn main() {\n    let p1 = alloc!(16);\n    {\n        let p2 = alloc!(32);\n        print!(p2 - p1); // Should be 16\n    }\n    let p3 = alloc!(16);\n    print!(p3 - p1); // Should be 16 (p2 was deallocated)\n    0\n}`;
    const { logs, result } = await runRust(code);
    expect(logs).toEqual(["16", "16"]);
    expect(result).toBe(0);
  });

  it("Step 12: Borrow Checker", async () => {
    // Valid borrow
    const codeLegal = `fn main() {\n    let mut x = 5;\n    let y = &mut x;\n    0\n}`;
    await runRust(codeLegal);

    // Multiple mutable borrows (Illegal)
    const codeIllegal1 = `fn main() {\n    let mut x = 5;\n    let y = &mut x;\n    let z = &mut x;\n    0\n}`;
    await expect(runRust(codeIllegal1)).rejects.toThrow(
      "Cannot borrow 'x' as mutable: already borrowed",
    );

    // Use while borrowed (Illegal)
    const codeIllegal2 = `fn main() {\n    let mut x = 5;\n    let y = &mut x;\n    print!(x);\n    0\n}`;
    await expect(runRust(codeIllegal2)).rejects.toThrow(
      "Cannot use 'x' while it is mutably borrowed",
    );
  });
});
