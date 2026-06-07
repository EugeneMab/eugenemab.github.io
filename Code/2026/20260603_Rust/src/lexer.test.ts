import { describe, it, expect } from "vitest";
import { Lexer, TokenType } from "./lexer.js";

describe("Lexer", () => {
  it("should tokenize keywords", () => {
    const input = "fn let mut if else loop struct impl panic true false";
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const expectedTypes = [
      TokenType.FN,
      TokenType.LET,
      TokenType.MUT,
      TokenType.IF,
      TokenType.ELSE,
      TokenType.LOOP,
      TokenType.STRUCT,
      TokenType.IMPL,
      TokenType.PANIC,
      TokenType.TRUE,
      TokenType.FALSE,
      TokenType.EOF,
    ];

    expect(tokens.map((t) => t.type)).toEqual(expectedTypes);
  });

  it("should tokenize literals", () => {
    const input = '42 0x2A "hello"';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.INTEGER);
    expect(tokens[0].value).toBe("42");

    expect(tokens[1].type).toBe(TokenType.HEX);
    expect(tokens[1].value).toBe("0x2A");

    expect(tokens[2].type).toBe(TokenType.STRING);
    expect(tokens[2].value).toBe("hello");
  });

  it("should tokenize symbols", () => {
    const input = "() {} [] , . : ; -> + - * / % & | ^ << >>";
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    const expectedTypes = [
      TokenType.LPAREN,
      TokenType.RPAREN,
      TokenType.LBRACE,
      TokenType.RBRACE,
      TokenType.LBRACKET,
      TokenType.RBRACKET,
      TokenType.COMMA,
      TokenType.DOT,
      TokenType.COLON,
      TokenType.SEMICOLON,
      TokenType.ARROW,
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.STAR,
      TokenType.SLASH,
      TokenType.PERCENT,
      TokenType.AMPERSAND,
      TokenType.PIPE,
      TokenType.CARET,
      TokenType.LSHIFT,
      TokenType.RSHIFT,
      TokenType.EOF,
    ];

    expect(tokens.map((t) => t.type)).toEqual(expectedTypes);
  });
});
