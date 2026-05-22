// src/lexer.ts

export enum TokenType {
  DEF = "DEF",
  RETURN = "RETURN",
  IDENTIFIER = "IDENTIFIER",
  NUMBER = "NUMBER",
  EQUALS = "EQUALS",
  EQUALS_EQUALS = "EQUALS_EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  LESS = "LESS",
  GREATER = "GREATER",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  COLON = "COLON",
  WHILE = "WHILE",
  IF = "IF",
  ELIF = "ELIF",
  ELSE = "ELSE",
  FOR = "FOR",
  IN = "IN",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  TRUE = "TRUE",
  FALSE = "FALSE",

  NEWLINE = "NEWLINE",
  INDENT = "INDENT",
  DEDENT = "DEDENT",
  EOF = "EOF",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  COMMA = "COMMA",
  LSQUARE = "LSQUARE",
  RSQUARE = "RSQUARE",
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  STRING = "STRING",
  FSTRING = "FSTRING",
  DO = "DO",
  FROM = "FROM",
  TO = "TO",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private indentStack: number[] = [0];
  private pendingTokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    console.log(
      "Lexer: Starting tokenization of source length:",
      this.source.length,
    );
    const tokens: Token[] = [];
    let token: Token;
    do {
      token = this.nextToken();
      console.log(`Lexer: Produced token [${token.type}] "${token.value}"`);
      tokens.push(token);
    } while (token.type !== TokenType.EOF);
    console.log("Lexer: Tokenization complete. Total tokens:", tokens.length);
    return tokens;
  }

  private nextToken(): Token {
    if (this.pendingTokens.length > 0) {
      return this.pendingTokens.shift()!;
    }

    this.skipWhitespaceAndComments();

    if (this.pos >= this.source.length) {
      // Handle remaining dedents at EOF
      while (this.indentStack.length > 1) {
        this.indentStack.pop();
        this.pendingTokens.push(this.createToken(TokenType.DEDENT, ""));
      }
      if (this.pendingTokens.length > 0) return this.pendingTokens.shift()!;
      return this.createToken(TokenType.EOF, "");
    }

    const char = this.peek();

    // Handle Newlines and Indentation
    if (char === "\n" || char === "\r") {
      const lineToken = this.handleNewline();
      if (lineToken) return lineToken;
      return this.nextToken(); // Recurse if indentation produced pending tokens
    }

    // Identifiers and Keywords
    if (this.isAlpha(char)) {
      if (
        (char === "f" || char === "F") &&
        (this.peekNext() === '"' || this.peekNext() === "'")
      ) {
        const startCol = this.col;
        this.advance(); // consume 'f'
        return this.handleString(this.advance(), true, startCol); // consume quote
      }
      return this.handleIdentifier();
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.handleNumber();
    }

    // Strings
    if (char === '"' || char === "'") {
      const startCol = this.col;
      this.advance(); // Skip opening quote
      return this.handleString(char, false, startCol);
    }

    // Operators and Punctuation
    this.advance();
    switch (char) {
      case "=":
        if (this.peek() === "=") {
          this.advance();
          return this.createToken(TokenType.EQUALS_EQUALS, "==");
        }
        return this.createToken(TokenType.EQUALS, "=");
      case "!":
        if (this.peek() === "=") {
          this.advance();
          return this.createToken(TokenType.NOT_EQUALS, "!=");
        }
        throw new Error(`Unexpected character: ! at line ${this.line}`);
      case "<":
        return this.createToken(TokenType.LESS, "<");
      case ">":
        return this.createToken(TokenType.GREATER, ">");
      case "+":
        return this.createToken(TokenType.PLUS, "+");
      case "-":
        return this.createToken(TokenType.MINUS, "-");
      case "*":
        return this.createToken(TokenType.STAR, "*");
      case "/":
        return this.createToken(TokenType.SLASH, "/");
      case ":":
        return this.createToken(TokenType.COLON, ":");
      case "(":
        return this.createToken(TokenType.LPAREN, "(");
      case ")":
        return this.createToken(TokenType.RPAREN, ")");
      case ",":
        return this.createToken(TokenType.COMMA, ",");
      case "[":
        return this.createToken(TokenType.LSQUARE, "[");
      case "]":
        return this.createToken(TokenType.RSQUARE, "]");
      case "{":
        return this.createToken(TokenType.LBRACE, "{");
      case "}":
        return this.createToken(TokenType.RBRACE, "}");
      default:
        throw new Error(
          `Unexpected character: ${char} at line ${this.line}, col ${this.col}`,
        );
    }
  }

  private handleNewline(): Token {
    const startLine = this.line;
    const startCol = this.col;

    // Consume all newline characters
    while (
      this.pos < this.source.length &&
      (this.peek() === "\n" || this.peek() === "\r")
    ) {
      const c = this.advance();
      if (c === "\n") {
        this.line++;
        this.col = 1;
      }
    }

    // Measure indentation of the next line
    let indent = 0;
    while (
      this.pos < this.source.length &&
      (this.peek() === " " || this.peek() === "\t")
    ) {
      const c = this.advance();
      indent += c === "\t" ? 4 : 1;
    }

    // Skip blank lines or comment-only lines
    if (
      this.pos < this.source.length &&
      (this.peek() === "\n" || this.peek() === "\r" || this.peek() === "#")
    ) {
      return this.nextToken();
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    const tokens: Token[] = [];
    tokens.push({
      type: TokenType.NEWLINE,
      value: "\\n",
      line: startLine,
      col: startCol,
    });

    if (indent > currentIndent) {
      this.indentStack.push(indent);
      tokens.push(this.createToken(TokenType.INDENT, ""));
    } else if (indent < currentIndent) {
      while (indent < this.indentStack[this.indentStack.length - 1]) {
        this.indentStack.pop();
        tokens.push(this.createToken(TokenType.DEDENT, ""));
      }
      if (indent !== this.indentStack[this.indentStack.length - 1]) {
        throw new Error(`Indentation error at line ${this.line}`);
      }
    }

    this.pendingTokens.push(...tokens.slice(1));
    return tokens[0];
  }

  private handleIdentifier(): Token {
    let value = "";
    const startCol = this.col;
    while (this.pos < this.source.length && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    const keywords: Record<string, TokenType> = {
      def: TokenType.DEF,
      return: TokenType.RETURN,
      while: TokenType.WHILE,
      do: TokenType.DO,
      from: TokenType.FROM,
      to: TokenType.TO,
      if: TokenType.IF,
      elif: TokenType.ELIF,
      else: TokenType.ELSE,
      for: TokenType.FOR,
      in: TokenType.IN,
      and: TokenType.AND,
      or: TokenType.OR,
      not: TokenType.NOT,
      True: TokenType.TRUE,
      False: TokenType.FALSE,
    };

    const type = keywords[value] || TokenType.IDENTIFIER;
    if (type === TokenType.IDENTIFIER && value.startsWith("__tmp")) {
      throw new Error(
        `User-defined identifiers starting with '__tmp' are reserved at line ${this.line}, col ${startCol}`,
      );
    }
    return { type, value, line: this.line, col: startCol };
  }

  private handleNumber(): Token {
    let value = "";
    const startCol = this.col;
    while (this.pos < this.source.length && this.isDigit(this.peek())) {
      value += this.advance();
    }
    return { type: TokenType.NUMBER, value, line: this.line, col: startCol };
  }

  private handleString(
    quote: string,
    isFString: boolean = false,
    startCol: number = this.col,
  ): Token {
    let value = "";
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === "\n") {
        throw new Error(`Unterminated string at line ${this.line}`);
      }
      value += this.advance();
    }

    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at line ${this.line}`);
    }

    this.advance(); // Skip closing quote
    return {
      type: isFString ? TokenType.FSTRING : TokenType.STRING,
      value,
      line: this.line,
      col: startCol,
    };
  }

  private skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const char = this.peek();
      if (char === " " || char === "\t") {
        this.advance();
      } else if (char === "#") {
        while (
          this.pos < this.source.length &&
          this.peek() !== "\n" &&
          this.peek() !== "\r"
        ) {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private peek(): string {
    return this.source[this.pos];
  }

  private peekNext(): string {
    if (this.pos + 1 >= this.source.length) return "";
    return this.source[this.pos + 1];
  }

  private advance(): string {
    const char = this.source[this.pos++];
    this.col++;
    return char;
  }

  private createToken(type: TokenType, value: string): Token {
    return { type, value, line: this.line, col: this.col };
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
