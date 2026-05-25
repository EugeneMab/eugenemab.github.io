import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getImportObject } from "./test-utils.ts";

describe("Step 11: Context Managers", () => {
  const run = async (code: string, funcName: string, args: number[] = []) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const wasm = compiler.compileWASM(ast);

    const instanceRef = { instance: null as any };
    const logs: any[] = [];
    const importObject = getImportObject(instanceRef, logs);

    const { instance } = await WebAssembly.instantiate(wasm, importObject);
    instanceRef.instance = instance;
    const func = instance.exports[funcName] as Function;
    return {
      result: func(...args),
      instance,
      logs,
    };
  };

  it("test_with_basic: Successful enter and exit", async () => {
    const code = `
def __enter__(mgr):
    print("enter")
    return 42

def __exit__(mgr, a, b, c):
    print("exit")

def test():
    with 100 as x:
        print(x)
    return 1
`;
    const { result, logs } = await run(code, "test");
    expect(result).toBe(1);
    expect(logs).toContain("enter");
    expect(logs).toContain(42);
    expect(logs).toContain("exit");
    // Check order
    expect(logs[0]).toBe("enter");
    expect(logs[1]).toBe(42);
    expect(logs[2]).toBe("exit");
  });

  it("test_with_cleanup: Ensuring __exit__ runs even on failure (early return)", async () => {
    const code = `
def __enter__(mgr):
    print("enter")
    return 1

def __exit__(mgr, a, b, c):
    print("exit")

def test():
    with 100:
        print("body")
        return 42
    return 0
`;
    const { result, logs } = await run(code, "test");
    expect(result).toBe(42);
    expect(logs).toContain("enter");
    expect(logs).toContain("body");
    expect(logs).toContain("exit");
    expect(logs[0]).toBe("enter");
    expect(logs[1]).toBe("body");
    expect(logs[2]).toBe("exit");
  });

  it("test_with_early_return: Ensuring cleanup runs on early return / abort inside with block", async () => {
    const code = `
def __enter__(mgr):
    print(mgr)
    return mgr

def __exit__(mgr, a, b, c):
    print(mgr + 10)

def test():
    with 1 as x:
        with 2 as y:
            print(3)
            return x + y
    return 0
`;
    const { result, logs } = await run(code, "test");
    expect(result).toBe(3);
    expect(logs[0]).toBe(1);
    expect(logs[1]).toBe(2);
    expect(logs[2]).toBe(3);
    // Exits in reverse order
    expect(logs[3]).toBe(12); // 2 + 10
    expect(logs[4]).toBe(11); // 1 + 10
  });

  it("test_with_member_access: Protocol via member access call", async () => {
    // This tests if the compiler handles x.__enter__() syntax
    // Even if it currently mangles to global __enter__(x)
    const code = `
def __enter__(mgr):
    print("enter")
    return mgr + 5

def __exit__(mgr, a, b, c):
    print("exit")

def test():
    # Explicitly call __enter__ to test MemberAccess + Call
    val = 10
    e = val.__enter__()
    print(e)
    val.__exit__(0, 0, 0)
    return 1
`;
    const { result, logs } = await run(code, "test");
    expect(result).toBe(1);
    expect(logs[0]).toBe("enter");
    expect(logs[1]).toBe(15);
    expect(logs[2]).toBe("exit");
  });
});
