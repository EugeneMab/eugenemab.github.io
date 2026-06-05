import { Token, TokenType } from "./lexer.js";

export type ASTNode = Program | Statement | Expression;

export interface Program {
  type: "Program";
  body: Statement[];
}

export type Statement =
  | LetStatement
  | ExpressionStatement
  | BlockStatement
  | FunctionDeclaration;

export interface LetStatement {
  type: "LetStatement";
  name: string;
  isMutable: boolean;
  initializer: Expression;
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface BlockStatement {
  type: "BlockStatement";
  body: Statement[];
}

export interface FunctionDeclaration {
  type: "FunctionDeclaration";
  name: string;
  params: string[]; // Simple for now
  body: BlockStatement;
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | Literal
  | Identifier
  | CallExpression
  | MacroInvocation;

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: string;
  argument: Expression;
}

export interface Literal {
  type: "Literal";
  value: string | number;
  rawType: "integer" | "hex" | "string";
}

export interface Identifier {
  type: "Identifier";
  name: string;
}

export interface CallExpression {
  type: "CallExpression";
  callee: string;
  args: Expression[];
}

export interface MacroInvocation {
  type: "MacroInvocation";
  name: string; // e.g., "print"
  args: Expression[];
}

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
    }
    return { type: "Program", body };
  }

  private parseStatement(): Statement {
    if (this.match(TokenType.LET)) return this.parseLetStatement();
    if (this.match(TokenType.FN)) return this.parseFunctionDeclaration();
    if (this.peek().type === TokenType.LBRACE)
      return this.parseBlockStatement();
    return this.parseExpressionStatement();
  }

  private parseLetStatement(): LetStatement {
    const isMutable = this.match(TokenType.MUT);
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect identifier after 'let'",
    ).value;
    this.consume(TokenType.EQUALS, "Expect '=' after identifier");
    const initializer = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after let statement");
    return { type: "LetStatement", name, isMutable, initializer };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect function name",
    ).value;
    this.consume(TokenType.LPAREN, "Expect '(' after function name");
    const params: string[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        params.push(
          this.consume(TokenType.IDENTIFIER, "Expect parameter name").value,
        );
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, "Expect ')' after parameters");
    const body = this.parseBlockStatement();
    return { type: "FunctionDeclaration", name, params, body };
  }

  private parseBlockStatement(): BlockStatement {
    this.consume(TokenType.LBRACE, "Expect '{' to start block");
    const body: Statement[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      body.push(this.parseStatement());
    }
    this.consume(TokenType.RBRACE, "Expect '}' to end block");
    return { type: "BlockStatement", body };
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expression = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after expression");
    return { type: "ExpressionStatement", expression };
  }

  private parseExpression(): Expression {
    return this.parseBitwiseOr();
  }

  private parseBitwiseOr(): Expression {
    let expr = this.parseBitwiseXor();
    while (this.match(TokenType.PIPE)) {
      const operator = this.previous().value;
      const right = this.parseBitwiseXor();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private parseBitwiseXor(): Expression {
    let expr = this.parseBitwiseAnd();
    while (this.match(TokenType.CARET)) {
      const operator = this.previous().value;
      const right = this.parseBitwiseAnd();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private parseBitwiseAnd(): Expression {
    let expr = this.parseShift();
    while (this.match(TokenType.AMPERSAND)) {
      const operator = this.previous().value;
      const right = this.parseShift();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private parseShift(): Expression {
    let expr = this.parseAddition();
    while (this.match(TokenType.LSHIFT, TokenType.RSHIFT)) {
      const operator = this.previous().value;
      const right = this.parseAddition();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private parseAddition(): Expression {
    let expr = this.parseMultiplication();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.parseMultiplication();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private parseMultiplication(): Expression {
    let expr = this.parseUnary();
    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      expr = { type: "BinaryExpression", operator, left: expr, right };
    }
    return expr;
  }

  private parseUnary(): Expression {
    if (
      this.match(TokenType.MINUS, TokenType.EXCLAMATION, TokenType.AMPERSAND)
    ) {
      const operator = this.previous().value;
      const argument = this.parseUnary();
      return { type: "UnaryExpression", operator, argument };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    if (this.match(TokenType.INTEGER))
      return {
        type: "Literal",
        value: parseInt(this.previous().value),
        rawType: "integer",
      };
    if (this.match(TokenType.HEX))
      return {
        type: "Literal",
        value: parseInt(this.previous().value, 16),
        rawType: "hex",
      };
    if (this.match(TokenType.STRING))
      return {
        type: "Literal",
        value: this.previous().value,
        rawType: "string",
      };

    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous().value;
      if (this.match(TokenType.EXCLAMATION)) {
        // Macro call: print!(...)
        this.consume(TokenType.LPAREN, "Expect '(' after macro name");
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after macro args");
        return { type: "MacroInvocation", name, args };
      }
      if (this.match(TokenType.LPAREN)) {
        // Function call
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after args");
        return { type: "CallExpression", callee: name, args };
      }
      return { type: "Identifier", name };
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expect ')' after expression");
      return expr;
    }

    throw new Error(
      `Expect expression at ${this.peek().value} (type: ${this.peek().type})`,
    );
  }

  // Helpers
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

  private previous(): Token {
    return this.tokens[this.pos - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(message + " at " + this.peek().value);
  }
}
