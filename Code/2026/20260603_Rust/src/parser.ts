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
  | ConstStatement
  | ExpressionStatement
  | BlockStatement
  | FunctionDeclaration
  | IfStatement
  | LoopStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement;

export interface LetStatement extends BaseNode {
  type: "LetStatement";
  name: string;
  isMutable: boolean;
  initializer: Expression;
}

export interface ConstStatement extends BaseNode {
  type: "ConstStatement";
  name: string;
  initializer: Expression;
}

export interface IfStatement extends BaseNode {
  type: "IfStatement";
  condition: Expression;
  thenBranch: BlockStatement;
  elseBranch?: BlockStatement | IfStatement;
}

export interface LoopStatement extends BaseNode {
  type: "LoopStatement";
  body: BlockStatement;
}

export interface WhileStatement extends BaseNode {
  type: "WhileStatement";
  condition: Expression;
  body: BlockStatement;
}

export interface ForStatement extends BaseNode {
  type: "ForStatement";
  pattern: Pattern;
  iterable: Expression;
  body: BlockStatement;
}

export interface ReturnStatement extends BaseNode {
  type: "ReturnStatement";
  argument?: Expression;
}

export type Pattern =
  | { type: "IdentifierPattern"; name: string }
  | { type: "TuplePattern"; elements: Pattern[] }
  | { type: "ReferencePattern"; pattern: Pattern };

export interface BreakStatement extends BaseNode {
  type: "BreakStatement";
}

export interface ContinueStatement extends BaseNode {
  type: "ContinueStatement";
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
  params: { name: string; type?: string }[];
  returnType?: string;
  body: BlockStatement;
}

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | BorrowExpression
  | RangeExpression
  | MemberAccessExpression
  | IndexExpression
  | ArrayLiteral
  | Literal
  | Identifier
  | CallExpression
  | MacroInvocation
  | BlockStatement
  | IfStatement;

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

export interface RangeExpression extends BaseNode {
  type: "RangeExpression";
  start?: Expression;
  end?: Expression;
}

export interface MemberAccessExpression extends BaseNode {
  type: "MemberAccessExpression";
  object: Expression;
  member: string;
}

export interface IndexExpression extends BaseNode {
  type: "IndexExpression";
  object: Expression;
  index: Expression;
}

export interface ArrayLiteral extends BaseNode {
  type: "ArrayLiteral";
  elements: Expression[];
}

export interface Literal extends BaseNode {
  type: "Literal";
  value: string | number;
  rawType: "integer" | "hex" | "string" | "byte";
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
    if (this.match(TokenType.CONST)) return this.parseConstStatement();
    if (this.match(TokenType.FN)) return this.parseFunctionDeclaration();
    if (this.match(TokenType.IF)) return this.parseIfStatement();
    if (this.match(TokenType.LOOP)) return this.parseLoopStatement();
    if (this.match(TokenType.WHILE)) return this.parseWhileStatement();
    if (this.match(TokenType.FOR)) return this.parseForStatement();
    if (this.match(TokenType.RETURN)) return this.parseReturnStatement();
    if (this.match(TokenType.BREAK)) return this.parseBreakStatement();
    if (this.match(TokenType.CONTINUE)) return this.parseContinueStatement();

    if (this.check(TokenType.LBRACE)) {
      const block = this.parseBlockStatement();
      if (this.match(TokenType.SEMICOLON)) {
        return { type: "ExpressionStatement", expression: block };
      }
      return block;
    }

