// src/step21.vitest.test.ts
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

describe("Step 21: Multi-line Syntax & Continuation", () => {
  it("should support implicit line joining in parentheses", async () => {
    const code = `
def main():
    x = (1 +
         2 +
         3)
    return x
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(6);
  });

  it("should support implicit line joining in lists", async () => {
    const code = `
def main():
    items = [
        1,
        2,
        3
    ]
    return len(items)
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(3);
  });

  it("should support implicit line joining in dicts", async () => {
    const code = `
def main():
    d = {
        "a": 1,
        "b": 2
    }
    return d["a"] + d["b"]
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(3);
  });

  it("should support explicit line continuation with backslash", async () => {
    const code = `
def main():
    x = 1 + \\
        2 + \\
        3
    return x
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(6);
  });

  it("should support multi-line function calls", async () => {
    const code = `
def add(a, b, c):
    return a + b + c

def main():
    return add(
        1,
        2,
        3
    )
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(6);
  });
});
