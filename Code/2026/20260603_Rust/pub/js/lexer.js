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
    TokenType[TokenType["TRUE"] = 12] = "TRUE";
    TokenType[TokenType["FALSE"] = 13] = "FALSE";
    // Literals
    TokenType[TokenType["INTEGER"] = 14] = "INTEGER";
    TokenType[TokenType["HEX"] = 15] = "HEX";
    TokenType[TokenType["STRING"] = 16] = "STRING";
    TokenType[TokenType["IDENTIFIER"] = 17] = "IDENTIFIER";
    // Symbols
    TokenType[TokenType["LPAREN"] = 18] = "LPAREN";
    TokenType[TokenType["RPAREN"] = 19] = "RPAREN";
    TokenType[TokenType["LBRACE"] = 20] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 21] = "RBRACE";
    TokenType[TokenType["LBRACKET"] = 22] = "LBRACKET";
    TokenType[TokenType["RBRACKET"] = 23] = "RBRACKET";
    TokenType[TokenType["COMMA"] = 24] = "COMMA";
    TokenType[TokenType["DOT"] = 25] = "DOT";
    TokenType[TokenType["COLON"] = 26] = "COLON";
    TokenType[TokenType["SEMICOLON"] = 27] = "SEMICOLON";
    TokenType[TokenType["ARROW"] = 28] = "ARROW";
    TokenType[TokenType["PLUS"] = 29] = "PLUS";
    TokenType[TokenType["MINUS"] = 30] = "MINUS";
    TokenType[TokenType["STAR"] = 31] = "STAR";
    TokenType[TokenType["SLASH"] = 32] = "SLASH";
    TokenType[TokenType["PERCENT"] = 33] = "PERCENT";
    TokenType[TokenType["AMPERSAND"] = 34] = "AMPERSAND";
    TokenType[TokenType["PIPE"] = 35] = "PIPE";
    TokenType[TokenType["CARET"] = 36] = "CARET";
    TokenType[TokenType["LSHIFT"] = 37] = "LSHIFT";
    TokenType[TokenType["RSHIFT"] = 38] = "RSHIFT";
    TokenType[TokenType["EQUALS"] = 39] = "EQUALS";
    TokenType[TokenType["EQ_EQ"] = 40] = "EQ_EQ";
    TokenType[TokenType["NE_EQ"] = 41] = "NE_EQ";
    TokenType[TokenType["LT"] = 42] = "LT";
    TokenType[TokenType["GT"] = 43] = "GT";
    TokenType[TokenType["LT_EQ"] = 44] = "LT_EQ";
    TokenType[TokenType["GT_EQ"] = 45] = "GT_EQ";
    TokenType[TokenType["EXCLAMATION"] = 46] = "EXCLAMATION";
    TokenType[TokenType["EOF"] = 47] = "EOF";
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
    true: TokenType.TRUE,
    false: TokenType.FALSE,
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
