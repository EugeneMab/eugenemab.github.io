// src/step13.vitest.test.ts
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

describe("Step 13: Core Collection Types", () => {
  it("should support Tuples", async () => {
    const code = `
def main():
    t1 = (1, 2, 3)
    t2 = (4,)
    t3 = ()
    print(t1)
    print(t2)
    print(t3)
    return len(t1)
`;
    const { result, logs } = await runPython(code);
    expect(logs).toContain("(1, 2, 3)");
    expect(logs).toContain("(4,)");
    expect(logs).toContain("()");
    expect(result).toBe(3);
  });

  it("should support Sets", async () => {
    const code = `
def main():
    s1 = {1, 2, 2, 3}
    print(s1)
    return len(s1)
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toContain("set([1, 2, 3])");
    expect(result).toBe(3);
  });

  it("should support Dict literals", async () => {
    const code = `
def main():
    d1 = {"a": 1, "b": 2}
    print(d1)
    return d1["a"]
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toBe('{"a": 1, "b": 2}');
    expect(result).toBe(1);
  });

  it("should support Bytes literals", async () => {
    const code = `
def main():
    b1 = b"abc"
    print(b1)
    return len(b1)
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toBe("b'\\x61\\x62\\x63'");
    expect(result).toBe(3);
  });

  it("should support Set Comprehensions", async () => {
    const code = `
def main():
    s1 = {x * x for x in [1, 2, 3, 2]}
    print(s1)
    return len(s1)
`;
    const { result, logs } = await runPython(code);
    expect(logs[0]).toContain("1");
    expect(logs[0]).toContain("4");
    expect(logs[0]).toContain("9");
    expect(result).toBe(3);
  });
});
