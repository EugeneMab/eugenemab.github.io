// src/parser.ts
import { TokenType, Token, Lexer } from "./lexer.js";

export type ASTNode =
  | ProgramNode
  | FunctionDefNode
  | AssignmentNode
  | BinaryExpressionNode
  | LiteralNode
  | IdentifierNode
  | ReturnNode
  | WhileNode
  | CallExpressionNode
  | UnaryExpressionNode
  | IfNode
  | ListNode
  | ListComprehensionNode
  | DictComprehensionNode
  | SubscriptNode
  | SliceNode
  | ForNode
  | DoWhileNode
  | FStringNode
  | PassNode;

export interface PassNode {
  type: "Pass";
}

export interface ForNode {
  type: "For";
  iterator: string;
  iterable?: ASTNode;
  start?: ASTNode;
  stop?: ASTNode;
  body: ASTNode[];
}

export interface DoWhileNode {
  type: "DoWhile";
  condition: ASTNode;
  body: ASTNode[];
}

export interface FStringNode {
  type: "FString";
  parts: (string | ASTNode)[];
}

export interface ProgramNode {
  type: "Program";
  body: ASTNode[];
}

export interface ListComprehensionNode {
  type: "ListComprehension";
  expression: ASTNode;
  item: string;
  iterable: ASTNode;
  condition: ASTNode | null;
}

export interface DictComprehensionNode {
  type: "DictComprehension";
  key: ASTNode;
  value: ASTNode;
  item: string;
  iterable: ASTNode;
  condition: ASTNode | null;
}

export interface ListNode {
  type: "List";
  elements: ASTNode[];
}

export interface SubscriptNode {
  type: "Subscript";
  value: ASTNode;
  index: ASTNode;
}

export interface SliceNode {
  type: "Slice";
  start: ASTNode | null;
  stop: ASTNode | null;
  step: ASTNode | null;
}

export interface IfNode {
  type: "If";
  condition: ASTNode;
  thenBranch: ASTNode[];
  elseBranch: ASTNode[] | null;
}

export interface UnaryExpressionNode {
  type: "UnaryExpression";
  operator: string;
  argument: ASTNode;
}

export interface FunctionDefNode {
  type: "FunctionDef";
  name: string;
  params: string[];
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
  value: number | string | boolean;
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
}

export interface ReturnNode {
  type: "Return";
  value: ASTNode;
}

export interface WhileNode {
  type: "While";
  condition: ASTNode;
  body: ASTNode[];
}

export interface CallExpressionNode {
  type: "CallExpression";
  callee: string;
  args: ASTNode[];
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
    if (this.match(TokenType.WHILE)) return this.parseWhile();
    if (this.match(TokenType.DO)) return this.parseDoWhile();
    if (this.match(TokenType.FOR)) return this.parseFor();
    if (this.match(TokenType.IF)) return this.parseIf();
    if (this.match(TokenType.PASS)) {
      this.consumeStatementEnd();
      return { type: "Pass" };
    }

    if (this.match(TokenType.NEWLINE)) return null;

    const expr = this.parseExpression();

    if (this.match(TokenType.EQUALS)) {
      if (expr.type !== "Identifier") {
        throw new Error("Invalid assignment target");
      }
      const value = this.parseExpression();
      this.consumeStatementEnd();
      return { type: "Assignment", target: expr.name, value };
    }

