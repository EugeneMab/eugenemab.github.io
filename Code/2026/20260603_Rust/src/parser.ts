import { Token, TokenType } from "./lexer.js";
import { formatError } from "./error.js";

export type ASTNode = Program | Statement | Expression;

export interface Program extends BaseNode {
  type: "Program";
  body: Statement[];
}

interface BaseNode {
  token?: Token;
}

export type Statement =
  | LetStatement
  | ExpressionStatement
  | BlockStatement
  | FunctionDeclaration;

export interface LetStatement extends BaseNode {
  type: "LetStatement";
  name: string;
  isMutable: boolean;
  initializer: Expression;
}

export interface ExpressionStatement extends BaseNode {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface BlockStatement extends BaseNode {
  type: "BlockStatement";
  body: Statement[];
  tailExpression?: Expression;
}

export interface FunctionDeclaration extends BaseNode {
  type: "FunctionDeclaration";
  name: string;
  params: string[]; // Simple for now
  body: BlockStatement;
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | BorrowExpression
  | Literal
  | Identifier
  | CallExpression
  | MacroInvocation
  | BlockStatement;

export interface BinaryExpression extends BaseNode {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  type: "UnaryExpression";
  operator: string;
  argument: Expression;
}

export interface BorrowExpression extends BaseNode {
  type: "BorrowExpression";
  isMutable: boolean;
  argument: Expression;
}

export interface Literal extends BaseNode {
  type: "Literal";
  value: string | number;
  rawType: "integer" | "hex" | "string";
}

export interface Identifier extends BaseNode {
  type: "Identifier";
  name: string;
}

export interface CallExpression extends BaseNode {
  type: "CallExpression";
  callee: string;
  args: Expression[];
}

export interface MacroInvocation extends BaseNode {
  type: "MacroInvocation";
  name: string; // e.g., "print"
  args: Expression[];
}

export class Parser {
  private tokens: Token[];
  private source: string;
  private pos = 0;

  constructor(tokens: Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
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

    if (this.check(TokenType.LBRACE)) {
      const block = this.parseBlockStatement();
      if (this.match(TokenType.SEMICOLON)) {
        return { type: "ExpressionStatement", expression: block };
      }
      return block;
    }

    return this.parseExpressionStatement();
  }

  private parseLetStatement(): LetStatement {
    const token = this.previous();
    const isMutable = this.match(TokenType.MUT);
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect identifier after 'let'",
    ).value;
    this.consume(TokenType.EQUALS, "Expect '=' after identifier");
    const initializer = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after let statement");
    return { type: "LetStatement", token, name, isMutable, initializer };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const token = this.previous();
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
    return { type: "FunctionDeclaration", token, name, params, body };
  }

  private parseBlockStatement(): BlockStatement {
    const token = this.consume(TokenType.LBRACE, "Expect '{' to start block");
    const body: Statement[] = [];
    let tailExpression: Expression | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.LET) || this.check(TokenType.FN)) {
        body.push(this.parseStatement());
        continue;
      }

      const expr = this.parseExpression();
      if (this.match(TokenType.SEMICOLON)) {
        body.push({
          type: "ExpressionStatement",
          token: this.previous(),
          expression: expr,
        });
      } else {
        if (expr.type === "BlockStatement") {
          body.push(expr);
        } else {
          tailExpression = expr;
          if (!this.check(TokenType.RBRACE)) {
            throw new Error(
              formatError(
                this.source,
                "Expect ';' after expression",
                this.peek(),
              ),
            );
          }
          break;
        }
      }
    }
    this.consume(TokenType.RBRACE, "Expect '}' to end block");
    return { type: "BlockStatement", token, body, tailExpression };
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expression = this.parseExpression();
    const token = this.consume(
      TokenType.SEMICOLON,
      "Expect ';' after expression",
    );
    return { type: "ExpressionStatement", token, expression };
  }

  private parseExpression(): Expression {
    return this.parseBitwiseOr();
  }

  private parseBitwiseOr(): Expression {
    let expr = this.parseBitwiseXor();
    while (this.match(TokenType.PIPE)) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseBitwiseXor();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
  }

  private parseBitwiseXor(): Expression {
    let expr = this.parseBitwiseAnd();
    while (this.match(TokenType.CARET)) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseBitwiseAnd();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
  }

  private parseBitwiseAnd(): Expression {
    let expr = this.parseShift();
    while (this.match(TokenType.AMPERSAND)) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseShift();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
  }

  private parseShift(): Expression {
    let expr = this.parseAddition();
    while (this.match(TokenType.LSHIFT, TokenType.RSHIFT)) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseAddition();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
  }

  private parseAddition(): Expression {
    let expr = this.parseMultiplication();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseMultiplication();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
  }

  private parseMultiplication(): Expression {
    let expr = this.parseUnary();
    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseUnary();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
  }

  private parseUnary(): Expression {
    if (this.match(TokenType.AMPERSAND)) {
      const token = this.previous();
      const isMutable = this.match(TokenType.MUT);
      const argument = this.parseUnary();
      return { type: "BorrowExpression", token, isMutable, argument };
    }
    if (this.match(TokenType.MINUS, TokenType.EXCLAMATION)) {
      const token = this.previous();
      const operator = token.value;
      const argument = this.parseUnary();
      return { type: "UnaryExpression", token, operator, argument };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    if (this.check(TokenType.LBRACE)) return this.parseBlockStatement();

    if (this.match(TokenType.INTEGER)) {
      const token = this.previous();
      return {
        type: "Literal",
        token,
        value: parseInt(token.value),
        rawType: "integer",
      };
    }
    if (this.match(TokenType.HEX)) {
      const token = this.previous();
      return {
        type: "Literal",
        token,
        value: parseInt(token.value, 16),
        rawType: "hex",
      };
    }
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: "Literal",
        token,
        value: token.value,
        rawType: "string",
      };
    }

    if (this.match(TokenType.IDENTIFIER, TokenType.PANIC)) {
      const token = this.previous();
      const name = token.value;
      if (this.match(TokenType.EXCLAMATION)) {
        this.consume(TokenType.LPAREN, "Expect '(' after macro name");
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after macro args");
        return { type: "MacroInvocation", token, name, args };
      }
      if (this.match(TokenType.LPAREN)) {
        const args: Expression[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseExpression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after args");
        return { type: "CallExpression", token, callee: name, args };
      }
      return { type: "Identifier", token, name };
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expect ')' after expression");
      return expr;
    }

    throw new Error(
      formatError(
        this.source,
        `Expect expression, found '${this.peek().value}'`,
        this.peek(),
      ),
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

  private check(...types: TokenType[]): boolean {
    if (this.isAtEnd()) return false;
    return types.includes(this.peek().type);
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
    const token = this.peek();
    const prev = this.previous();
    const errorToken =
      token.type === TokenType.EOF || token.line > prev.line ? prev : token;
    throw new Error(formatError(this.source, message, errorToken));
  }
}
