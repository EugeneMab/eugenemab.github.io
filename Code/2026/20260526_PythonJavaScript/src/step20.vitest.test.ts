// src/step20.vitest.test.ts
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

describe("Step 20: Expressions & Literals", () => {
  it("should support if-expressions (ternary)", async () => {
    const code = `
def test(x):
    return "yes" if x > 5 else "no"

def main():
    return test(10) + " " + test(3)
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe("yes no");
  });

  it("should support hex numbers", async () => {
    const code = `
def main():
    return 0xFF + 0x01
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(256);
  });

  it("should support hex() and int(s, 16)", async () => {
    const code = `
def main():
    h = hex(255)
    i = int("FF", 16)
    return h + " " + str(i)
`;
    // str() is not explicitly in BUILTINS but string concatenation handles it if str is preloaded or handled.
    // Actually str is handled in runtime via __format usually but not as a global 'str' function yet.
    // Let's check if 'str' is in BUILTINS.
    const { globals } = await runPython(code);
    // Wait, str() might fail if not defined.
    // I should add str() to BUILTINS or use another way.
    // For now I'll use format or just check h and i.
    expect(await globals.main()).toBe("0xff 255");
  });

  it("should support triple-quoted multi-line strings", async () => {
    const code = `
def main():
    s = """line1
line2
line3"""
    return s
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe("line1\nline2\nline3");
  });

  it("should support single-line comments and docstrings", async () => {
    const code = `
# This is a comment
def main():
    """Docstring"""
    x = 1 # Inline comment
    return x
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(1);
  });
});
