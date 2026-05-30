// src/step16.vitest.test.ts
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

  const logs: string[] = [];
  const runtime = getJSRuntime(logs);
  const globals = await runJS(jsCode, runtime);
  return { result: globals.__result__, logs };
}

describe("Step 16: Advanced Scoping & Assignment", () => {
  it("should support Multiple Assignment (Unpacking)", async () => {
    const code = `
def main():
    x, y = (1, 2)
    print(x)
    print(y)
    a, b, c = [4, 5, 6]
    print(a)
    print(b)
    print(c)
    return x + y + a + b + c
`;
    const { result, logs } = await runPython(code);
    expect(logs).toEqual(["1", "2", "4", "5", "6"]);
    expect(result).toBe(18);
  });

  it("should support Star Unpacking", async () => {
    const code = `
def main():
    x, *y, z = [1, 2, 3, 4, 5]
    print(x)
    print(y)
    print(z)
    return x + z
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toBe("1");
    expect(logs[1]).toBe("[2, 3, 4]");
    expect(logs[2]).toBe("5");
    expect(result).toBe(6);
  });

  it("should support Global keyword", async () => {
    const code = `
count = 0
def increment():
    global count
    count = count + 1

def main():
    increment()
    increment()
    print(count)
    return count
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toBe("2");
    expect(result).toBe(2);
  });

  it("should support Nonlocal keyword", async () => {
    const code = `
def main():
    x = 10
    def inner():
        nonlocal x
        x = 20
    inner()
    print(x)
    return x
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toBe("20");
    expect(result).toBe(20);
  });

  it("should support Default Arguments", async () => {
    const code = `
def greet(name, msg="Hello"):
    print(msg)
    print(name)

def main():
    greet("Alice")
    greet("Bob", "Hi")
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["Hello", "Alice", "Hi", "Bob"]);
  });

  it("should support Keyword Arguments", async () => {
    const code = `
def func(a, b, c=10):
    print(a)
    print(b)
    print(c)

def main():
    func(1, c=3, b=2)
    func(b=5, a=4)
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["1", "2", "3", "4", "5", "10"]);
  });
});
