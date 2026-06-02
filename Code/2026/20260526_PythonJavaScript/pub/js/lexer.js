// src/lexer.ts
export var TokenType;
(function (TokenType) {
    TokenType["DEF"] = "DEF";
    TokenType["RETURN"] = "RETURN";
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["EQUALS"] = "EQUALS";
    TokenType["EQUALS_EQUALS"] = "EQUALS_EQUALS";
    TokenType["NOT_EQUALS"] = "NOT_EQUALS";
    TokenType["LESS"] = "LESS";
    TokenType["GREATER"] = "GREATER";
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["STAR_STAR"] = "STAR_STAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["SLASH_SLASH"] = "SLASH_SLASH";
    TokenType["PERCENT"] = "PERCENT";
    TokenType["AMPERSAND"] = "AMPERSAND";
    TokenType["PIPE"] = "PIPE";
    TokenType["CARET"] = "CARET";
    TokenType["TILDE"] = "TILDE";
    TokenType["LESS_LESS"] = "LESS_LESS";
    TokenType["GREATER_GREATER"] = "GREATER_GREATER";
    TokenType["LESS_EQUALS"] = "LESS_EQUALS";
    TokenType["GREATER_EQUALS"] = "GREATER_EQUALS";
    TokenType["COLON"] = "COLON";
    TokenType["WHILE"] = "WHILE";
    TokenType["IF"] = "IF";
    TokenType["ELIF"] = "ELIF";
    TokenType["ELSE"] = "ELSE";
    TokenType["FOR"] = "FOR";
    TokenType["IN"] = "IN";
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    TokenType["TRUE"] = "TRUE";
    TokenType["FALSE"] = "FALSE";
    TokenType["PASS"] = "PASS";
    TokenType["GLOBAL"] = "GLOBAL";
    TokenType["NONLOCAL"] = "NONLOCAL";
    TokenType["LAMBDA"] = "LAMBDA";
    TokenType["CLASS"] = "CLASS";
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["INDENT"] = "INDENT";
    TokenType["DEDENT"] = "DEDENT";
    TokenType["EOF"] = "EOF";
    TokenType["LPAREN"] = "LPAREN";
    TokenType["RPAREN"] = "RPAREN";
    TokenType["COMMA"] = "COMMA";
    TokenType["LSQUARE"] = "LSQUARE";
    TokenType["RSQUARE"] = "RSQUARE";
    TokenType["LBRACE"] = "LBRACE";
    TokenType["RBRACE"] = "RBRACE";
    TokenType["DOT"] = "DOT";
    TokenType["STRING"] = "STRING";
    TokenType["FSTRING"] = "FSTRING";
    TokenType["BYTES"] = "BYTES";
    TokenType["DO"] = "DO";
    TokenType["FROM"] = "FROM";
    TokenType["TO"] = "TO";
    TokenType["YIELD"] = "YIELD";
    TokenType["WITH"] = "WITH";
    TokenType["AS"] = "AS";
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
        const tokens = [];
        let token;
        do {
            token = this.nextToken();
            tokens.push(token);
        } while (token.type !== TokenType.EOF);
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
            const next = this.peekNext();
            if ((char === "f" || char === "F") && (next === '"' || next === "'")) {
                const startCol = this.col;
                this.advance(); // consume 'f'
                return this.handleString(this.advance(), true, startCol); // consume quote
            }
            if ((char === "r" || char === "R") && (next === '"' || next === "'")) {
                const startCol = this.col;
                this.advance(); // consume 'r'
                return this.handleString(this.advance(), false, startCol, true); // consume quote
            }
            if ((char === "b" || char === "B") && (next === '"' || next === "'")) {
                const startCol = this.col;
                this.advance(); // consume 'b'
                return this.handleString(this.advance(), false, startCol, false, true); // consume quote
            }
            return this.handleIdentifier();
        }
        // Numbers
        if (this.isDigit(char)) {
            return this.handleNumber();
        }
        // Strings
        if (char === '"' || char === "'") {
            const startCol = this.col;
            this.advance(); // Skip opening quote
            return this.handleString(char, false, startCol);
        }
        // Operators and Punctuation
        const startCol = this.col;
        this.advance();
        switch (char) {
            case "=":
                if (this.peek() === "=") {
                    this.advance();
                    return this.createToken(TokenType.EQUALS_EQUALS, "==", startCol);
                }
                return this.createToken(TokenType.EQUALS, "=", startCol);
            case "!":
                if (this.peek() === "=") {
                    this.advance();
                    return this.createToken(TokenType.NOT_EQUALS, "!=", startCol);
                }
                throw new Error(`Unexpected character: ! at line ${this.line}`);
            case "<":
                if (this.peek() === "<") {
                    this.advance();
                    return this.createToken(TokenType.LESS_LESS, "<<", startCol);
                }
                if (this.peek() === "=") {
                    this.advance();
                    return this.createToken(TokenType.LESS_EQUALS, "<=", startCol);
                }
                return this.createToken(TokenType.LESS, "<", startCol);
            case ">":
                if (this.peek() === ">") {
                    this.advance();
                    return this.createToken(TokenType.GREATER_GREATER, ">>", startCol);
                }
                if (this.peek() === "=") {
                    this.advance();
                    return this.createToken(TokenType.GREATER_EQUALS, ">=", startCol);
                }
                return this.createToken(TokenType.GREATER, ">", startCol);
            case "+":
                return this.createToken(TokenType.PLUS, "+", startCol);
            case "-":
                return this.createToken(TokenType.MINUS, "-", startCol);
            case "*":
                if (this.peek() === "*") {
                    this.advance();
                    return this.createToken(TokenType.STAR_STAR, "**", startCol);
                }
                return this.createToken(TokenType.STAR, "*", startCol);
            case "/":
                if (this.peek() === "/") {
                    this.advance();
                    return this.createToken(TokenType.SLASH_SLASH, "//", startCol);
                }
                return this.createToken(TokenType.SLASH, "/", startCol);
            case "%":
                return this.createToken(TokenType.PERCENT, "%", startCol);
            case "&":
                return this.createToken(TokenType.AMPERSAND, "&", startCol);
            case "|":
                return this.createToken(TokenType.PIPE, "|", startCol);
            case "^":
                return this.createToken(TokenType.CARET, "^", startCol);
            case "~":
                return this.createToken(TokenType.TILDE, "~", startCol);
            case ":":
                return this.createToken(TokenType.COLON, ":", startCol);
            case ".":
                return this.createToken(TokenType.DOT, ".", startCol);
            case "(":
                return this.createToken(TokenType.LPAREN, "(", startCol);
            case ")":
                return this.createToken(TokenType.RPAREN, ")", startCol);
            case ",":
                return this.createToken(TokenType.COMMA, ",", startCol);
            case "[":
                return this.createToken(TokenType.LSQUARE, "[", startCol);
            case "]":
                return this.createToken(TokenType.RSQUARE, "]", startCol);
            case "{":
                return this.createToken(TokenType.LBRACE, "{", startCol);
            case "}":
                return this.createToken(TokenType.RBRACE, "}", startCol);
            default:
                throw new Error(`Unexpected character: ${char} at line ${this.line}, col ${startCol}`);
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
            do: TokenType.DO,
            from: TokenType.FROM,
            to: TokenType.TO,
            yield: TokenType.YIELD,
            if: TokenType.IF,
            elif: TokenType.ELIF,
            else: TokenType.ELSE,
            for: TokenType.FOR,
            in: TokenType.IN,
            and: TokenType.AND,
            or: TokenType.OR,
            not: TokenType.NOT,
            pass: TokenType.PASS,
            global: TokenType.GLOBAL,
            nonlocal: TokenType.NONLOCAL,
            lambda: TokenType.LAMBDA,
            class: TokenType.CLASS,
            with: TokenType.WITH,
            as: TokenType.AS,
            True: TokenType.TRUE,
            False: TokenType.FALSE,
        };
        const type = keywords[value] || TokenType.IDENTIFIER;
        if (type === TokenType.IDENTIFIER &&
            value.startsWith("__") &&
            !value.endsWith("__")) {
            throw new Error(`User-defined identifiers starting with '__' (and not ending with '__') are reserved at line ${this.line}, col ${startCol}`);
        }
        return { type, value, line: this.line, col: startCol };
    }
    handleNumber() {
        let value = "";
        const startCol = this.col;
        while (this.pos < this.source.length && this.isDigit(this.peek())) {
            value += this.advance();
        }
        if (this.pos < this.source.length &&
            this.peek() === "." &&
            this.isDigit(this.peekNext())) {
            value += this.advance(); // consume '.'
            while (this.pos < this.source.length && this.isDigit(this.peek())) {
                value += this.advance();
            }
        }
        return { type: TokenType.NUMBER, value, line: this.line, col: startCol };
    }
    handleString(quote, isFString = false, startCol = this.col, isRaw = false, isBytes = false) {
        let value = "";
        while (this.pos < this.source.length && this.peek() !== quote) {
            if (this.peek() === "\n") {
                throw new Error(`Unterminated string at line ${this.line}`);
            }
            if (this.peek() === "\\") {
                if (isRaw) {
                    if (this.peekNext() === quote) {
                        value += this.advance(); // consume '\'
                        value += this.advance(); // consume quote
                    }
                    else {
                        value += this.advance();
                    }
                }
                else {
                    this.advance(); // Skip backslash
                    const escaped = this.advance();
                    switch (escaped) {
                        case "n":
                            value += "\n";
                            break;
                        case "t":
                            value += "\t";
                            break;
                        case "r":
                            value += "\r";
                            break;
                        case "\\":
                            value += "\\";
                            break;
                        case "'":
                            value += "'";
                            break;
                        case '"':
                            value += '"';
                            break;
                        default:
                            value += "\\" + escaped;
                            break;
                    }
                }
            }
            else {
                value += this.advance();
            }
        }
        if (this.pos >= this.source.length) {
            throw new Error(`Unterminated string at line ${this.line}`);
        }
        this.advance(); // Skip closing quote
        let type = TokenType.STRING;
        if (isFString)
            type = TokenType.FSTRING;
        else if (isBytes)
            type = TokenType.BYTES;
        return {
            type,
            value,
            line: this.line,
            col: startCol,
        };
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
    peekNext() {
        if (this.pos + 1 >= this.source.length)
            return "";
        return this.source[this.pos + 1];
    }
    advance() {
        const char = this.source[this.pos++];
        this.col++;
        return char;
    }
    createToken(type, value, col = this.col) {
        return { type, value, line: this.line, col };
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
