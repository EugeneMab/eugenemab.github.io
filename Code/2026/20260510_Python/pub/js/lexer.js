// src/lexer.ts
export var TokenType;
(function (TokenType) {
    TokenType["DEF"] = "DEF";
    TokenType["RETURN"] = "RETURN";
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["EQUALS"] = "EQUALS";
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["COLON"] = "COLON";
    TokenType["WHILE"] = "WHILE";
    TokenType["TRUE"] = "TRUE";
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["INDENT"] = "INDENT";
    TokenType["DEDENT"] = "DEDENT";
    TokenType["EOF"] = "EOF";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
})(TokenType || (TokenType = {}));
export class Lexer {
    source;
    pos = 0;
    line = 1;
    col = 1;
    indentStack = [0];
    pendingTokens = [];
    constructor(source) {
        this.source = source;
    }
    tokenize() {
        console.log("Lexer: Starting tokenization of source length:", this.source.length);
        const tokens = [];
        let token;
        do {
            token = this.nextToken();
            console.log(`Lexer: Produced token [${token.type}] "${token.value}"`);
            tokens.push(token);
        } while (token.type !== TokenType.EOF);
        console.log("Lexer: Tokenization complete. Total tokens:", tokens.length);
        return tokens;
    }
    nextToken() {
        if (this.pendingTokens.length > 0) {
            return this.pendingTokens.shift();
        }
        this.skipWhitespaceAndComments();
        if (this.pos >= this.source.length) {
            // Handle remaining dedents at EOF
            while (this.indentStack.length > 1) {
                this.indentStack.pop();
                this.pendingTokens.push(this.createToken(TokenType.DEDENT, ""));
            }
            if (this.pendingTokens.length > 0)
                return this.pendingTokens.shift();
            return this.createToken(TokenType.EOF, "");
        }
        const char = this.peek();
        // Handle Newlines and Indentation
        if (char === "\n" || char === "\r") {
            const lineToken = this.handleNewline();
            if (lineToken)
                return lineToken;
            return this.nextToken(); // Recurse if indentation produced pending tokens
        }
        // Identifiers and Keywords
        if (this.isAlpha(char)) {
            return this.handleIdentifier();
        }
        // Numbers
        if (this.isDigit(char)) {
            return this.handleNumber();
        }
        // Operators and Punctuation
        this.advance();
        switch (char) {
            case "=":
                return this.createToken(TokenType.EQUALS, "=");
            case "+":
                return this.createToken(TokenType.PLUS, "+");
            case "-":
                return this.createToken(TokenType.MINUS, "-");
            case ":":
                return this.createToken(TokenType.COLON, ":");
            case "(":
                return this.createToken(TokenType.LPAREN, "(");
            case ")":
                return this.createToken(TokenType.RPAREN, ")");
            default:
                throw new Error(`Unexpected character: ${char} at line ${this.line}, col ${this.col}`);
        }
    }
    handleNewline() {
        const startLine = this.line;
        const startCol = this.col;
        // Consume all newline characters
        while (this.pos < this.source.length &&
            (this.peek() === "\n" || this.peek() === "\r")) {
            const c = this.advance();
            if (c === "\n") {
                this.line++;
                this.col = 1;
            }
        }
        // Measure indentation of the next line
        let indent = 0;
        while (this.pos < this.source.length &&
            (this.peek() === " " || this.peek() === "\t")) {
            const c = this.advance();
            indent += c === "\t" ? 4 : 1;
        }
        // Skip blank lines or comment-only lines
        if (this.pos < this.source.length &&
            (this.peek() === "\n" || this.peek() === "\r" || this.peek() === "#")) {
            return this.nextToken();
        }
        const currentIndent = this.indentStack[this.indentStack.length - 1];
        const tokens = [];
        tokens.push({
            type: TokenType.NEWLINE,
            value: "\\n",
            line: startLine,
            col: startCol,
        });
        if (indent > currentIndent) {
            this.indentStack.push(indent);
            tokens.push(this.createToken(TokenType.INDENT, ""));
        }
        else if (indent < currentIndent) {
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
    handleIdentifier() {
        let value = "";
        const startCol = this.col;
        while (this.pos < this.source.length && this.isAlphaNumeric(this.peek())) {
            value += this.advance();
        }
        const keywords = {
            def: TokenType.DEF,
            return: TokenType.RETURN,
            while: TokenType.WHILE,
            True: TokenType.TRUE,
        };
        const type = keywords[value] || TokenType.IDENTIFIER;
        return { type, value, line: this.line, col: startCol };
    }
    handleNumber() {
        let value = "";
        const startCol = this.col;
        while (this.pos < this.source.length && this.isDigit(this.peek())) {
            value += this.advance();
        }
        return { type: TokenType.NUMBER, value, line: this.line, col: startCol };
    }
    skipWhitespaceAndComments() {
        while (this.pos < this.source.length) {
            const char = this.peek();
            if (char === " " || char === "\t") {
                this.advance();
            }
            else if (char === "#") {
                while (this.pos < this.source.length &&
                    this.peek() !== "\n" &&
                    this.peek() !== "\r") {
                    this.advance();
                }
            }
            else {
                break;
            }
        }
    }
    peek() {
        return this.source[this.pos];
    }
    advance() {
        const char = this.source[this.pos++];
        this.col++;
        return char;
    }
    createToken(type, value) {
        return { type, value, line: this.line, col: this.col };
    }
    isAlpha(char) {
        return /[a-zA-Z_]/.test(char);
    }
    isDigit(char) {
        return /[0-9]/.test(char);
    }
    isAlphaNumeric(char) {
        return this.isAlpha(char) || this.isDigit(char);
    }
}
