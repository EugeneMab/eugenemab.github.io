import { describe, it, expect } from "vitest";
import { Lexer, TokenType } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
import { getJSRuntime, runJS } from "./test-utils.ts";

describe("Lexer", () => {
  it("should tokenize basic function", () => {
    const code = "def main():\n    return 42";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.DEF,
      TokenType.IDENTIFIER,
      TokenType.LPAREN,
      TokenType.RPAREN,
      TokenType.COLON,
      TokenType.NEWLINE,
      TokenType.INDENT,
      TokenType.RETURN,
      TokenType.NUMBER,
      TokenType.DEDENT,
      TokenType.EOF,
    ]);
  });

  it("should handle variables and math", () => {
    const code = "def main():\n    x = 10\n    return x + 5";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    expect(tokens.map((t) => t.type)).toEqual([
      TokenType.DEF,
      TokenType.IDENTIFIER,
      TokenType.LPAREN,
      TokenType.RPAREN,
      TokenType.COLON,
      TokenType.NEWLINE,
      TokenType.INDENT,
      TokenType.IDENTIFIER,
      TokenType.EQUALS,
      TokenType.NUMBER,
      TokenType.NEWLINE,
      TokenType.RETURN,
      TokenType.IDENTIFIER,
      TokenType.PLUS,
      TokenType.NUMBER,
      TokenType.DEDENT,
      TokenType.EOF,
    ]);
  });

  it("should handle comments and blank lines", () => {
    const code = "# comment\n\ndef main():\n    # inside comment\n    return 1";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    // Python lexer usually skips blank lines and comments, but may produce NEWLINE
    expect(tokens.map((t) => t.type)).toContain(TokenType.DEF);
    expect(tokens.map((t) => t.type)).toContain(TokenType.RETURN);
  });

  it("should handle nested indentation", () => {
    const code = "def f():\n    if 1:\n        return 1\n    return 0";
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    expect(tokens.map((t) => t.type)).toContain(TokenType.INDENT);
    const indents = tokens.filter((t) => t.type === TokenType.INDENT).length;
    const dedents = tokens.filter((t) => t.type === TokenType.DEDENT).length;
    expect(indents).toBe(dedents);
  });

  it("should throw on unexpected character", () => {
    const lexer = new Lexer("@");
    expect(() => lexer.tokenize()).toThrow();
  });

  it("should throw on indentation error", () => {
    const code = "def f():\n    return 1\n  return 2"; // 4 spaces then 2 spaces
    const lexer = new Lexer(code);
    expect(() => lexer.tokenize()).toThrow();
  });
});

describe("Parser", () => {
  it("should parse basic return", () => {
    const code = "def main():\n    return 42";
    const lexer = new Lexer(code);
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    expect(ast.type).toBe("Program");
    expect(ast.body[0].type).toBe("FunctionDef");
  });

  it("should parse multiple assignments and math", () => {
    const code = "def main():\n    x = 1\n    y = 2\n    return x + y";
    const lexer = new Lexer(code);
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    const body = (ast.body[0] as any).body;
    expect(body.length).toBe(3);
    expect(body[0].type).toBe("Assignment");
    expect(body[1].type).toBe("Assignment");
    expect(body[2].type).toBe("Return");
  });

  it("should handle parentheses", () => {
    const code2 = "def main():\n    return (5 - 3) + 1";
    const lexer = new Lexer(code2);
    const parser = new Parser(lexer.tokenize());
    const ast = parser.parse();
    expect(ast.type).toBe("Program");
  });

  it("should throw on invalid syntax", () => {
    const errorCases = [
      "def ():",
      "def main()",
      "def main():\nreturn 1", // Missing indent
      "return +",
    ];
    errorCases.forEach((code) => {
      const lexer = new Lexer(code);
      const parser = new Parser(lexer.tokenize());
      expect(() => parser.parse()).toThrow();
    });
  });
});

describe("Compiler", () => {
  it("should compile to JS", () => {
    const code = "def main():\n    return 42";
    const lexer = new Lexer(code);
    const parser = new Parser(lexer.tokenize());
    const compiler = new Compiler();
    const js = compiler.compileJS(parser.parse());
    expect(js).toContain("async function main()");
    expect(js).toContain("return 42");
  });

  it("should compile subtraction and multiple locals", () => {
    const code = "def main():\n    a = 100\n    b = 30\n    return a - b";
    const lexer = new Lexer(code);
    const parser = new Parser(lexer.tokenize());
    const compiler = new Compiler();
    const js = compiler.compileJS(parser.parse());
    expect(js).toContain("a = 100");
    expect(js).toContain("b = 30");
    expect(js).toContain("return (a - b)");
  });

  it("should execute JS and return result", async () => {
    const cases = [
      { code: "def main():\n    return 42", expected: 42 },
      {
        code: "def main():\n    x = 10\n    y = 5\n    return x - y",
        expected: 5,
      },
      { code: "def main():\n    return (10 + 2) - 3", expected: 9 },
      { code: "def main():\n    return 2 * 3 + 4", expected: 10 },
      { code: "def main():\n    return 2 * (3 + 4)", expected: 14 },
      { code: "def main():\n    return 1 + -5", expected: -4 },
      { code: "def main():\n    return 10 / 2", expected: 5 },
      { code: "def main():\n    return (10 - 2) * -3", expected: -24 },
      {
        code: "def main():\n    if 10 > 5:\n        return 1\n    else:\n        return 0",
        expected: 1,
      },
      {
        code: "def main():\n    x = 10\n    if x == 5:\n        return 1\n    elif x == 10:\n        return 2\n    else:\n        return 3",
        expected: 2,
      },
      {
        code: "def main():\n    if True and False:\n        return 1\n    else:\n        return 0",
        expected: 0,
      },
      {
        code: "def main():\n    if True or False:\n        return 1\n    else:\n        return 0",
        expected: 1,
      },
      {
        code: "def main():\n    if not False:\n        return 42\n    return 0",
        expected: 42,
      },
    ];
    for (const c of cases) {
      const lexer = new Lexer(c.code);
      const parser = new Parser(lexer.tokenize());
      const compiler = new Compiler();
      const jsCode = compiler.compileJS(parser.parse());
      const runtime = getJSRuntime();
      const result = await runJS(jsCode, runtime);
      expect(result).toBe(c.expected);
    }
  });
});
