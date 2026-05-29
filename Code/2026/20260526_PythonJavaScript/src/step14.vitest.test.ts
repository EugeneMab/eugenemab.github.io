// src/step14.vitest.test.ts
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

describe("Step 14: Foundational Operators", () => {
  it("should support Arithmetic operators: //, %, **", async () => {
    const code = `
def main():
    print(10 // 3)
    print(10 % 3)
    print(2 ** 3)
    print(-10 // 3)
    print(-10 % 3)
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("3");
    expect(logs[1]).toBe("1");
    expect(logs[2]).toBe("8");
    expect(logs[3]).toBe("-4"); // Python style floor division
    expect(logs[4]).toBe("2"); // Python style modulo
  });

  it("should support Bitwise operators: &, |, ^, ~, <<, >>", async () => {
    const code = `
def main():
    print(5 & 3)
    print(5 | 3)
    print(5 ^ 3)
    print(~5)
    print(1 << 3)
    print(16 >> 2)
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("1");
    expect(logs[1]).toBe("7");
    expect(logs[2]).toBe("6");
    expect(logs[3]).toBe("-6");
    expect(logs[4]).toBe("8");
    expect(logs[5]).toBe("4");
  });

  it("should support Membership operators: in, not in", async () => {
    const code = `
def main():
    l = [1, 2, 3]
    s = {4, 5, 6}
    d = {"a": 1, "b": 2}
    print(1 in l)
    print(4 in s)
    print("a" in d)
    print(10 not in l)
    print(10 not in s)
    print("z" not in d)
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("true");
    expect(logs[1]).toBe("true");
    expect(logs[2]).toBe("true");
    expect(logs[3]).toBe("true");
    expect(logs[4]).toBe("true");
    expect(logs[5]).toBe("true");
  });

  it("should handle operator precedence correctly", async () => {
    const code = `
def main():
    # ** has higher precedence than unary -
    print(-2 ** 2) # Should be -(2**2) = -4
    # ** is right-associative
    print(2 ** 3 ** 2) # Should be 2**(3**2) = 2**9 = 512
    # Shifts have lower precedence than +
    print(1 << 2 + 1) # Should be 1 << (2 + 1) = 8
    # Bitwise AND has higher precedence than OR
    print(1 | 2 & 2) # Should be 1 | (2 & 2) = 1 | 2 = 3
    return 0
`;
    const { logs } = await runPython(code);
    expect(logs[0]).toBe("-4");
    expect(logs[1]).toBe("512");
    expect(logs[2]).toBe("8");
    expect(logs[3]).toBe("3");
  });
});
