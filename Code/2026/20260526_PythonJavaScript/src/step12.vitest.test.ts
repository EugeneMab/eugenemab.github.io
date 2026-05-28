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

  it("should handle mixed BigInt and Number arithmetic", async () => {
    const code = `
def main():
    x = 12345678901234567890
    print(x + 1)
    print(x * 2)
    print(x - 12345678901234567890)
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["12345678901234567891", "24691357802469135780", "0"]);
  });

  it("should handle Python-style boolean operators", async () => {
    const code = `
def main():
    print([] or 1)
    print([1] or 2)
    print([] and 1)
    print([1] and 2)
    print(not [])
    print(not [1])
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["1", "[1]", "[]", "2", "true", "false"]);
  });

  it("should handle Unicode code points with chr() and ord()", async () => {
    const code = `
def main():
    # Emoji: Grinning Face (U+1F600)
    smile = chr(128512)
    print(smile)
    print(ord(smile))
`;
    const { logs } = await runPython(code);
    expect(logs).toEqual(["\u{1F600}", "128512"]);
  });
});
