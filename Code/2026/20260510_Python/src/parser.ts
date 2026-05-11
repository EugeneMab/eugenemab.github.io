// src/parser.ts
import { TokenType, Token } from "./lexer.js";

export type ASTNode =
  | ProgramNode
  | FunctionDefNode
  | AssignmentNode
  | BinaryExpressionNode
  | LiteralNode
  | IdentifierNode
  | ReturnNode;

export interface ProgramNode {
  type: "Program";
  body: ASTNode[];
}

export interface FunctionDefNode {
  type: "FunctionDef";
  name: string;
  body: ASTNode[];
}

export interface AssignmentNode {
  type: "Assignment";
  target: string;
  value: ASTNode;
}

export interface BinaryExpressionNode {
  type: "BinaryExpression";
  left: ASTNode;
  operator: string;
  right: ASTNode;
}

export interface LiteralNode {
  type: "Literal";
  value: number;
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
}

export interface ReturnNode {
  type: "Return";
  value: ASTNode;
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ProgramNode {
    const body: ASTNode[] = [];
    while (!this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    return { type: "Program", body };
  }

  private parseStatement(): ASTNode | null {
    if (this.match(TokenType.DEF)) return this.parseFunctionDef();
    if (this.match(TokenType.RETURN)) return this.parseReturn();
    if (
      this.peek().type === TokenType.IDENTIFIER &&
      this.peekNext()?.type === TokenType.EQUALS
    ) {
      return this.parseAssignment();
    }

    // Skip stray newlines
    if (this.match(TokenType.NEWLINE)) return null;

    const token = this.peek();
    throw new Error(
      `Unexpected token: ${token.type} at line ${token.line}, col ${token.col}`,
    );
  }

  private parseFunctionDef(): FunctionDefNode {
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect function name",
    ).value;
    this.consume(TokenType.LPAREN, "Expect '(' after function name");
    this.consume(TokenType.RPAREN, "Expect ')' after '('");
    this.consume(TokenType.COLON, "Expect ':' after parameters");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(
      TokenType.INDENT,
      "Expect indentation after function definition",
    );

    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after function body");

    return { type: "FunctionDef", name, body };
  }

  private parseAssignment(): AssignmentNode {
    const target = this.consume(
      TokenType.IDENTIFIER,
      "Expect variable name",
    ).value;
    this.consume(TokenType.EQUALS, "Expect '=' after variable name");
    const value = this.parseExpression();
    this.consume(TokenType.NEWLINE, "Expect newline after assignment");
    return { type: "Assignment", target, value };
  }

  private parseReturn(): ReturnNode {
    const value = this.parseExpression();
    // Return is often the last statement, might be followed by NEWLINE then DEDENT
    if (this.check(TokenType.NEWLINE)) this.advance();
    return { type: "Return", value };
  }

  private parseExpression(): ASTNode {
    return this.parseAddition();
  }

  private parseAddition(): ASTNode {
    let left = this.parsePrimary();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().type === TokenType.PLUS ? "+" : "-";
      const right = this.parsePrimary();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }
  private parsePrimary(): ASTNode {
    if (this.match(TokenType.NUMBER)) {
      return { type: "Literal", value: parseInt(this.previous().value) };
    }
    if (this.match(TokenType.IDENTIFIER)) {
      return { type: "Identifier", name: this.previous().value };
    }
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expect ')' after expression");
      return expr;
    }
    const token = this.peek();
    throw new Error(
      `Expect expression at line ${token.line}, col ${token.col}`,
    );
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private peekNext(): Token | null {
    if (this.pos + 1 >= this.tokens.length) return null;
    return this.tokens[this.pos + 1];
  }

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(
      `${message} at line ${token.line}, col ${token.col}, found ${token.type}`,
    );
  }
}
