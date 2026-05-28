import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getJSRuntime, runJS } from "./test-utils.ts";

async function runPython(code: string) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new Compiler();
  const jsCode = compiler.compileJS(ast);

  const logs: any[] = [];
  const runtime = getJSRuntime(logs);
  await runJS(jsCode, runtime);

  return { logs };
}
describe("Step 12: Atomic Types & Casting", () => {
  it("should handle int() and float() correctly", async () => {
    const code = `
def main():
    print(int("42"))
    print(int(3.9))
    print(float("3.14"))
    print(float(10))
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["42", "3", "3.14", "10"]);
  });

  it("should handle chr() and ord() correctly", async () => {
    const code = `
def main():
    print(chr(65))
    print(ord("A"))
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["A", "65"]);
  });

  it("should handle raw strings correctly", async () => {
    const code = `
def main():
    s1 = "a\\nb"
    s2 = r"a\\nb"
    print(len(s1))
    print(len(s2))
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["3", "4"]);
  });

  it("should handle bool() and truthiness correctly", async () => {
    const code = `
def main():
    print(bool(1))
    print(bool(0))
    print(bool([]))
    print(bool([1]))
    if []:
        print("truthy")
    else:
        print("falsy")
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["true", "false", "false", "true", "falsy"]);
  });

  it("should handle large numbers with BigInt", async () => {
    const code = `
def main():
    x = 12345678901234567890
    print(x)
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["12345678901234567890"]);
  });
});
