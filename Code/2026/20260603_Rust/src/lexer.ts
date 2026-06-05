export enum TokenType {
  // Keywords
  FN,
  LET,
  MUT,
  IF,
  ELSE,
  LOOP,
  STRUCT,
  IMPL,
  PANIC,

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
  EXCLAMATION,

  EOF,
}

export interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS: Record<string, TokenType> = {
  fn: TokenType.FN,
  let: TokenType.LET,
  mut: TokenType.MUT,
  if: TokenType.IF,
  else: TokenType.ELSE,
  loop: TokenType.LOOP,
  struct: TokenType.STRUCT,
  impl: TokenType.IMPL,
  panic: TokenType.PANIC,
};

export class Lexer {
  private pos = 0;
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
          this.pos++;
        }
        continue;
      }

      if (/\s/.test(char)) {
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

      if (this.match("->")) {
        tokens.push({ type: TokenType.ARROW, value: "->" });
        continue;
      }

      if (this.match("<<")) {
        tokens.push({ type: TokenType.LSHIFT, value: "<<" });
        continue;
      }

      if (this.match(">>")) {
        tokens.push({ type: TokenType.RSHIFT, value: ">>" });
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
        "!": TokenType.EXCLAMATION,
      };

      if (char in symbols) {
        tokens.push({ type: symbols[char], value: char });
        this.pos++;
        continue;
      }

      throw new Error(`Unexpected character: ${char} at pos ${this.pos}`);
    }

    tokens.push({ type: TokenType.EOF, value: "" });
    return tokens;
  }

  private match(str: string): boolean {
    if (this.input.startsWith(str, this.pos)) {
      this.pos += str.length;
      return true;
    }
    return false;
  }

  private readIdentifierOrKeyword(): Token {
    const start = this.pos;
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    const value = this.input.substring(start, this.pos);
    const type = KEYWORDS[value] ?? TokenType.IDENTIFIER;
    return { type, value };
  }

  private readNumber(): Token {
    const start = this.pos;
    if (this.input.startsWith("0x", this.pos)) {
      this.pos += 2;
      while (
        this.pos < this.input.length &&
        /[0-9a-fA-F]/.test(this.input[this.pos])
      ) {
        this.pos++;
      }
      return {
        type: TokenType.HEX,
        value: this.input.substring(start, this.pos),
      };
    }

    while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
      this.pos++;
    }
    return {
      type: TokenType.INTEGER,
      value: this.input.substring(start, this.pos),
    };
  }

  private readString(): Token {
    this.pos++; // skip opening quote
    const start = this.pos;
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      this.pos++;
    }
    const value = this.input.substring(start, this.pos);
    this.pos++; // skip closing quote
    return { type: TokenType.STRING, value };
  }
}
