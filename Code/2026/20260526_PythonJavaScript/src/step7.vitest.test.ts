import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getJSRuntime, runJS } from "./test-utils.ts";

describe("Step 7: Parameters & Scoping", () => {
  describe("Lexer & Parser", () => {
    it("should parse function with parameters", () => {
      const code = "def add(a, b):\n    return a + b";
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const func = ast.body[0] as any;
      expect(func.type).toBe("FunctionDef");
      expect(func.name).toBe("add");
      expect(func.params).toEqual(["a", "b"]);
    });

    it("should parse function call with multiple arguments", () => {
      const code = "def main():\n    return add(1, 2, 3)";
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();

      const main = ast.body[0] as any;
      const ret = main.body[0] as any;
      expect(ret.type).toBe("Return");
      expect(ret.value.type).toBe("CallExpression");
      expect(ret.value.callee).toBe("add");
      expect(ret.value.args.length).toBe(3);
    });
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

    it("test_params: should handle multiple arguments (0, 1, 2, 5)", async () => {
      expect(await run("def f0():\n    return 42", "f0")).toBe(42);
      expect(await run("def f1(a):\n    return a * 2", "f1", [10])).toBe(20);
      expect(await run("def f2(a, b):\n    return a + b", "f2", [10, 20])).toBe(
        30,
      );
      expect(
        await run(
          "def f5(a, b, c, d, e):\n    return a + b + c + d + e",
          "f5",
          [1, 2, 3, 4, 5],
        ),
      ).toBe(15);
    });

    it("test_recursion: Fibonacci", async () => {
      // Note: My current <= parser might need checking.
      // Let's check parser.ts for <=. It only has < and > and == and !=.
      // Wait, let's use n < 2 instead.
      const codeFixed = `def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
`;
      expect(await run(codeFixed, "fib", [10])).toBe(55);
    });

    it("test_recursion: Factorial", async () => {
      const code = `
def fact(n):
    if n < 2:
        return 1
    return n * fact(n - 1)
`;
      expect(await run(code, "fact", [5])).toBe(120);
    });

    it("test_shadowing: Local variables vs params", async () => {
      const code = `
def shadow(x):
    x = 100
    return x
`;
      expect(await run(code, "shadow", [10])).toBe(100);
    });
  });
});
