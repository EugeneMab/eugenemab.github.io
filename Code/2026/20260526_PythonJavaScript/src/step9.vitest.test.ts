import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";
import { getJSRuntime, runJS } from "./test-utils.ts";

describe("Step 9: Comprehensions (Parser)", () => {
  it("should parse list comprehension", () => {
    const code = "[x * 2 for x in my_list]";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const expr = ast.body[0] as any;
    expect(expr.type).toBe("ListComprehension");
    expect(expr.item).toBe("x");
    expect(expr.expression.type).toBe("BinaryExpression");
    expect(expr.iterable.type).toBe("Identifier");
    expect(expr.iterable.name).toBe("my_list");
    expect(expr.condition).toBeNull();
  });

  it("should parse list comprehension with if", () => {
    const code = "[x for x in range(10) if x > 5]";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const expr = ast.body[0] as any;
    expect(expr.type).toBe("ListComprehension");
    expect(expr.condition).not.toBeNull();
    expect(expr.condition.type).toBe("BinaryExpression");
    expect(expr.condition.operator).toBe(">");
  });

  it("should parse dict comprehension", () => {
    const code = "{x: x*x for x in [1, 2, 3]}";
    const lexer = new Lexer(code + "\n");
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const expr = ast.body[0] as any;
    expect(expr.type).toBe("DictComprehension");
    expect(expr.key.type).toBe("Identifier");
    expect(expr.value.type).toBe("BinaryExpression");
    expect(expr.item).toBe("x");
    expect(expr.iterable.type).toBe("List");
  });

  describe("Execution (JS Runtime)", () => {
    const run = async (code: string) => {
      const lexer = new Lexer(code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      const compiler = new Compiler();
      const jsCode = compiler.compileJS(ast);

      const runtime = getJSRuntime();
      return await runJS(jsCode, runtime);
    };

    it("test_list_comp: should transform list elements", async () => {
      const code =
        "def main():\n    x = [1, 2, 3]\n    res = [i * 10 for i in x]\n    return res";
      const result = await run(code);
      expect(result).toEqual([10, 20, 30]);
    });

    it("test_list_comp_if: should filter list elements", async () => {
      const code =
        "def main():\n    x = [1, 2, 3, 4, 5, 6]\n    res = [i for i in x if i > 3]\n    return res";
      const result = await run(code);
      expect(result).toEqual([4, 5, 6]);
    });

    it("test_dict_comp: should produce key-value pairs", async () => {
      const code =
        "def main():\n    x = [1, 2]\n    res = {i: i * i for i in x}\n    return res";
      const result = await run(code);
      expect(result).toEqual({ 1: 1, 2: 4 });
    });
  });
});
