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
    line = 1;
    col = 1;
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
                    this.advance();
                }
                continue;
            }
            if (/\s/.test(char)) {
                if (char === "\n") {
                    this.line++;
                    this.col = 1;
                }
                else {
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
                tokens.push({
                    type: symbols[char],
                    value: char,
                    line: startLine,
                    col: startCol,
                });
                this.advance();
                continue;
            }
            throw new Error(`Unexpected character: ${char} at line ${this.line}:${this.col}`);
        }
        tokens.push({
            type: TokenType.EOF,
            value: "",
            line: this.line,
            col: this.col,
        });
        return tokens;
    }
    advance() {
        const char = this.input[this.pos++];
        if (char === "\n") {
            this.line++;
            this.col = 1;
        }
        else {
            this.col++;
        }
        return char;
    }
    match(str) {
        if (this.input.startsWith(str, this.pos)) {
            for (let i = 0; i < str.length; i++)
                this.advance();
            return true;
        }
        return false;
    }
    readIdentifierOrKeyword() {
        const startLine = this.line;
        const startCol = this.col;
        let value = "";
        while (this.pos < this.input.length &&
            /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
            value += this.advance();
        }
        const type = KEYWORDS[value] ?? TokenType.IDENTIFIER;
        return { type, value, line: startLine, col: startCol };
    }
    readNumber() {
        const startLine = this.line;
        const startCol = this.col;
        let value = "";
        if (this.input.startsWith("0x", this.pos)) {
            value += this.advance(); // 0
            value += this.advance(); // x
            while (this.pos < this.input.length &&
                /[0-9a-fA-F]/.test(this.input[this.pos])) {
                value += this.advance();
            }
            return { type: TokenType.HEX, value, line: startLine, col: startCol };
        }
        while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
            value += this.advance();
        }
        return { type: TokenType.INTEGER, value, line: startLine, col: startCol };
    }
    readString() {
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