    return this.parseExpressionStatement();
  }

  private parseLoopStatement(): LoopStatement {
    const token = this.previous();
    const body = this.parseBlockStatement();
    return { type: "LoopStatement", token, body };
  }

  private parseWhileStatement(): WhileStatement {
    const token = this.previous();
    const condition = this.parseExpression();
    const body = this.parseBlockStatement();
    return { type: "WhileStatement", token, condition, body };
  }

  private parseForStatement(): ForStatement {
    const token = this.previous();
    const pattern = this.parsePattern();
    this.consume(TokenType.IN, "Expect 'in' after for pattern");
    const iterable = this.parseExpression();
    const body = this.parseBlockStatement();
    return { type: "ForStatement", token, pattern, iterable, body };
  }

  private parseReturnStatement(): ReturnStatement {
    const token = this.previous();
    let argument: Expression | undefined;
    if (!this.check(TokenType.SEMICOLON)) {
      argument = this.parseExpression();
    }
    this.consume(TokenType.SEMICOLON, "Expect ';' after return");
    return { type: "ReturnStatement", token, argument };
  }

  private parsePattern(): Pattern {
    if (this.match(TokenType.AMPERSAND)) {
      return { type: "ReferencePattern", pattern: this.parsePattern() };
    }
    if (this.match(TokenType.LPAREN)) {
      const elements: Pattern[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          elements.push(this.parsePattern());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, "Expect ')' after tuple pattern");
      return { type: "TuplePattern", elements };
    }
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect identifier in pattern",
    ).value;
    return { type: "IdentifierPattern", name };
  }

  private parseBreakStatement(): BreakStatement {
    const token = this.previous();
    this.consume(TokenType.SEMICOLON, "Expect ';' after 'break'");
    return { type: "BreakStatement", token };
  }

  private parseContinueStatement(): ContinueStatement {
    const token = this.previous();
    this.consume(TokenType.SEMICOLON, "Expect ';' after 'continue'");
    return { type: "ContinueStatement", token };
  }

  private parseIfStatement(): IfStatement {
    const token = this.previous();
    const condition = this.parseExpression();
    const thenBranch = this.parseBlockStatement();
    let elseBranch: BlockStatement | IfStatement | undefined;
    if (this.match(TokenType.ELSE)) {
      if (this.match(TokenType.IF)) {
        elseBranch = this.parseIfStatement();
      } else {
        elseBranch = this.parseBlockStatement();
      }
    }
    return { type: "IfStatement", token, condition, thenBranch, elseBranch };
  }

  private parseLetStatement(): LetStatement {
    const token = this.previous();
    const isMutable = this.match(TokenType.MUT);
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect identifier after 'let'",
    ).value;
    if (this.match(TokenType.COLON)) {
      this.consume(TokenType.IDENTIFIER, "Expect type name");
    }
    this.consume(TokenType.EQUALS, "Expect '=' after identifier");
    const initializer = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after let statement");
    return { type: "LetStatement", token, name, isMutable, initializer };
  }

  private parseConstStatement(): ConstStatement {
    const token = this.previous();
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect identifier after 'const'",
    ).value;
    this.consume(TokenType.COLON, "Expect ':' after identifier");
    this.consume(TokenType.IDENTIFIER, "Expect type name");
    this.consume(TokenType.EQUALS, "Expect '=' after type");
    const initializer = this.parseExpression();
    this.consume(TokenType.SEMICOLON, "Expect ';' after const statement");
    return { type: "ConstStatement", token, name, initializer };
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    const token = this.previous();
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect function name",
    ).value;
    this.consume(TokenType.LPAREN, "Expect '(' after function name");
    const params: { name: string; type?: string }[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const pName = this.consume(
          TokenType.IDENTIFIER,
          "Expect parameter name",
        ).value;
        let pType: string | undefined;
        if (this.match(TokenType.COLON)) {
          // Allow &str, &String, &mut String, etc.
          pType = "";
          while (
            this.match(TokenType.AMPERSAND, TokenType.MUT, TokenType.IDENTIFIER)
          ) {
            pType += (pType ? " " : "") + this.previous().value;
          }
        }
        params.push({ name: pName, type: pType });
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, "Expect ')' after parameters");
    let returnType: string | undefined;
    if (this.match(TokenType.ARROW)) {
      returnType = "";
      while (
        this.match(TokenType.AMPERSAND, TokenType.MUT, TokenType.IDENTIFIER)
      ) {
        returnType += (returnType ? " " : "") + this.previous().value;
      }
    }
    const body = this.parseBlockStatement();
    return { type: "FunctionDeclaration", token, name, params, returnType, body };
  }

  private parseBlockStatement(): BlockStatement {
    const token = this.consume(TokenType.LBRACE, "Expect '{' to start block");
    const body: Statement[] = [];
    let tailExpression: Expression | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (
        this.check(TokenType.LET) ||
        this.check(TokenType.CONST) ||
        this.check(TokenType.FN) ||
        this.check(TokenType.IF) ||
        this.check(TokenType.LOOP) ||
        this.check(TokenType.WHILE) ||
        this.check(TokenType.FOR) ||
        this.check(TokenType.RETURN) ||
        this.check(TokenType.BREAK) ||
        this.check(TokenType.CONTINUE)
      ) {
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
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const expr = this.parseRange();
    if (this.match(TokenType.EQUALS)) {
      const token = this.previous();
      const right = this.parseAssignment();
      if (expr.type === "Identifier") {
        return {
          type: "BinaryExpression",
          token,
          operator: "=",
          left: expr,
          right,
        };
      }
      throw new Error(formatError(this.source, "Invalid l-value", token));
    }
    return expr;
  }

  private parseRange(): Expression {
    if (this.match(TokenType.DOT_DOT)) {
      const token = this.previous();
      let end: Expression | undefined;
      if (
        !this.check(
          TokenType.RBRACKET,
          TokenType.COMMA,
          TokenType.SEMICOLON,
          TokenType.RPAREN,
          TokenType.RBRACE,
        )
      ) {
        end = this.parseComparison();
      }
      return { type: "RangeExpression", token, end };
    }
    const expr = this.parseComparison();
    if (this.match(TokenType.DOT_DOT)) {
      const token = this.previous();
      let end: Expression | undefined;
      // Ranges can be open-ended, e.g., s[..] or s[0..]
      if (
        !this.check(
          TokenType.RBRACKET,
          TokenType.COMMA,
          TokenType.SEMICOLON,
          TokenType.RPAREN,
          TokenType.RBRACE,
        )
      ) {
        end = this.parseComparison();
      }
      return { type: "RangeExpression", token, start: expr, end };
    }
    return expr;
  }

  private parseComparison(): Expression {
    let expr = this.parseBitwiseOr();
    while (
      this.match(
        TokenType.EQ_EQ,
        TokenType.NE_EQ,
        TokenType.LT,
        TokenType.GT,
        TokenType.LT_EQ,
        TokenType.GT_EQ,
      )
    ) {
      const token = this.previous();
      const operator = token.value;
      const right = this.parseBitwiseOr();
      expr = { type: "BinaryExpression", token, operator, left: expr, right };
    }
    return expr;
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
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    while (true) {
      if (this.match(TokenType.DOT)) {
        const token = this.previous();
        const member = this.consume(
          TokenType.IDENTIFIER,
          "Expect member name after '.'",
        ).value;
        if (this.match(TokenType.LPAREN)) {
          const args: Expression[] = [];
          if (!this.check(TokenType.RPAREN)) {
            do {
              args.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
          }
          this.consume(TokenType.RPAREN, "Expect ')' after args");
          expr = {
            type: "CallExpression",
            token,
            callee: `${member}`,
            args: [expr, ...args], // Simple method call desugaring
          };
        } else {
          expr = {
            type: "MemberAccessExpression",
            token,
            object: expr,
            member,
          };
        }
      } else if (this.match(TokenType.LBRACKET)) {
        const token = this.previous();
        const index = this.parseExpression();
        this.consume(TokenType.RBRACKET, "Expect ']' after index");
        expr = { type: "IndexExpression", token, object: expr, index };
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Expression {
    if (this.check(TokenType.LBRACE)) return this.parseBlockStatement();

    if (this.match(TokenType.LBRACKET)) {
      const token = this.previous();
      const elements: Expression[] = [];
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RBRACKET, "Expect ']' after array elements");
      return { type: "ArrayLiteral", token, elements };
    }

    if (this.match(TokenType.IF)) {
      return this.parseIfStatement();
    }

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
    if (this.match(TokenType.BYTE_LITERAL)) {
      const token = this.previous();
      return {
        type: "Literal",
        token,
        value: parseInt(token.value),
        rawType: "byte",
      };
    }
    if (this.match(TokenType.TRUE)) {
      const token = this.previous();
      return {
        type: "Literal",
        token,
        value: 1,
        rawType: "integer",
      };
    }
    if (this.match(TokenType.FALSE)) {
      const token = this.previous();
      return {
        type: "Literal",
        token,
        value: 0,
        rawType: "integer",
      };
    }

    if (this.match(TokenType.IDENTIFIER, TokenType.PANIC)) {
      const token = this.previous();
      let name = token.value;
      while (this.match(TokenType.COLON_COLON)) {
        name +=
          "::" +
          this.consume(TokenType.IDENTIFIER, "Expect identifier after '::'")
            .value;
      }
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
