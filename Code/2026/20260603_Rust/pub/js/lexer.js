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
    TokenType[TokenType["MOD"] = 13] = "MOD";
    TokenType[TokenType["PUB"] = 14] = "PUB";
    TokenType[TokenType["USE"] = 15] = "USE";
    TokenType[TokenType["SUPER"] = 16] = "SUPER";
    TokenType[TokenType["CRATE"] = 17] = "CRATE";
    TokenType[TokenType["STRUCT"] = 18] = "STRUCT";
    TokenType[TokenType["ENUM"] = 19] = "ENUM";
    TokenType[TokenType["IMPL"] = 20] = "IMPL";
    TokenType[TokenType["SELF"] = 21] = "SELF";
    TokenType[TokenType["SELF_TYPE"] = 22] = "SELF_TYPE";
    TokenType[TokenType["PANIC"] = 23] = "PANIC";
    TokenType[TokenType["TRUE"] = 24] = "TRUE";
    TokenType[TokenType["FALSE"] = 25] = "FALSE";
    TokenType[TokenType["MATCH"] = 26] = "MATCH";
    TokenType[TokenType["FAT_ARROW"] = 27] = "FAT_ARROW";
    // Literals
    TokenType[TokenType["INTEGER"] = 28] = "INTEGER";
    TokenType[TokenType["HEX"] = 29] = "HEX";
    TokenType[TokenType["STRING"] = 30] = "STRING";
    TokenType[TokenType["BYTE_LITERAL"] = 31] = "BYTE_LITERAL";
    TokenType[TokenType["IDENTIFIER"] = 32] = "IDENTIFIER";
    // Symbols
    TokenType[TokenType["LPAREN"] = 33] = "LPAREN";
    TokenType[TokenType["RPAREN"] = 34] = "RPAREN";
    TokenType[TokenType["LBRACE"] = 35] = "LBRACE";
    TokenType[TokenType["RBRACE"] = 36] = "RBRACE";
    TokenType[TokenType["LBRACKET"] = 37] = "LBRACKET";
    TokenType[TokenType["RBRACKET"] = 38] = "RBRACKET";
    TokenType[TokenType["COMMA"] = 39] = "COMMA";
    TokenType[TokenType["DOT"] = 40] = "DOT";
    TokenType[TokenType["DOT_DOT"] = 41] = "DOT_DOT";
    TokenType[TokenType["COLON"] = 42] = "COLON";
    TokenType[TokenType["COLON_COLON"] = 43] = "COLON_COLON";
    TokenType[TokenType["SEMICOLON"] = 44] = "SEMICOLON";
    TokenType[TokenType["ARROW"] = 45] = "ARROW";
    TokenType[TokenType["PLUS"] = 46] = "PLUS";
    TokenType[TokenType["MINUS"] = 47] = "MINUS";
    TokenType[TokenType["STAR"] = 48] = "STAR";
    TokenType[TokenType["SLASH"] = 49] = "SLASH";
    TokenType[TokenType["PERCENT"] = 50] = "PERCENT";
    TokenType[TokenType["AMPERSAND"] = 51] = "AMPERSAND";
    TokenType[TokenType["AND_AND"] = 52] = "AND_AND";
    TokenType[TokenType["PIPE"] = 53] = "PIPE";
    TokenType[TokenType["OR_OR"] = 54] = "OR_OR";
    TokenType[TokenType["CARET"] = 55] = "CARET";
    TokenType[TokenType["LSHIFT"] = 56] = "LSHIFT";
    TokenType[TokenType["RSHIFT"] = 57] = "RSHIFT";
    TokenType[TokenType["EQUALS"] = 58] = "EQUALS";
    TokenType[TokenType["EQ_EQ"] = 59] = "EQ_EQ";
    TokenType[TokenType["NE_EQ"] = 60] = "NE_EQ";
    TokenType[TokenType["LT"] = 61] = "LT";
    TokenType[TokenType["GT"] = 62] = "GT";
    TokenType[TokenType["LT_EQ"] = 63] = "LT_EQ";
    TokenType[TokenType["GT_EQ"] = 64] = "GT_EQ";
    TokenType[TokenType["EXCLAMATION"] = 65] = "EXCLAMATION";
    TokenType[TokenType["HASH"] = 66] = "HASH";
    TokenType[TokenType["EOF"] = 67] = "EOF";
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
    mod: TokenType.MOD,
    pub: TokenType.PUB,
    use: TokenType.USE,
    super: TokenType.SUPER,
    crate: TokenType.CRATE,
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
