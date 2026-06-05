export var TokenType;
(function (TokenType) {
    // Keywords
    TokenType[TokenType["FN"] = 0] = "FN";
    TokenType[TokenType["LET"] = 1] = "LET";
    TokenType[TokenType["MUT"] = 2] = "MUT";
    TokenType[TokenType["IF"] = 3] = "IF";
    TokenType[TokenType["ELSE"] = 4] = "ELSE";
    TokenType[TokenType["LOOP"] = 5] = "LOOP";
    TokenType[TokenType["STRUCT"] = 6] = "STRUCT";
    TokenType[TokenType["IMPL"] = 7] = "IMPL";
    TokenType[TokenType["PANIC"] = 8] = "PANIC";
    // Literals
    TokenType[TokenType["INTEGER"] = 9] = "INTEGER";
    TokenType[TokenType["HEX"] = 10] = "HEX";
    TokenType[TokenType["STRING"] = 11] = "STRING";
    TokenType[TokenType["IDENTIFIER"] = 12] = "IDENTIFIER";
    // Symbols
    TokenType[TokenType["LPAREN"] = 13] = "LPAREN";
    TokenType[TokenType["RPAREN"] = 14] = "RPAREN";
    TokenType[TokenType["LBRACE"] = 15] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 16] = "RBRACE";
    TokenType[TokenType["LBRACKET"] = 17] = "LBRACKET";
    TokenType[TokenType["RBRACKET"] = 18] = "RBRACKET";
    TokenType[TokenType["COMMA"] = 19] = "COMMA";
    TokenType[TokenType["DOT"] = 20] = "DOT";
    TokenType[TokenType["COLON"] = 21] = "COLON";
    TokenType[TokenType["SEMICOLON"] = 22] = "SEMICOLON";
    TokenType[TokenType["ARROW"] = 23] = "ARROW";
    TokenType[TokenType["PLUS"] = 24] = "PLUS";
    TokenType[TokenType["MINUS"] = 25] = "MINUS";
    TokenType[TokenType["STAR"] = 26] = "STAR";
    TokenType[TokenType["SLASH"] = 27] = "SLASH";
    TokenType[TokenType["PERCENT"] = 28] = "PERCENT";
    TokenType[TokenType["AMPERSAND"] = 29] = "AMPERSAND";
    TokenType[TokenType["PIPE"] = 30] = "PIPE";
    TokenType[TokenType["CARET"] = 31] = "CARET";
    TokenType[TokenType["LSHIFT"] = 32] = "LSHIFT";
    TokenType[TokenType["RSHIFT"] = 33] = "RSHIFT";
    TokenType[TokenType["EQUALS"] = 34] = "EQUALS";
    TokenType[TokenType["EXCLAMATION"] = 35] = "EXCLAMATION";
    TokenType[TokenType["EOF"] = 36] = "EOF";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
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
    pos = 0;
    input;
    constructor(input) {
        this.input = input;
    }
    tokenize() {
        const tokens = [];
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
            const symbols = {
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
    match(str) {
        if (this.input.startsWith(str, this.pos)) {
            this.pos += str.length;
            return true;
        }
        return false;
    }
    readIdentifierOrKeyword() {
        const start = this.pos;
        while (this.pos < this.input.length &&
            /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
            this.pos++;
        }
        const value = this.input.substring(start, this.pos);
        const type = KEYWORDS[value] ?? TokenType.IDENTIFIER;
        return { type, value };
    }
    readNumber() {
        const start = this.pos;
        if (this.input.startsWith("0x", this.pos)) {
            this.pos += 2;
            while (this.pos < this.input.length &&
                /[0-9a-fA-F]/.test(this.input[this.pos])) {
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
    readString() {
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
