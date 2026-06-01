// src/step18.vitest.test.ts
import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
import { getJSRuntime, runJS } from "./test-utils.js";

async function runPython(code: string) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new Compiler();
  const jsCode = compiler.compileJS(ast);

  const logs: any[] = [];
  const runtime = getJSRuntime(logs);
  const globals = await runJS(jsCode, runtime);
  return { globals, logs, jsCode };
}

describe("Step 18: Functional Programming", () => {
  it("should support lambda expressions", async () => {
    const code = `
def main():
    f = lambda x: x * 2
    return f(10)
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(20);
  });

  it("should support lambdas with multiple arguments and defaults", async () => {
    const code = `
def main():
    f = lambda x, y=5: x + y
    return f(10) + f(10, 20)
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(45);
  });

  it("should support map built-in", async () => {
    const code = `
def main():
    nums = [1, 2, 3]
    squared = map(lambda x: x * x, nums)
    return squared
`;
    const { globals } = await runPython(code);
    const result = await globals.main();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([1, 4, 9]);
  });

  it("should support filter built-in", async () => {
    const code = `
def main():
    nums = [1, 2, 3, 4, 5, 6]
    evens = filter(lambda x: x % 2 == 0, nums)
    return evens
`;
    const { globals } = await runPython(code);
    const result = await globals.main();
    expect(result).toEqual([2, 4, 6]);
  });

  it("should support reduce built-in", async () => {
    const code = `
def main():
    nums = [1, 2, 3, 4]
    sum_all = reduce(lambda x, y: x + y, nums)
    return sum_all
`;
    const { globals } = await runPython(code);
    const result = await globals.main();
    expect(result).toBe(10);
  });

  it("should handle nested lambdas and closures", async () => {
    const code = `
def main():
    def make_adder(n):
        return lambda x: x + n
    
    add5 = make_adder(5)
    return add5(10)
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(15);
  });

  it("should support lambda with keyword arguments", async () => {
    const code = `
def main():
    f = lambda x, y=1: x / y
    return f(y=2, x=10)
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(5);
  });
});
