import { formatError } from "./error.js";

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
  FOR,
  IN,
  RETURN,
  BREAK,
  CONTINUE,
  STRUCT,
  ENUM,
  IMPL,
  SELF,
  SELF_TYPE,
  PANIC,
  TRUE,
  FALSE,
  MATCH,
  FAT_ARROW,

  // Literals
  INTEGER,
  HEX,
  STRING,
  BYTE_LITERAL,
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
  DOT_DOT,
  COLON,
  COLON_COLON,
  SEMICOLON,
  ARROW,
  PLUS,
  MINUS,
  STAR,
  SLASH,
  PERCENT,
  AMPERSAND,
  AND_AND,
  PIPE,
  OR_OR,
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
  HASH,

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
  for: TokenType.FOR,
  in: TokenType.IN,
  return: TokenType.RETURN,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  struct: TokenType.STRUCT,
  enum: TokenType.ENUM,
  impl: TokenType.IMPL,
  self: TokenType.SELF,
  Self: TokenType.SELF_TYPE,
  panic: TokenType.PANIC,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  match: TokenType.MATCH,
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

      if (this.input.startsWith("b'", this.pos)) {
        tokens.push(this.readByteLiteral());
        continue;
      }

      // Char literal like 'e' or '\n'
      if (char === "'" && this.input[this.pos + 2] === "'") {
        tokens.push(this.readCharLiteral());
        continue;
      }

      // Lifetime annotation like 'static
      if (char === "'" && /[a-zA-Z_]/.test(this.input[this.pos + 1] || "")) {
        tokens.push(this.readLifetime());
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

      if (this.match("..")) {
        tokens.push({
          type: TokenType.DOT_DOT,
          value: "..",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("&&")) {
        tokens.push({
          type: TokenType.AND_AND,
          value: "&&",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("||")) {
        tokens.push({
          type: TokenType.OR_OR,
          value: "||",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("::")) {
        tokens.push({
          type: TokenType.COLON_COLON,
          value: "::",
          line: startLine,
          col: startCol,
        });
        continue;
      }

      if (this.match("=>")) {
        tokens.push({
          type: TokenType.FAT_ARROW,
          value: "=>",
          line: startLine,
          col: startCol,
        });
        continue;
      }
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
        "#": TokenType.HASH,
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

      const t = {
        type: TokenType.EOF,
        value: char,
        line: this.line,
        col: this.col,
      };
      throw new Error(
        formatError(this.input, `Unexpected character: ${char}`, t as any),
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

  private readByteLiteral(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // skip 'b'
    this.advance(); // skip '
    let value = "";
    if (this.input[this.pos] === "\\") {
      this.advance(); // skip \
      const escaped = this.advance();
      if (escaped === "n") value = "\n";
      else if (escaped === "r") value = "\r";
      else if (escaped === "t") value = "\t";
      else if (escaped === "\\") value = "\\";
      else if (escaped === "'") value = "'";
      else if (escaped === "0") value = "\0";
      else {
        const t = {
          type: TokenType.EOF,
          value: escaped,
          line: this.line,
          col: this.col,
        };
        throw new Error(
          formatError(
            this.input,
            `Unknown escape sequence: \\${escaped}`,
            t as any,
          ),
        );
      }
    } else {
      value = this.advance();
    }
    this.consumeByteLiteralEnd();
    return {
      type: TokenType.BYTE_LITERAL,
      value: value.charCodeAt(0).toString(),
      line: startLine,
      col: startCol,
    };
  }

  private readCharLiteral(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // skip opening '\"' (')
    let value = "";
    if (this.input[this.pos] === "\\") {
      this.advance();
      const escaped = this.advance();
      if (escaped === "n") value = "\n";
      else if (escaped === "r") value = "\r";
      else if (escaped === "t") value = "\t";
      else if (escaped === "\\") value = "\\";
      else if (escaped === "'") value = "'";
      else if (escaped === "0") value = "\0";
      else {
        const t = {
          type: TokenType.EOF,
          value: escaped,
          line: this.line,
          col: this.col,
        };
        throw new Error(
          formatError(
            this.input,
            `Unknown escape sequence: \\${escaped}`,
            t as any,
          ),
        );
      }
    } else {
      value = this.advance();
    }
    this.consumeByteLiteralEnd();
    return {
      type: TokenType.BYTE_LITERAL,
      value: value.charCodeAt(0).toString(),
      line: startLine,
      col: startCol,
    };
  }

  private consumeByteLiteralEnd() {
    if (this.input[this.pos] !== "'") {
      const t = {
        type: TokenType.EOF,
        value: this.input[this.pos] || "",
        line: this.line,
        col: this.col,
      };
      throw new Error(
        formatError(
          this.input,
          `Expected ' at end of byte literal, found ${this.input[this.pos]}`,
          t as any,
        ),
      );
    }
    this.advance();
  }

  private readLifetime(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // skip '\''
    let value = "'";
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_]/.test(this.input[this.pos])
    ) {
      value += this.advance();
    }
    // Treat lifetime as identifier token value like 'static
    return {
      type: TokenType.IDENTIFIER,
      value,
      line: startLine,
      col: startCol,
    };
  }
}
