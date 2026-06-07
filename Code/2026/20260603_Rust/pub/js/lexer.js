export var TokenType;
(function (TokenType) {
    // Keywords
    TokenType[TokenType["FN"] = 0] = "FN";
    TokenType[TokenType["LET"] = 1] = "LET";
    TokenType[TokenType["CONST"] = 2] = "CONST";
    TokenType[TokenType["MUT"] = 3] = "MUT";
    TokenType[TokenType["IF"] = 4] = "IF";
    TokenType[TokenType["ELSE"] = 5] = "ELSE";
    TokenType[TokenType["LOOP"] = 6] = "LOOP";
    TokenType[TokenType["BREAK"] = 7] = "BREAK";
    TokenType[TokenType["CONTINUE"] = 8] = "CONTINUE";
    TokenType[TokenType["STRUCT"] = 9] = "STRUCT";
    TokenType[TokenType["IMPL"] = 10] = "IMPL";
    TokenType[TokenType["PANIC"] = 11] = "PANIC";
    // Literals
    TokenType[TokenType["INTEGER"] = 12] = "INTEGER";
    TokenType[TokenType["HEX"] = 13] = "HEX";
    TokenType[TokenType["STRING"] = 14] = "STRING";
    TokenType[TokenType["IDENTIFIER"] = 15] = "IDENTIFIER";
    // Symbols
    TokenType[TokenType["LPAREN"] = 16] = "LPAREN";
    TokenType[TokenType["RPAREN"] = 17] = "RPAREN";
    TokenType[TokenType["LBRACE"] = 18] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 19] = "RBRACE";
    TokenType[TokenType["LBRACKET"] = 20] = "LBRACKET";
    TokenType[TokenType["RBRACKET"] = 21] = "RBRACKET";
    TokenType[TokenType["COMMA"] = 22] = "COMMA";
    TokenType[TokenType["DOT"] = 23] = "DOT";
    TokenType[TokenType["COLON"] = 24] = "COLON";
    TokenType[TokenType["SEMICOLON"] = 25] = "SEMICOLON";
    TokenType[TokenType["ARROW"] = 26] = "ARROW";
    TokenType[TokenType["PLUS"] = 27] = "PLUS";
    TokenType[TokenType["MINUS"] = 28] = "MINUS";
    TokenType[TokenType["STAR"] = 29] = "STAR";
    TokenType[TokenType["SLASH"] = 30] = "SLASH";
    TokenType[TokenType["PERCENT"] = 31] = "PERCENT";
    TokenType[TokenType["AMPERSAND"] = 32] = "AMPERSAND";
    TokenType[TokenType["PIPE"] = 33] = "PIPE";
    TokenType[TokenType["CARET"] = 34] = "CARET";
    TokenType[TokenType["LSHIFT"] = 35] = "LSHIFT";
    TokenType[TokenType["RSHIFT"] = 36] = "RSHIFT";
    TokenType[TokenType["EQUALS"] = 37] = "EQUALS";
    TokenType[TokenType["EQ_EQ"] = 38] = "EQ_EQ";
    TokenType[TokenType["NE_EQ"] = 39] = "NE_EQ";
    TokenType[TokenType["LT"] = 40] = "LT";
    TokenType[TokenType["GT"] = 41] = "GT";
    TokenType[TokenType["LT_EQ"] = 42] = "LT_EQ";
    TokenType[TokenType["GT_EQ"] = 43] = "GT_EQ";
    TokenType[TokenType["EXCLAMATION"] = 44] = "EXCLAMATION";
    TokenType[TokenType["EOF"] = 45] = "EOF";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
    fn: TokenType.FN,
    let: TokenType.LET,
    const: TokenType.CONST,
    mut: TokenType.MUT,
    if: TokenType.IF,
    else: TokenType.ELSE,
    loop: TokenType.LOOP,
    break: TokenType.BREAK,
    continue: TokenType.CONTINUE,
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
