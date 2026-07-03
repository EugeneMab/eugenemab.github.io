import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";

describe("Parser", () => {
  it("should parse a let statement", () => {
    const input = "let x = 42;";
    const tokens = new Lexer(input).tokenize();
    const program = new Parser(tokens, input).parse();

    expect(program.body[0].type).toBe("LetStatement");
    const letStmt = program.body[0] as any;
    expect(letStmt.name).toBe("x");
    expect(letStmt.isMutable).toBe(false);
    expect(letStmt.initializer.type).toBe("Literal");
    expect(letStmt.initializer.value).toBe(42);
  });

  it("should parse a mutable let statement", () => {
    const input = "let mut x = 0x2A;";
    const tokens = new Lexer(input).tokenize();
    const program = new Parser(tokens, input).parse();

    const letStmt = program.body[0] as any;
    expect(letStmt.name).toBe("x");
    expect(letStmt.isMutable).toBe(true);
    expect(letStmt.initializer.value).toBe(42);
  });

  it("should parse a binary expression", () => {
    const input = "let z = 1 + 2 * 3;";
    const tokens = new Lexer(input).tokenize();
    const program = new Parser(tokens, input).parse();

    const letStmt = program.body[0] as any;
    expect(letStmt.initializer.type).toBe("BinaryExpression");
    expect(letStmt.initializer.operator).toBe("+");
    expect(letStmt.initializer.right.operator).toBe("*");
  });

  it("should parse a println! macro invocation", () => {
    const input = 'println!("Hello", 42);';
    const tokens = new Lexer(input).tokenize();
    const program = new Parser(tokens, input).parse();

    expect(program.body[0].type).toBe("ExpressionStatement");
    const exprStmt = program.body[0] as any;
    expect(exprStmt.expression.type).toBe("MacroInvocation");
    expect(exprStmt.expression.name).toBe("println");
    expect(exprStmt.expression.args.length).toBe(2);
  });

  it("should parse a function declaration", () => {
    const input = "fn main() { let x = 1; }";
    const tokens = new Lexer(input).tokenize();
    const program = new Parser(tokens, input).parse();

    expect(program.body[0].type).toBe("FunctionDeclaration");
    const fnDecl = program.body[0] as any;
    expect(fnDecl.name).toBe("main");
    expect(fnDecl.body.body.length).toBe(1);
  });

  it("should parse boolean literals as i32 values", () => {
    const input = "let t = true; let f = false;";
    const tokens = new Lexer(input).tokenize();
    const program = new Parser(tokens, input).parse();

    const trueStmt = program.body[0] as any;
    const falseStmt = program.body[1] as any;
    expect(trueStmt.initializer.value).toBe(1);
    expect(falseStmt.initializer.value).toBe(0);
  });
});
