// src/step22.vitest.test.ts
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

describe("Step 22: Extended Standard Library", () => {
  it("should support numeric helpers (bin, oct, round, divmod)", async () => {
    const code = `
def main():
    b = bin(10)
    o = oct(10)
    r = round(1.234, 1)
    q, rem = divmod(7, 3)
    return f"{b} {o} {r} {q} {rem}"
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe("0b1010 0o12 1.2 2 1");
  });

  it("should support string methods (startswith, endswith, count, is*)", async () => {
    const code = `
def main():
    s = "hello world"
    return s.startswith("he"), s.endswith("ld"), s.count("l"), "123".isdigit()
`;
    const { globals } = await runPython(code);
    const res = await globals.main();
    expect(Array.from(res)).toEqual([true, true, 3, true]);
  });

  it("should support dict methods (get, keys, values, items, update)", async () => {
    const code = `
def main():
    d = {"a": 1}
    val = d.get("a")
    missing = d.get("b", 0)
    d.update({"b": 2})
    return val, missing, d["b"], len(list(d.keys()))
`;
    const { globals } = await runPython(code);
    const res = await globals.main();
    expect(Array.from(res)).toEqual([1, 0, 2, 2]);
  });

  it("should support basic format() built-in and method", async () => {
    const code = `
def main():
    s1 = "{}".format(42)
    s2 = "{:.2f}".format(3.14159)
    return s1 + " " + s2
`;
    const { globals } = await runPython(code);
    expect(await globals.main()).toBe("42 3.14");
  });

  it("should support clear() and copy()", async () => {
    const code = `
def main():
    d = {"a": 1}
    d2 = d.copy()
    d.clear()
    return len(d), d2["a"]
`;
    const { globals } = await runPython(code);
    const res = await globals.main();
    expect(Array.from(res)).toEqual([0, 1]);
  });
});
