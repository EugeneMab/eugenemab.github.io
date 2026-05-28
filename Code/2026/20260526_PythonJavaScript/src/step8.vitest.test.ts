import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getJSRuntime, runJS } from "./test-utils.ts";

describe("Step 8: Slicing & Advanced Indexing (Parser)", () => {
  it("should parse list literals", () => {
    const code = "x = [1, 2, 3]";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const assignment = ast.body[0] as any;
    expect(assignment.type).toBe("Assignment");
    expect(assignment.value.type).toBe("List");
    expect(assignment.value.elements.length).toBe(3);
  });

  it("should parse indexing", () => {
    const code = "y = x[0]";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const assignment = ast.body[0] as any;
    expect(assignment.value.type).toBe("Subscript");
    expect(assignment.value.index.type).toBe("Literal");
    expect(assignment.value.index.value).toBe(0);
  });

  it("should parse basic slicing [start:stop]", () => {
    const code = "y = x[1:3]";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const assignment = ast.body[0] as any;
    expect(assignment.value.type).toBe("Subscript");
    expect(assignment.value.index.type).toBe("Slice");
    expect(assignment.value.index.start.value).toBe(1);
    expect(assignment.value.index.stop.value).toBe(3);
    expect(assignment.value.index.step).toBeNull();
  });

  it("should parse slicing with step [start:stop:step]", () => {
    const code = "y = x[0:10:2]";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const assignment = ast.body[0] as any;
    expect(assignment.value.index.type).toBe("Slice");
    expect(assignment.value.index.start.value).toBe(0);
    expect(assignment.value.index.stop.value).toBe(10);
    expect(assignment.value.index.step.value).toBe(2);
  });

  it("should parse slicing with omitted parts [:stop], [start:], [::step]", () => {
    const cases = [
      {
        code: "x[:5]",
        validate: (idx: any) =>
          idx.start === null && idx.stop.value === 5 && idx.step === null,
      },
      {
        code: "x[1:]",
        validate: (idx: any) =>
          idx.start.value === 1 && idx.stop === null && idx.step === null,
      },
      {
        code: "x[::2]",
        validate: (idx: any) =>
          idx.start === null && idx.stop === null && idx.step.value === 2,
      },
      {
        code: "x[:]",
        validate: (idx: any) =>
          idx.start === null && idx.stop === null && idx.step === null,
      },
    ];

    for (const c of cases) {
      const lexer = new Lexer(c.code + "\n");
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const expr = ast.body[0] as any;
      expect(expr.type).toBe("Subscript");
      expect(expr.index.type).toBe("Slice");
      expect(c.validate(expr.index)).toBe(true);
    }
  });

  it("should parse string literals", () => {
    const code = 's = "hello"';
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const assignment = ast.body[0] as any;
    expect(assignment.value.type).toBe("Literal");
    expect(assignment.value.value).toBe("hello");
  });

  describe("Execution (JS Runtime)", () => {
    const run = async (code: string, funcName: string, args: any[] = []) => {
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();
      const jsCode = compiler.compileJS(ast);

      const runtime = getJSRuntime();
      const globals = await runJS(jsCode, runtime);
      const func = globals[funcName];
      const result = await func(...args);
      return { result };
    };

    it("test_list_creation: should return the list", async () => {
      const code = "def main():\n    x = [10, 20, 30]\n    return x";
      const { result } = await run(code, "main");
      expect(result).toEqual([10, 20, 30]);
    });

    it("test_indexing_basic: should return element at index", async () => {
      const code = "def main():\n    x = [10, 20, 30]\n    return x[1]";
      const { result } = await run(code, "main");
      expect(result).toBe(20);
    });

    it("test_negative_indexing: should return element from the end", async () => {
      const code = "def main():\n    x = [10, 20, 30]\n    return x[-1]";
      const { result } = await run(code, "main");
      expect(result).toBe(30);
    });

    it("test_list_slicing_basic: [1:3]", async () => {
      const code =
        "def main():\n    x = [10, 20, 30, 40, 50]\n    s = x[1:3]\n    return s";
      const { result } = await run(code, "main");
      expect(result).toEqual([20, 30]);
    });

    it("test_list_slicing_step: [::2]", async () => {
      const code =
        "def main():\n    x = [10, 20, 30, 40, 50]\n    s = x[::2]\n    return s";
      const { result } = await run(code, "main");
      expect(result).toEqual([10, 30, 50]);
    });

    it("test_string_slicing: slicing characters", async () => {
      const code =
        'def main():\n    s = "hello"\n    sub = s[1:4]\n    return sub';
      const { result } = await run(code, "main");
      expect(result).toBe("ell");
    });
  });
});
