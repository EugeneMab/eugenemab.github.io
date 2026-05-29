// src/step15.vitest.test.ts
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

describe("Step 15: Global Built-in Functions", () => {
  it("should support aggregation: sum, any, all", async () => {
    const code = `
def main():
    print(sum([1, 2, 3]))
    print(sum([1, 2, 3], 10))
    print(any([0, False, ""]))
    print(any([0, True, ""]))
    print(all([1, True, "abc"]))
    print(all([1, False, "abc"]))
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("6");
    expect(logs[1]).toBe("16");
    expect(logs[2]).toBe("false");
    expect(logs[3]).toBe("true");
    expect(logs[4]).toBe("true");
    expect(logs[5]).toBe("false");
  });

  it("should support aggregation: min, max", async () => {
    const code = `
def main():
    print(min(1, 2, 3))
    print(min([4, 5, 6]))
    print(max(1, 2, 3))
    print(max([4, 5, 6]))
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("1");
    expect(logs[1]).toBe("4");
    expect(logs[2]).toBe("3");
    expect(logs[3]).toBe("6");
  });

  it("should support iteration helpers: enumerate, zip", async () => {
    const code = `
def main():
    l = ["a", "b"]
    for i, x in enumerate(l):
        print(i)
        print(x)
    
    l1 = [1, 2]
    l2 = [3, 4]
    for x, y in zip(l1, l2):
        print(x)
        print(y)
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("0");
    expect(logs[1]).toBe("a");
    expect(logs[2]).toBe("1");
    expect(logs[3]).toBe("b");
    expect(logs[4]).toBe("1");
    expect(logs[5]).toBe("3");
    expect(logs[6]).toBe("2");
    expect(logs[7]).toBe("4");
  });

  it("should support iteration helpers: reversed, sorted", async () => {
    // Wait, sorted(iterable, key, reverse)
    // My implementation of sorted is (iterable, key, reverse)
    const code2 = `
def main():
    l = [1, 2, 3]
    print(reversed(l))
    print(sorted([3, 1, 2]))
    # print(sorted([3, 1, 2], None, True))
    return 0
`;
    const { logs } = await runPython(code2);
    expect(logs[0]).toBe("[3, 2, 1]");
    expect(logs[1]).toBe("[1, 2, 3]");
  });

  it("should support type checkers: type, isinstance, callable", async () => {
    const code = `
def main():
    print(type(1))
    print(type("abc"))
    print(type([1, 2]))
    print(isinstance(1, "number"))
    print(isinstance([1], "list"))
    print(callable(main))
    print(callable(1))
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("number");
    expect(logs[1]).toBe("string");
    expect(logs[2]).toBe("list");
    expect(logs[3]).toBe("true");
    expect(logs[4]).toBe("true");
    expect(logs[5]).toBe("true");
    expect(logs[6]).toBe("false");
  });
});
