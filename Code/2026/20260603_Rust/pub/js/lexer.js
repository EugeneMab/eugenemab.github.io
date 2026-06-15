import { formatError } from "./error.js";
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
    TokenType[TokenType["WHILE"] = 7] = "WHILE";
    TokenType[TokenType["FOR"] = 8] = "FOR";
    TokenType[TokenType["IN"] = 9] = "IN";
    TokenType[TokenType["RETURN"] = 10] = "RETURN";
    TokenType[TokenType["BREAK"] = 11] = "BREAK";
    TokenType[TokenType["CONTINUE"] = 12] = "CONTINUE";
    TokenType[TokenType["STRUCT"] = 13] = "STRUCT";
    TokenType[TokenType["ENUM"] = 14] = "ENUM";
    TokenType[TokenType["IMPL"] = 15] = "IMPL";
    TokenType[TokenType["SELF"] = 16] = "SELF";
    TokenType[TokenType["SELF_TYPE"] = 17] = "SELF_TYPE";
    TokenType[TokenType["PANIC"] = 18] = "PANIC";
    TokenType[TokenType["TRUE"] = 19] = "TRUE";
    TokenType[TokenType["FALSE"] = 20] = "FALSE";
    TokenType[TokenType["MATCH"] = 21] = "MATCH";
    TokenType[TokenType["FAT_ARROW"] = 22] = "FAT_ARROW";
    // Literals
    TokenType[TokenType["INTEGER"] = 23] = "INTEGER";
    TokenType[TokenType["HEX"] = 24] = "HEX";
    TokenType[TokenType["STRING"] = 25] = "STRING";
    TokenType[TokenType["BYTE_LITERAL"] = 26] = "BYTE_LITERAL";
    TokenType[TokenType["IDENTIFIER"] = 27] = "IDENTIFIER";
    // Symbols
    TokenType[TokenType["LPAREN"] = 28] = "LPAREN";
    TokenType[TokenType["RPAREN"] = 29] = "RPAREN";
    TokenType[TokenType["LBRACE"] = 30] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 31] = "RBRACE";
    TokenType[TokenType["LBRACKET"] = 32] = "LBRACKET";
    TokenType[TokenType["RBRACKET"] = 33] = "RBRACKET";
    TokenType[TokenType["COMMA"] = 34] = "COMMA";
    TokenType[TokenType["DOT"] = 35] = "DOT";
    TokenType[TokenType["DOT_DOT"] = 36] = "DOT_DOT";
    TokenType[TokenType["COLON"] = 37] = "COLON";
    TokenType[TokenType["COLON_COLON"] = 38] = "COLON_COLON";
    TokenType[TokenType["SEMICOLON"] = 39] = "SEMICOLON";
    TokenType[TokenType["ARROW"] = 40] = "ARROW";
    TokenType[TokenType["PLUS"] = 41] = "PLUS";
    TokenType[TokenType["MINUS"] = 42] = "MINUS";
    TokenType[TokenType["STAR"] = 43] = "STAR";
    TokenType[TokenType["SLASH"] = 44] = "SLASH";
    TokenType[TokenType["PERCENT"] = 45] = "PERCENT";
    TokenType[TokenType["AMPERSAND"] = 46] = "AMPERSAND";
    TokenType[TokenType["AND_AND"] = 47] = "AND_AND";
    TokenType[TokenType["PIPE"] = 48] = "PIPE";
    TokenType[TokenType["OR_OR"] = 49] = "OR_OR";
    TokenType[TokenType["CARET"] = 50] = "CARET";
    TokenType[TokenType["LSHIFT"] = 51] = "LSHIFT";
    TokenType[TokenType["RSHIFT"] = 52] = "RSHIFT";
    TokenType[TokenType["EQUALS"] = 53] = "EQUALS";
    TokenType[TokenType["EQ_EQ"] = 54] = "EQ_EQ";
    TokenType[TokenType["NE_EQ"] = 55] = "NE_EQ";
    TokenType[TokenType["LT"] = 56] = "LT";
    TokenType[TokenType["GT"] = 57] = "GT";
    TokenType[TokenType["LT_EQ"] = 58] = "LT_EQ";
    TokenType[TokenType["GT_EQ"] = 59] = "GT_EQ";
    TokenType[TokenType["EXCLAMATION"] = 60] = "EXCLAMATION";
    TokenType[TokenType["HASH"] = 61] = "HASH";
    TokenType[TokenType["EOF"] = 62] = "EOF";
})(TokenType || (TokenType = {}));
const KEYWORDS = {
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
            throw new Error(formatError(this.input, `Unexpected character: ${char}`, t));
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
    readByteLiteral() {
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // skip 'b'
        this.advance(); // skip '
        let value = "";
        if (this.input[this.pos] === "\\") {
            this.advance(); // skip \
            const escaped = this.advance();
            if (escaped === "n")
                value = "\n";
            else if (escaped === "r")
                value = "\r";
            else if (escaped === "t")
                value = "\t";
            else if (escaped === "\\")
                value = "\\";
            else if (escaped === "'")
                value = "'";
            else if (escaped === "0")
                value = "\0";
            else {
                const t = {
                    type: TokenType.EOF,
                    value: escaped,
                    line: this.line,
                    col: this.col,
                };
                throw new Error(formatError(this.input, `Unknown escape sequence: \\${escaped}`, t));
            }
        }
        else {
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
    readCharLiteral() {
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // skip opening '\"' (')
        let value = "";
        if (this.input[this.pos] === "\\") {
            this.advance();
            const escaped = this.advance();
            if (escaped === "n")
                value = "\n";
            else if (escaped === "r")
                value = "\r";
            else if (escaped === "t")
                value = "\t";
            else if (escaped === "\\")
                value = "\\";
            else if (escaped === "'")
                value = "'";
            else if (escaped === "0")
                value = "\0";
            else {
                const t = {
                    type: TokenType.EOF,
                    value: escaped,
                    line: this.line,
                    col: this.col,
                };
                throw new Error(formatError(this.input, `Unknown escape sequence: \\${escaped}`, t));
            }
        }
        else {
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
    consumeByteLiteralEnd() {
        if (this.input[this.pos] !== "'") {
            const t = {
                type: TokenType.EOF,
                value: this.input[this.pos] || "",
                line: this.line,
                col: this.col,
            };
            throw new Error(formatError(this.input, `Expected ' at end of byte literal, found ${this.input[this.pos]}`, t));
        }
        this.advance();
    }
    readLifetime() {
        const startLine = this.line;
        const startCol = this.col;
        this.advance(); // skip '\''
        let value = "'";
        while (this.pos < this.input.length &&
            /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
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
