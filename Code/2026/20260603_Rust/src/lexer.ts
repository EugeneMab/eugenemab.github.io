export enum TokenType {
  // Keywords
  FN,
  LET,
  CONST,
  MUT,
  IF,
  ELSE,
  LOOP,
  WHILE,
  BREAK,
  CONTINUE,
  STRUCT,
  IMPL,
  PANIC,
  TRUE,
  FALSE,

  // Literals
  INTEGER,
  HEX,
  STRING,
  IDENTIFIER,

  // Symbols
  LPAREN,
  RPAREN,
  LBRACE,
  RBRACE,
  LBRACKET,
  RBRACKET,
  COMMA,
  DOT,
  COLON,
  SEMICOLON,
  ARROW,
  PLUS,
  MINUS,
  STAR,
  SLASH,
  PERCENT,
  AMPERSAND,
  PIPE,
  CARET,
  LSHIFT,
  RSHIFT,
  EQUALS,
  EQ_EQ,
  NE_EQ,
  LT,
  GT,
  LT_EQ,
  GT_EQ,
  EXCLAMATION,

  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS: Record<string, TokenType> = {
  fn: TokenType.FN,
  let: TokenType.LET,
  const: TokenType.CONST,
  mut: TokenType.MUT,
  if: TokenType.IF,
  else: TokenType.ELSE,
  loop: TokenType.LOOP,
  while: TokenType.WHILE,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  struct: TokenType.STRUCT,
  impl: TokenType.IMPL,
  panic: TokenType.PANIC,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
};

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (this.match("//")) {
        while (this.pos < this.input.length && this.input[this.pos] !== "\n") {
          this.advance();
        }
        continue;
      }

      if (/\s/.test(char)) {
        if (char === "\n") {
          this.line++;
          this.col = 1;
        } else {
          this.col++;
        }
        this.pos++;
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        tokens.push(this.readIdentifierOrKeyword());
        continue;
      }

      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (char === '"') {
        tokens.push(this.readString());
        continue;
      }

      const startLine = this.line;
      const startCol = this.col;

      if (this.match("->")) {
        tokens.push({
          type: TokenType.ARROW,
          value: "->",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("<<")) {
        tokens.push({
          type: TokenType.LSHIFT,
          value: "<<",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match(">>")) {
        tokens.push({
          type: TokenType.RSHIFT,
          value: ">>",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("==")) {
        tokens.push({
          type: TokenType.EQ_EQ,
          value: "==",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("!=")) {
        tokens.push({
          type: TokenType.NE_EQ,
          value: "!=",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("<=")) {
        tokens.push({
          type: TokenType.LT_EQ,
          value: "<=",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match(">=")) {
        tokens.push({
          type: TokenType.GT_EQ,
          value: ">=",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      const symbols: Record<string, TokenType> = {
        "(": TokenType.LPAREN,
        ")": TokenType.RPAREN,
        "{": TokenType.LBRACE,
        "}": TokenType.RBRACE,
        "[": TokenType.LBRACKET,
        "]": TokenType.RBRACKET,
        ",": TokenType.COMMA,
        ".": TokenType.DOT,
        ":": TokenType.COLON,
        ";": TokenType.SEMICOLON,
        "+": TokenType.PLUS,
        "-": TokenType.MINUS,
        "*": TokenType.STAR,
        "/": TokenType.SLASH,
        "%": TokenType.PERCENT,
        "&": TokenType.AMPERSAND,
        "|": TokenType.PIPE,
        "^": TokenType.CARET,
        "=": TokenType.EQUALS,
        "<": TokenType.LT,
        ">": TokenType.GT,
        "!": TokenType.EXCLAMATION,
      };

      if (char in symbols) {
        tokens.push({
          type: symbols[char],
          value: char,
          line: startLine,
          col: startCol,
        });
        this.advance();
        continue;
      }

      throw new Error(
        `Unexpected character: ${char} at line ${this.line}:${this.col}`,
      );
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      line: this.line,
      col: this.col,
    });
    return tokens;
  }

  private advance(): string {
    const char = this.input[this.pos++];
    if (char === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return char;
  }

  private match(str: string): boolean {
    if (this.input.startsWith(str, this.pos)) {
      for (let i = 0; i < str.length; i++) this.advance();
      return true;
    }
    return false;
  }

  private readIdentifierOrKeyword(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = "";
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_]/.test(this.input[this.pos])
    ) {
      value += this.advance();
    }
    const type = KEYWORDS[value] ?? TokenType.IDENTIFIER;
    return { type, value, line: startLine, col: startCol };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = "";
    if (this.input.startsWith("0x", this.pos)) {
      value += this.advance(); // 0
      value += this.advance(); // x
      while (
        this.pos < this.input.length &&
        /[0-9a-fA-F]/.test(this.input[this.pos])
      ) {
        value += this.advance();
      }
      return { type: TokenType.HEX, value, line: startLine, col: startCol };
    }

    while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
      value += this.advance();
    }
    return { type: TokenType.INTEGER, value, line: startLine, col: startCol };
  }

  private readString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // skip opening quote
    let value = "";
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      value += this.advance();
    }
    this.advance(); // skip closing quote
    return { type: TokenType.STRING, value, line: startLine, col: startCol };
  }
}
