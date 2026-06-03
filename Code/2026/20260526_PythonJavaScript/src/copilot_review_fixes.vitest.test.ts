// src/copilot_review_fixes.vitest.test.ts
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

describe("Copilot Review Fixes", () => {
  it("should format negative hex, bin, and oct correctly", async () => {
    const code = `
def main():
    return hex(-255), bin(-10), oct(-10)
`;
    const { globals } = await runPython(code);
    const res = await globals.main();
    expect(Array.from(res)).toEqual(["-0xff", "-0b1010", "-0o12"]);
  });

  it("should handle signed hex strings in int()", async () => {
    const code = `
def main():
    return int("-FF", 16), int("+FF", 16), int("-0xFF", 16)
`;
    const { globals } = await runPython(code);
    const res = await globals.main();
    expect(Array.from(res)).toEqual([-255, 255, -255]);
  });

  it("should handle empty string in count() correctly", async () => {
    const code = `
def main():
    return "abc".count("")
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe(4);
  });

  it("should handle stray closing delimiters in lexer safely", () => {
    const code = ")]}";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    // Should not throw and parenLevel should stay 0
    expect(tokens.map((t) => t.type)).toContain("RPAREN");
  });
});
