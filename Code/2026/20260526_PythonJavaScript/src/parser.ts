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
  | TupleNode
  | SetNode
  | DictNode
  | ListComprehensionNode
  | SetComprehensionNode
  | DictComprehensionNode
  | SubscriptNode
  | SliceNode
  | ForNode
  | DoWhileNode
  | FStringNode
  | BytesNode
  | YieldNode
  | PassNode
  | GlobalNode
  | NonlocalNode
  | StarTargetNode
  | WithNode
  | MemberAccessNode
  | LambdaNode
  | ClassNode;

export interface ClassNode {
  type: "Class";
  name: string;
  bases: ASTNode[];
  body: ASTNode[];
}

export interface LambdaNode {
  type: "Lambda";
  params: Parameter[];
  expression: ASTNode;
}

export interface GlobalNode {
  type: "Global";
  names: string[];
}

export interface NonlocalNode {
  type: "Nonlocal";
  names: string[];
}

export interface BytesNode {
  type: "Bytes";
  value: string;
}

export interface TupleNode {
  type: "Tuple";
  elements: ASTNode[];
}

export interface SetNode {
  type: "Set";
  elements: ASTNode[];
}

export interface DictNode {
  type: "Dict";
  entries: { key: ASTNode; value: ASTNode }[];
}

export interface SetComprehensionNode {
  type: "SetComprehension";
  expression: ASTNode;
  item: string;
  iterable: ASTNode;
  condition: ASTNode | null;
}

export interface WithNode {
  type: "With";
  expression: ASTNode;
  target: string | null;
  body: ASTNode[];
}

export interface MemberAccessNode {
  type: "MemberAccess";
  object: ASTNode;
  member: string;
}

export interface YieldNode {
  type: "Yield";
  value: ASTNode;
}

export interface PassNode {
  type: "Pass";
}

export interface ForNode {
  type: "For";
  iterators: string[];
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

export interface Parameter {
  name: string;
  defaultValue?: ASTNode;
}

export interface FunctionDefNode {
  type: "FunctionDef";
  name: string;
  params: Parameter[];
  body: ASTNode[];
}

export interface AssignmentNode {
  type: "Assignment";
  targets: ASTNode[];
  value: ASTNode;
}

export interface StarTargetNode {
  type: "StarTarget";
  name: string;
}

export interface BinaryExpressionNode {
  type: "BinaryExpression";
  left: ASTNode;
  operator: string;
  right: ASTNode;
}

export interface LiteralNode {
  type: "Literal";
  value: number | string | boolean | bigint;
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

export interface Argument {
  value: ASTNode;
  name?: string;
}

export interface CallExpressionNode {
  type: "CallExpression";
  callee: string | ASTNode;
  args: Argument[];
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private funcNestingLevel: number = 0;

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
    if (this.match(TokenType.CLASS)) return this.parseClass();
    if (this.match(TokenType.RETURN)) return this.parseReturn();
    if (this.match(TokenType.YIELD)) return this.parseYield();
    if (this.match(TokenType.WHILE)) return this.parseWhile();
    if (this.match(TokenType.DO)) return this.parseDoWhile();
    if (this.match(TokenType.FOR)) return this.parseFor();
    if (this.match(TokenType.IF)) return this.parseIf();
    if (this.match(TokenType.WITH)) return this.parseWith();
    if (this.match(TokenType.GLOBAL)) return this.parseGlobal();
    if (this.match(TokenType.NONLOCAL)) return this.parseNonlocal();
    if (this.match(TokenType.PASS)) {
      this.consumeStatementEnd();
      return { type: "Pass" };
    }

    if (this.match(TokenType.NEWLINE)) return null;

    const expr = this.parseTestList();

    if (this.match(TokenType.EQUALS)) {
      const targets = this.getAssignmentTargets(expr);
      const value = this.parseTestList();
      this.consumeStatementEnd();
      return { type: "Assignment", targets, value };
    }

    this.consumeStatementEnd();
    return expr;
  }

  private getAssignmentTargets(expr: ASTNode): ASTNode[] {
    if (
      expr.type === "Identifier" ||
      expr.type === "MemberAccess" ||
      expr.type === "Subscript"
    ) {
      return [expr];
    }
    if (expr.type === "Tuple" || expr.type === "List") {
      return expr.elements.map((e) => {
        if (
          e.type === "Identifier" ||
          e.type === "Tuple" ||
          e.type === "List" ||
          e.type === "StarTarget" ||
          e.type === "MemberAccess" ||
          e.type === "Subscript"
        ) {
          return e;
        }
        throw new Error("Invalid assignment target");
      });
    }
    throw new Error(`Invalid assignment target: ${expr.type}`);
  }