    this.consumeStatementEnd();
    return expr;
  }

  private consumeStatementEnd(): void {
    if (
      this.match(TokenType.NEWLINE) ||
      this.isAtEnd() ||
      this.check(TokenType.DEDENT)
    ) {
      return;
    }
    const token = this.peek();
    throw new Error(
      `Unexpected token at end of statement: ${token.type} at line ${token.line}, col ${token.col}`,
    );
  }

  private parseIf(): IfNode {
    const condition = this.parseExpression();
    this.consume(TokenType.COLON, "Expect ':' after if condition");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(TokenType.INDENT, "Expect indent after if");
    const thenBranch: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) thenBranch.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after if body");

    let elseBranch: ASTNode[] | null = null;
    if (this.match(TokenType.ELIF)) {
      elseBranch = [this.parseIf()];
    } else if (this.match(TokenType.ELSE)) {
      this.consume(TokenType.COLON, "Expect ':' after else");
      this.consume(TokenType.NEWLINE, "Expect newline after ':'");
      this.consume(TokenType.INDENT, "Expect indent after else");
      elseBranch = [];
      while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
        const node = this.parseStatement();
        if (node) elseBranch.push(node);
      }
      this.consume(TokenType.DEDENT, "Expect dedent after else body");
    }

    return { type: "If", condition, thenBranch, elseBranch };
  }

  private parseWhile(): WhileNode {
    const condition = this.parseExpression();
    this.consume(TokenType.COLON, "Expect ':' after while condition");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(TokenType.INDENT, "Expect indent after while");
    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after while body");
    return { type: "While", condition, body };
  }

  private parseFor(): ForNode {
    const iterator = this.consume(
      TokenType.IDENTIFIER,
      "Expect iterator name",
    ).value;
    let iterable: ASTNode | undefined;
    let start: ASTNode | undefined;
    let stop: ASTNode | undefined;

    if (this.match(TokenType.IN)) {
      iterable = this.parseExpression();
    } else if (this.match(TokenType.FROM)) {
      start = this.parseExpression();
      this.consume(TokenType.TO, "Expect 'to' after 'from'");
      stop = this.parseExpression();
    } else {
      throw new Error("Expect 'in' or 'from' after for iterator");
    }

    this.consume(TokenType.COLON, "Expect ':' after for header");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(TokenType.INDENT, "Expect indent after for");
    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after for body");
    return { type: "For", iterator, iterable, start, stop, body };
  }

  private parseDoWhile(): DoWhileNode {
    this.consume(TokenType.COLON, "Expect ':' after do");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(TokenType.INDENT, "Expect indent after do");
    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after do body");
    this.consume(TokenType.WHILE, "Expect 'while' after do body");
    const condition = this.parseExpression();
    return { type: "DoWhile", condition, body };
  }

  private parseCall(): CallExpressionNode {
    const callee = this.consume(
      TokenType.IDENTIFIER,
      "Expect function name",
    ).value;
    this.consume(TokenType.LPAREN, "Expect '('");
    const args: ASTNode[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, "Expect ')'");
    return { type: "CallExpression", callee, args };
  }

  private parseFunctionDef(): FunctionDefNode {
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

    return { type: "FunctionDef", name, params, body };
  }

  private parseAssignment(): AssignmentNode {
    const target = this.consume(
      TokenType.IDENTIFIER,
      "Expect variable name",
    ).value;
    this.consume(TokenType.EQUALS, "Expect '=' after variable name");
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return { type: "Assignment", target, value };
  }

  private parseReturn(): ReturnNode {
    const value = this.parseExpression();
    this.consumeStatementEnd();
    return { type: "Return", value };
  }

  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.match(TokenType.OR)) {
      const operator = "or";
      const right = this.parseAnd();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot();
    while (this.match(TokenType.AND)) {
      const operator = "and";
      const right = this.parseNot();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseNot(): ASTNode {
    if (this.match(TokenType.NOT)) {
      const operator = "not";
      const argument = this.parseNot();
      return { type: "UnaryExpression", operator, argument };
    }
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    while (
      this.match(
        TokenType.EQUALS_EQUALS,
        TokenType.NOT_EQUALS,
        TokenType.LESS,
        TokenType.GREATER,
      )
    ) {
      const operator = this.previous().value;
      const right = this.parseAddition();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().type === TokenType.PLUS ? "+" : "-";
      const right = this.parseMultiplication();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parseUnary();
    while (this.match(TokenType.STAR, TokenType.SLASH)) {
      const operator = this.previous().type === TokenType.STAR ? "*" : "/";
      const right = this.parseUnary();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.match(TokenType.MINUS)) {
      const operator = "-";
      const argument = this.parseUnary();
      return { type: "UnaryExpression", operator, argument };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    let expr: ASTNode;
    if (this.match(TokenType.NUMBER)) {
      expr = { type: "Literal", value: parseInt(this.previous().value) };
    } else if (this.match(TokenType.STRING)) {
      expr = { type: "Literal", value: this.previous().value };
    } else if (this.match(TokenType.FSTRING)) {
      expr = this.parseFString(this.previous().value);
    } else if (this.match(TokenType.TRUE)) {
      expr = { type: "Literal", value: 1 };
    } else if (this.match(TokenType.FALSE)) {
      expr = { type: "Literal", value: 0 };
    } else if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous().value;
      if (this.check(TokenType.LPAREN)) {
        this.pos--; // Backtrack identifier
        expr = this.parseCall();
      } else {
        expr = { type: "Identifier", name };
      }
    } else if (this.match(TokenType.LPAREN)) {
      expr = this.parseExpression();
      this.consume(TokenType.RPAREN, "Expect ')' after expression");
    } else if (this.match(TokenType.LSQUARE)) {
      expr = this.parseList();
    } else if (this.match(TokenType.LBRACE)) {
      expr = this.parseDict();
    } else {
      const token = this.peek();
      throw new Error(
        `Expect expression at line ${token.line}, col ${token.col}`,
      );
    }

    // Handle post-primary: subscripts
    while (this.match(TokenType.LSQUARE)) {
      expr = this.parseSubscript(expr);
    }

    return expr;
  }

  private parseFString(value: string): FStringNode {
    const parts: (string | ASTNode)[] = [];
    let current = "";
    for (let i = 0; i < value.length; i++) {
      if (value[i] === "{") {
        if (current) parts.push(current);
        current = "";
        let exprStr = "";
        let braces = 1;
        i++;
        while (i < value.length && braces > 0) {
          if (value[i] === "{") braces++;
          if (value[i] === "}") braces--;
          if (braces > 0) exprStr += value[i++];
        }
        if (braces > 0) {
          throw new Error("Unterminated f-string expression");
        }
        const lexer = new Lexer(exprStr);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        parts.push(parser.parseExpression());
      } else {
        current += value[i];
      }
    }
    if (current) parts.push(current);
    return { type: "FString", parts };
  }

  private parseList(): ListNode | ListComprehensionNode {
    if (this.check(TokenType.RSQUARE)) {
      this.advance();
      return { type: "List", elements: [] };
    }

    const firstExpr = this.parseExpression();

    if (this.match(TokenType.FOR)) {
      const item = this.consume(
        TokenType.IDENTIFIER,
        "Expect variable name",
      ).value;
      this.consume(TokenType.IN, "Expect 'in'");
      const iterable = this.parseExpression();
      let condition: ASTNode | null = null;
      if (this.match(TokenType.IF)) {
        condition = this.parseExpression();
      }
      this.consume(TokenType.RSQUARE, "Expect ']' after comprehension");
      return {
        type: "ListComprehension",
        expression: firstExpr,
        item,
        iterable,
        condition,
      };
    }

    const elements: ASTNode[] = [firstExpr];
    while (this.match(TokenType.COMMA)) {
      if (this.check(TokenType.RSQUARE)) break;
      elements.push(this.parseExpression());
    }
    this.consume(TokenType.RSQUARE, "Expect ']' after list");
    return { type: "List", elements };
  }

  private parseDict(): DictComprehensionNode {
    const key = this.parseExpression();
    this.consume(TokenType.COLON, "Expect ':' after key in dict comprehension");
    const value = this.parseExpression();

    this.consume(TokenType.FOR, "Expect 'for' in dict comprehension");
    const item = this.consume(
      TokenType.IDENTIFIER,
      "Expect variable name",
    ).value;
    this.consume(TokenType.IN, "Expect 'in'");
    const iterable = this.parseExpression();
    let condition: ASTNode | null = null;
    if (this.match(TokenType.IF)) {
      condition = this.parseExpression();
    }
    this.consume(TokenType.RBRACE, "Expect '}' after dict comprehension");
    return { type: "DictComprehension", key, value, item, iterable, condition };
  }

  private parseSubscript(value: ASTNode): ASTNode {
    let start: ASTNode | null = null;
    let stop: ASTNode | null = null;
    let step: ASTNode | null = null;
    let isSlice = false;

    if (!this.check(TokenType.COLON) && !this.check(TokenType.RSQUARE)) {
      start = this.parseExpression();
    }

    if (this.match(TokenType.COLON)) {
      isSlice = true;
      if (!this.check(TokenType.COLON) && !this.check(TokenType.RSQUARE)) {
        stop = this.parseExpression();
      }
      if (this.match(TokenType.COLON)) {
        if (!this.check(TokenType.RSQUARE)) {
          step = this.parseExpression();
        }
      }
    }

    this.consume(TokenType.RSQUARE, "Expect ']' after subscript");

    if (isSlice) {
      return {
        type: "Subscript",
        value,
        index: { type: "Slice", start, stop, step },
      };
    } else {
      if (start === null) throw new Error("Expect index in subscript");
      return { type: "Subscript", value, index: start };
    }
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
