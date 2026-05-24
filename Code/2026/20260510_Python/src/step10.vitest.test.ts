import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getImportObject } from "./test-utils.ts";

describe("Step 10: Iterators & Generators (Parser)", () => {
  it("should parse yield statement", () => {
    const code = "def gen():\n    yield 1\n    yield 2\n";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const func = ast.body[0] as any;
    expect(func.type).toBe("FunctionDef");
    expect(func.body[0].type).toBe("Yield");
    expect(func.body[0].value.value).toBe(1);
    expect(func.body[1].type).toBe("Yield");
    expect(func.body[1].value.value).toBe(2);
  });

  it("should compile generator to WAT and execute (simulated next)", async () => {
    // This is hard to test directly without a full WASM runtime in the test.
    // But we can check if the WAT contains the expected dispatcher.
    const code = "def gen():\n    yield 1\n    yield 2\n";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const wat = compiler.compileWAT(ast);

    expect(wat).toContain("func $gen");
    expect(wat).toContain("func $gen_worker");
    expect(wat).toContain("func $next");
  });

  describe("Execution (WASM Binary)", () => {
    const run = async (code: string, funcName: string, args: number[] = []) => {
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();
      const wasm = compiler.compileWASM(ast);

      const instanceRef = { instance: null as any };
      const logs: any[] = [];
      const importObject = getImportObject(instanceRef, logs);

      const { instance } = await WebAssembly.instantiate(wasm, importObject);
      instanceRef.instance = instance;
      const func = instance.exports[funcName] as Function;
      const next = instance.exports["next"] as Function;
      return {
        result: func(...args),
        next: (ptr: number) => next(ptr),
        instance,
        logs,
      };
    };

    it("test_generator_basic: should yield multiple values", async () => {
      const code = "def gen():\n    yield 10\n    yield 20\n";
      const { result, next } = await run(code, "gen");
      expect(next(result)).toBe(10);
      expect(next(result)).toBe(20);
      expect(next(result)).toBe(0); // Exhausted
    });

    it("test_infinite_sequence: Fibonacci generator", async () => {
      const code =
        "def fib():\n    a = 0\n    b = 1\n    while True:\n        yield a\n        t = a + b\n        a = b\n        b = t\n";
      const { result, next } = await run(code, "fib");
      expect(next(result)).toBe(0);
      expect(next(result)).toBe(1);
      expect(next(result)).toBe(1);
      expect(next(result)).toBe(2);
      expect(next(result)).toBe(3);
      expect(next(result)).toBe(5);
    });

    it("test_stop_iteration: Manual next() calls until exhaustion", async () => {
      const code = "def gen():\n    yield 5\n    yield 10\n";
      const { result, next } = await run(code, "gen");
      expect(next(result)).toBe(5);
      expect(next(result)).toBe(10);
      expect(next(result)).toBe(0); // Exhausted returns 0 in our implementation
      expect(next(result)).toBe(0); // Remains 0
    });
  });
});