  private parseGlobal(): GlobalNode {
    const names: string[] = [];
    do {
      names.push(this.consume(TokenType.IDENTIFIER, "Expect identifier").value);
    } while (this.match(TokenType.COMMA));
    this.consumeStatementEnd();
    return { type: "Global", names };
  }

  private parseNonlocal(): NonlocalNode {
    if (this.funcNestingLevel === 0) {
      throw new Error("nonlocal declaration not allowed at module level");
    }
    const names: string[] = [];
    do {
      names.push(this.consume(TokenType.IDENTIFIER, "Expect identifier").value);
    } while (this.match(TokenType.COMMA));
    this.consumeStatementEnd();
    return { type: "Nonlocal", names };
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
    const iterators: string[] = [];
    iterators.push(
      this.consume(TokenType.IDENTIFIER, "Expect iterator name").value,
    );
    while (this.match(TokenType.COMMA)) {
      iterators.push(
        this.consume(TokenType.IDENTIFIER, "Expect iterator name").value,
      );
    }

    let iterable: ASTNode | undefined;
    let start: ASTNode | undefined;
    let stop: ASTNode | undefined;

    if (this.match(TokenType.IN)) {
      iterable = this.parseExpression();
    } else if (this.match(TokenType.FROM)) {
      if (iterators.length > 1) {
        throw new Error("Multiple iterators not supported with 'from ... to'");
      }
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
    return { type: "For", iterators, iterable, start, stop, body };
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

  private parseWith(): WithNode {
    const expression = this.parseExpression();
    let target: string | null = null;
    if (this.match(TokenType.AS)) {
      target = this.consume(
        TokenType.IDENTIFIER,
        "Expect identifier after 'as'",
      ).value;
    }
    this.consume(TokenType.COLON, "Expect ':' after with expression");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(TokenType.INDENT, "Expect indent after with");
    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after with body");
    return { type: "With", expression, target, body };
  }

  private parseFunctionDef(): FunctionDefNode {
    const name = this.consume(
      TokenType.IDENTIFIER,
      "Expect function name",
    ).value;
    this.consume(TokenType.LPAREN, "Expect '(' after function name");
    const params: Parameter[] = [];
    if (!this.check(TokenType.RPAREN)) {
      let hasDefault = false;
      do {
        const pName = this.consume(
          TokenType.IDENTIFIER,
          "Expect parameter name",
        ).value;
        let defaultValue: ASTNode | undefined;
        if (this.match(TokenType.EQUALS)) {
          defaultValue = this.parseExpression();
          hasDefault = true;
        } else if (hasDefault) {
          throw new Error("non-default argument follows default argument");
        }
        params.push({ name: pName, defaultValue });
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, "Expect ')' after parameters");
    this.consume(TokenType.COLON, "Expect ':' after parameters");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(
      TokenType.INDENT,
      "Expect indentation after function definition",
    );

    this.funcNestingLevel++;
    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.funcNestingLevel--;
    this.consume(TokenType.DEDENT, "Expect dedent after function body");

    return { type: "FunctionDef", name, params, body };
  }

  private parseClass(): ClassNode {
    const name = this.consume(TokenType.IDENTIFIER, "Expect class name").value;
    const bases: ASTNode[] = [];
    if (this.match(TokenType.LPAREN)) {
      if (!this.check(TokenType.RPAREN)) {
        do {
          bases.push(this.parseExpression());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, "Expect ')' after base classes");
    }
    this.consume(TokenType.COLON, "Expect ':' after class definition");
    this.consume(TokenType.NEWLINE, "Expect newline after ':'");
    this.consume(TokenType.INDENT, "Expect indentation after class definition");

    const body: ASTNode[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    this.consume(TokenType.DEDENT, "Expect dedent after class body");

    return { type: "Class", name, bases, body };
  }

  private parseReturn(): ReturnNode {
    const value = this.parseTestList();
    this.consumeStatementEnd();
    return { type: "Return", value };
  }

  private parseYield(): YieldNode {
    const value = this.parseTestList();
    this.consumeStatementEnd();
    return { type: "Yield", value };
  }

  private parseTestList(): ASTNode {
    const expr = this.parseExpression();
    if (this.match(TokenType.COMMA)) {
      const elements: ASTNode[] = [expr];
      do {
        if (
          this.check(TokenType.NEWLINE) ||
          this.check(TokenType.COLON) ||
          this.check(TokenType.RSQUARE) ||
          this.check(TokenType.RPAREN) ||
          this.check(TokenType.EQUALS)
        )
          break;
        elements.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
      return { type: "Tuple", elements };
    }
    return expr;
  }

  private parseExpression(): ASTNode {
    if (this.match(TokenType.LAMBDA)) {
      return this.parseLambda();
    }
    return this.parseOr();
  }

  private parseLambda(): LambdaNode {
    const params: Parameter[] = [];
    if (!this.check(TokenType.COLON)) {
      let hasDefault = false;
      do {
        const pName = this.consume(
          TokenType.IDENTIFIER,
          "Expect parameter name",
        ).value;
        let defaultValue: ASTNode | undefined;
        if (this.match(TokenType.EQUALS)) {
          defaultValue = this.parseExpression();
          hasDefault = true;
        } else if (hasDefault) {
          throw new Error("non-default argument follows default argument");
        }
        params.push({ name: pName, defaultValue });
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.COLON, "Expect ':' after lambda parameters");
    const expression = this.parseExpression();
    return { type: "Lambda", params, expression };
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
    let left = this.parseBitwiseOr();
    while (
      this.match(
        TokenType.EQUALS_EQUALS,
        TokenType.NOT_EQUALS,
        TokenType.LESS,
        TokenType.GREATER,
        TokenType.LESS_EQUALS,
        TokenType.GREATER_EQUALS,
        TokenType.IN,
      )
    ) {
      const operator = this.previous().value;
      const right = this.parseBitwiseOr();
      left = { type: "BinaryExpression", left, operator, right };
    }

    if (this.match(TokenType.NOT)) {
      if (this.match(TokenType.IN)) {
        const operator = "not in";
        const right = this.parseBitwiseOr();
        left = { type: "BinaryExpression", left, operator, right };
      }
    }
    return left;
  }

  private parseBitwiseOr(): ASTNode {
    let left = this.parseBitwiseXor();
    while (this.match(TokenType.PIPE)) {
      const operator = "|";
      const right = this.parseBitwiseXor();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseBitwiseXor(): ASTNode {
    let left = this.parseBitwiseAnd();
    while (this.match(TokenType.CARET)) {
      const operator = "^";
      const right = this.parseBitwiseAnd();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseBitwiseAnd(): ASTNode {
    let left = this.parseShift();
    while (this.match(TokenType.AMPERSAND)) {
      const operator = "&";
      const right = this.parseShift();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseShift(): ASTNode {
    let left = this.parseAddition();
    while (this.match(TokenType.LESS_LESS, TokenType.GREATER_GREATER)) {
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
    while (
      this.match(
        TokenType.STAR,
        TokenType.SLASH,
        TokenType.SLASH_SLASH,
        TokenType.PERCENT,
      )
    ) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      left = { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.TILDE)) {
      const operator = this.previous().value;
      const argument = this.parseUnary();
      return { type: "UnaryExpression", operator, argument };
    }
    if (this.match(TokenType.STAR)) {
      const arg = this.parseUnary();
      if (arg.type !== "Identifier") {
        throw new Error("Expect identifier after *");
      }
      return { type: "StarTarget", name: arg.name };
    }
    return this.parseExponentiation();
  }

  private parseExponentiation(): ASTNode {
    const left = this.parsePrimary();
    if (this.match(TokenType.STAR_STAR)) {
      const operator = "**";
      const right = this.parseUnary(); // Exponentiation is right-associative
      return { type: "BinaryExpression", left, operator, right };
    }
    return left;
  }

  private parsePrimary(): ASTNode {
    let expr: ASTNode;
    if (this.match(TokenType.NUMBER)) {
      const valStr = this.previous().value;
      if (valStr.includes(".")) {
        expr = { type: "Literal", value: parseFloat(valStr) };
      } else {
        const val = BigInt(valStr);
        if (
          val > BigInt(Number.MAX_SAFE_INTEGER) ||
          val < BigInt(Number.MIN_SAFE_INTEGER)
        ) {
          expr = { type: "Literal", value: val };
        } else {
          expr = { type: "Literal", value: Number(val) };
        }
      }
    } else if (this.match(TokenType.STRING)) {
      expr = { type: "Literal", value: this.previous().value };
    } else if (this.match(TokenType.BYTES)) {
      expr = { type: "Bytes", value: this.previous().value };
    } else if (this.match(TokenType.FSTRING)) {
      expr = this.parseFString(this.previous().value);
    } else if (this.match(TokenType.TRUE)) {
      expr = { type: "Literal", value: true };
    } else if (this.match(TokenType.FALSE)) {
      expr = { type: "Literal", value: false };
    } else if (this.match(TokenType.IDENTIFIER)) {
      expr = { type: "Identifier", name: this.previous().value };
    } else if (this.match(TokenType.LPAREN)) {
      expr = this.parseTupleOrParenthesized();
    } else if (this.match(TokenType.LSQUARE)) {
      expr = this.parseList();
    } else if (this.match(TokenType.LBRACE)) {
      expr = this.parseDictOrSet();
    } else {
      const token = this.peek();
      throw new Error(
        `Expect expression at line ${token.line}, col ${token.col}`,
      );
    }

    while (true) {
      if (this.match(TokenType.LPAREN)) {
        expr = this.parseCallArgs(expr);
      } else if (this.match(TokenType.LSQUARE)) {
        expr = this.parseSubscript(expr);
      } else if (this.match(TokenType.DOT)) {
        const member = this.consume(
          TokenType.IDENTIFIER,
          "Expect member name",
        ).value;
        expr = { type: "MemberAccess", object: expr, member };
      } else {
        break;
      }
    }

    return expr;
  }

  private parseCallArgs(callee: ASTNode): CallExpressionNode {
    const args: Argument[] = [];
    if (!this.check(TokenType.RPAREN)) {
      let hasKeyword = false;
      do {
        const expr = this.parseExpression();
        if (expr.type === "Identifier" && this.match(TokenType.EQUALS)) {
          const value = this.parseExpression();
          args.push({ name: expr.name, value });
          hasKeyword = true;
        } else {
          if (hasKeyword) {
            throw new Error("positional argument follows keyword argument");
          }
          args.push({ value: expr });
        }
      } while (this.match(TokenType.COMMA));
    }
    this.consume(TokenType.RPAREN, "Expect ')'");
    if (callee.type === "Identifier") {
      return { type: "CallExpression", callee: callee.name, args };
    }
    return { type: "CallExpression", callee, args };
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

  private parseTupleOrParenthesized(): ASTNode {
    if (this.match(TokenType.RPAREN)) {
      return { type: "Tuple", elements: [] };
    }
    const expr = this.parseTestList(); // Tuples in parens are testlists
    this.consume(TokenType.RPAREN, "Expect ')' after tuple");
    return expr;
  }

  private parseDictOrSet(): ASTNode {
    if (this.match(TokenType.RBRACE)) {
      return { type: "Dict", entries: [] };
    }

    const firstExpr = this.parseExpression();

    if (this.match(TokenType.COLON)) {
      const value = this.parseExpression();
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
        this.consume(TokenType.RBRACE, "Expect '}' after dict comprehension");
        return {
          type: "DictComprehension",
          key: firstExpr,
          value,
          item,
          iterable,
          condition,
        };
      } else {
        const entries = [{ key: firstExpr, value }];
        while (this.match(TokenType.COMMA)) {
          if (this.check(TokenType.RBRACE)) break;
          const k = this.parseExpression();
          this.consume(TokenType.COLON, "Expect ':' after key");
          const v = this.parseExpression();
          entries.push({ key: k, value: v });
        }
        this.consume(TokenType.RBRACE, "Expect '}' after dict");
        return { type: "Dict", entries };
      }
    } else if (this.match(TokenType.FOR)) {
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
      this.consume(TokenType.RBRACE, "Expect '}' after set comprehension");
      return {
        type: "SetComprehension",
        expression: firstExpr,
        item,
        iterable,
        condition,
      };
    } else {
      const elements = [firstExpr];
      while (this.match(TokenType.COMMA)) {
        if (this.check(TokenType.RBRACE)) break;
        elements.push(this.parseExpression());
      }
      this.consume(TokenType.RBRACE, "Expect '}' after set");
      return { type: "Set", elements };
    }
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
