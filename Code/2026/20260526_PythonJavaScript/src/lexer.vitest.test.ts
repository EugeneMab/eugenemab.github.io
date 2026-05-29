import { describe, it, expect } from "vitest";
import { Lexer, TokenType } from "./lexer.ts";

describe("Lexer Legacy Tests", () => {
  const cases = [
    {
      name: "Basic Function",
      code: "def main():\n    return 42",
      expected: [
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
      ],
    },
    {
      name: "Variables and Math",
      code: "def main():\n    x = 10\n    y = 20\n    return x + y",
      expected: [
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
        TokenType.IDENTIFIER,
        TokenType.EQUALS,
        TokenType.NUMBER,
        TokenType.NEWLINE,
        TokenType.RETURN,
        TokenType.IDENTIFIER,
        TokenType.PLUS,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
    {
      name: "Comments and Tabs",
      code: "# This is a comment\ndef main():\n\tx = 5 # comment\n\treturn x - 2",
      expected: [
        TokenType.NEWLINE,
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
        TokenType.MINUS,
        TokenType.NUMBER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
    {
      name: "Multiple Dedents",
      code: "def outer():\n    def inner():\n        return 1\n    return 2",
      expected: [
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.RETURN,
        TokenType.NUMBER,
        TokenType.NEWLINE,
        TokenType.DEDENT,
        TokenType.RETURN,
        TokenType.NUMBER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
  ];

  for (const c of cases) {
    it(`should pass case: ${c.name}`, () => {
      const lexer = new Lexer(c.code);
      const tokens = lexer.tokenize();
      const types = tokens.map((t) => t.type);
      expect(types).toEqual(c.expected);
    });
  }

  it("should throw on unexpected character error", () => {
    const lexer = new Lexer("@");
    expect(() => lexer.tokenize()).toThrow();
  });

  it("should throw error on reserved identifier __tmp", () => {
    const lexer = new Lexer("__tmp0 = 1");
    expect(() => lexer.tokenize()).toThrow(
      /User-defined identifiers starting with '__'/,
    );
  });
});
