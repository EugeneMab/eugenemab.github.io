// src/step17.vitest.test.ts
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

describe("Step 17: Basic Classes & Objects (Methods)", () => {
  it("should support String methods", async () => {
    const code = `
def main():
    s = "  hello world  "
    print(s.strip())
    print(s.upper())
    print(s.lower())
    print(s.find("world"))
    print("a,b,c".split(","))
    print(" ".join(["a", "b", "c"]))
    print("banana".replace("a", "o", 2))
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("hello world");
    expect(logs[1]).toBe("  HELLO WORLD  ");
    expect(logs[2]).toBe("  hello world  ");
    expect(logs[3]).toBe("8");
    expect(logs[4]).toEqual("['a', 'b', 'c']");
    expect(logs[5]).toBe("a b c");
    expect(logs[6]).toBe("bonona");
  });

  it("should support List methods", async () => {
    const code = `
def main():
    l = [3, 1, 2]
    l.append(4)
    print(l)
    l.extend([5, 6])
    print(l)
    l.insert(0, 0)
    print(l)
    l.remove(3)
    print(l)
    val = l.pop()
    print(val)
    print(l)
    l.sort()
    print(l)
    l.reverse()
    print(l)
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toEqual("[3, 1, 2, 4]");
    expect(logs[1]).toEqual("[3, 1, 2, 4, 5, 6]");
    expect(logs[2]).toEqual("[0, 3, 1, 2, 4, 5, 6]");
    expect(logs[3]).toEqual("[0, 1, 2, 4, 5, 6]");
    expect(logs[4]).toBe("6");
    expect(logs[5]).toEqual("[0, 1, 2, 4, 5]");
    expect(logs[6]).toEqual("[0, 1, 2, 4, 5]"); // Already sorted
    expect(logs[7]).toEqual("[5, 4, 2, 1, 0]");
  });

  it("should support split() without arguments", async () => {
    const code = `
def main():
    print("  a  b   c  ".split())
    print("".split())
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toEqual("['a', 'b', 'c']");
    expect(logs[1]).toEqual("[]");
  });
});
