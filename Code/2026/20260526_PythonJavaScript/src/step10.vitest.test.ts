import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getJSRuntime, runJS } from "./test-utils.ts";

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

  it("should compile generator to JS and execute", async () => {
    const code = "def gen():\n    yield 1\n    yield 2\n";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const jsCode = compiler.compileJS(ast);

    expect(jsCode).toContain("async function* gen");
    expect(jsCode).toContain("yield 1");
    expect(jsCode).toContain("yield 2");
  });

  describe("Execution (JS Runtime)", () => {
    const run = async (code: string, funcName: string, args: any[] = []) => {
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();
      const jsCode = compiler.compileJS(ast);

      const runtime = getJSRuntime();
      const globals = await runJS(jsCode, runtime);
      const func = globals[funcName];
      return await func(...args);
    };

    it("test_generator_basic: should yield multiple values", async () => {
      const code = "def gen():\n    yield 10\n    yield 20\n";
      const it = await run(code, "gen");
      expect((await it.next()).value).toBe(10);
      expect((await it.next()).value).toBe(20);
      expect((await it.next()).value).toBeUndefined(); // Exhausted
    });

    it("test_infinite_sequence: Fibonacci generator", async () => {
      const code =
        "def fib():\n    a = 0\n    b = 1\n    while True:\n        yield a\n        t = a + b\n        a = b\n        b = t\n";
      const it = await run(code, "fib");
      expect((await it.next()).value).toBe(0);
      expect((await it.next()).value).toBe(1);
      expect((await it.next()).value).toBe(1);
      expect((await it.next()).value).toBe(2);
      expect((await it.next()).value).toBe(3);
      expect((await it.next()).value).toBe(5);
    });

    it("test_stop_iteration: Manual next() calls until exhaustion", async () => {
      const code = "def gen():\n    yield 5\n    yield 10\n";
      const it = await run(code, "gen");
      expect((await it.next()).value).toBe(5);
      expect((await it.next()).value).toBe(10);
      expect((await it.next()).value).toBeUndefined(); // Exhausted
      expect((await it.next()).value).toBeUndefined(); // Remains undefined
    });
  });
});
