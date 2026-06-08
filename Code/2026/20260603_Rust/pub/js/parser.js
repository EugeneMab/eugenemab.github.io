import { TokenType } from "./lexer.js";
import { formatError } from "./error.js";
export class Parser {
    tokens;
    source;
    pos = 0;
    constructor(tokens, source) {
        this.tokens = tokens;
        this.source = source;
    }
    parse() {
        const body = [];
        while (!this.isAtEnd()) {
            body.push(this.parseStatement());
        }
        return { type: "Program", body };
    }
    parseStatement() {
        if (this.match(TokenType.LET))
            return this.parseLetStatement();
        if (this.match(TokenType.CONST))
            return this.parseConstStatement();
        if (this.match(TokenType.FN))
            return this.parseFunctionDeclaration();
        if (this.match(TokenType.IF))
            return this.parseIfStatement();
        if (this.match(TokenType.LOOP))
            return this.parseLoopStatement();
        if (this.match(TokenType.WHILE))
            return this.parseWhileStatement();
        if (this.match(TokenType.FOR))
            return this.parseForStatement();
        if (this.match(TokenType.RETURN))
            return this.parseReturnStatement();
        if (this.match(TokenType.BREAK))
            return this.parseBreakStatement();
        if (this.match(TokenType.CONTINUE))
            return this.parseContinueStatement();
        if (this.check(TokenType.LBRACE)) {
            const block = this.parseBlockStatement();
            if (this.match(TokenType.SEMICOLON)) {
                return { type: "ExpressionStatement", expression: block };
            }
            return block;
        }
        return this.parseExpressionStatement();
    }
    parseLoopStatement() {
        const token = this.previous();
        const body = this.parseBlockStatement();
        return { type: "LoopStatement", token, body };
    }
    parseWhileStatement() {
        const token = this.previous();
        const condition = this.parseExpression();
        const body = this.parseBlockStatement();
        return { type: "WhileStatement", token, condition, body };
    }
    parseForStatement() {
        const token = this.previous();
        const pattern = this.parsePattern();
        this.consume(TokenType.IN, "Expect 'in' after for pattern");
        const iterable = this.parseExpression();
        const body = this.parseBlockStatement();
        return { type: "ForStatement", token, pattern, iterable, body };
    }
    parseReturnStatement() {
        const token = this.previous();
        let argument;
        if (!this.check(TokenType.SEMICOLON)) {
            argument = this.parseExpression();
        }
        this.consume(TokenType.SEMICOLON, "Expect ';' after return");
        return { type: "ReturnStatement", token, argument };
    }
    parsePattern() {
        if (this.match(TokenType.AMPERSAND)) {
            return { type: "ReferencePattern", pattern: this.parsePattern() };
        }
        if (this.match(TokenType.LPAREN)) {
            const elements = [];
            if (!this.check(TokenType.RPAREN)) {
                do {
                    elements.push(this.parsePattern());
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RPAREN, "Expect ')' after tuple pattern");
            return { type: "TuplePattern", elements };
        }
        const name = this.consume(TokenType.IDENTIFIER, "Expect identifier in pattern").value;
        return { type: "IdentifierPattern", name };
    }
    parseBreakStatement() {
        const token = this.previous();
        this.consume(TokenType.SEMICOLON, "Expect ';' after 'break'");
        return { type: "BreakStatement", token };
    }
    parseContinueStatement() {
        const token = this.previous();
        this.consume(TokenType.SEMICOLON, "Expect ';' after 'continue'");
        return { type: "ContinueStatement", token };
    }
    parseIfStatement() {
        const token = this.previous();
        const condition = this.parseExpression();
        const thenBranch = this.parseBlockStatement();
        let elseBranch;
        if (this.match(TokenType.ELSE)) {
            if (this.match(TokenType.IF)) {
                elseBranch = this.parseIfStatement();
            }
            else {
                elseBranch = this.parseBlockStatement();
            }
        }
        return { type: "IfStatement", token, condition, thenBranch, elseBranch };
    }
    parseLetStatement() {
        const token = this.previous();
        const isMutable = this.match(TokenType.MUT);
        const name = this.consume(TokenType.IDENTIFIER, "Expect identifier after 'let'").value;
        if (this.match(TokenType.COLON)) {
            this.consume(TokenType.IDENTIFIER, "Expect type name");
        }
        this.consume(TokenType.EQUALS, "Expect '=' after identifier");
        const initializer = this.parseExpression();
        this.consume(TokenType.SEMICOLON, "Expect ';' after let statement");
        return { type: "LetStatement", token, name, isMutable, initializer };
    }
    parseConstStatement() {
        const token = this.previous();
        const name = this.consume(TokenType.IDENTIFIER, "Expect identifier after 'const'").value;
        this.consume(TokenType.COLON, "Expect ':' after identifier");
        this.consume(TokenType.IDENTIFIER, "Expect type name");
        this.consume(TokenType.EQUALS, "Expect '=' after type");
        const initializer = this.parseExpression();
        this.consume(TokenType.SEMICOLON, "Expect ';' after const statement");
        return { type: "ConstStatement", token, name, initializer };
    }
    parseFunctionDeclaration() {
        const token = this.previous();
        const name = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '(' after function name");
        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                const pName = this.consume(TokenType.IDENTIFIER, "Expect parameter name").value;
                let pType;
                if (this.match(TokenType.COLON)) {
                    // Allow &str, &String, &mut String, etc.
                    pType = "";
                    while (this.match(TokenType.AMPERSAND, TokenType.MUT, TokenType.IDENTIFIER)) {
                        pType += (pType ? " " : "") + this.previous().value;
                    }
                }
                params.push({ name: pName, type: pType });
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
        let returnType;
        if (this.match(TokenType.ARROW)) {
            returnType = "";
            while (this.match(TokenType.AMPERSAND, TokenType.MUT, TokenType.IDENTIFIER)) {
                returnType += (returnType ? " " : "") + this.previous().value;
            }
        }
        const body = this.parseBlockStatement();
        return { type: "FunctionDeclaration", token, name, params, returnType, body };
    }
    parseBlockStatement() {
        const token = this.consume(TokenType.LBRACE, "Expect '{' to start block");
        const body = [];
        let tailExpression;
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            if (this.check(TokenType.LET) ||
                this.check(TokenType.CONST) ||
                this.check(TokenType.FN) ||
                this.check(TokenType.IF) ||
                this.check(TokenType.LOOP) ||
                this.check(TokenType.WHILE) ||
                this.check(TokenType.FOR) ||
                this.check(TokenType.RETURN) ||
                this.check(TokenType.BREAK) ||
                this.check(TokenType.CONTINUE)) {
                body.push(this.parseStatement());
                continue;
            }
            const expr = this.parseExpression();
            if (this.match(TokenType.SEMICOLON)) {
                body.push({
                    type: "ExpressionStatement",
                    token: this.previous(),
                    expression: expr,
                });
            }
            else {
                if (expr.type === "BlockStatement") {
                    body.push(expr);
                }
                else {
                    tailExpression = expr;
                    if (!this.check(TokenType.RBRACE)) {
                        throw new Error(formatError(this.source, "Expect ';' after expression", this.peek()));
                    }
                    break;
                }
            }
        }
        this.consume(TokenType.RBRACE, "Expect '}' to end block");
        return { type: "BlockStatement", token, body, tailExpression };
    }
    parseExpressionStatement() {
        const expression = this.parseExpression();
        const token = this.consume(TokenType.SEMICOLON, "Expect ';' after expression");
        return { type: "ExpressionStatement", token, expression };
    }
    parseExpression() {
        return this.parseAssignment();
    }
    parseAssignment() {
        const expr = this.parseRange();
        if (this.match(TokenType.EQUALS)) {
            const token = this.previous();
            const right = this.parseAssignment();
            if (expr.type === "Identifier") {
                return {
                    type: "BinaryExpression",
                    token,
                    operator: "=",
                    left: expr,
                    right,
                };
            }
            throw new Error(formatError(this.source, "Invalid l-value", token));
        }
        return expr;
    }
    parseRange() {
        if (this.match(TokenType.DOT_DOT)) {
            const token = this.previous();
            let end;
            if (!this.check(TokenType.RBRACKET, TokenType.COMMA, TokenType.SEMICOLON, TokenType.RPAREN, TokenType.RBRACE)) {
                end = this.parseComparison();
            }
            return { type: "RangeExpression", token, end };
        }
        const expr = this.parseComparison();
        if (this.match(TokenType.DOT_DOT)) {
            const token = this.previous();
            let end;
            // Ranges can be open-ended, e.g., s[..] or s[0..]
            if (!this.check(TokenType.RBRACKET, TokenType.COMMA, TokenType.SEMICOLON, TokenType.RPAREN, TokenType.RBRACE)) {
                end = this.parseComparison();
            }
            return { type: "RangeExpression", token, start: expr, end };
        }
        return expr;
    }
    parseComparison() {
        let expr = this.parseBitwiseOr();
        while (this.match(TokenType.EQ_EQ, TokenType.NE_EQ, TokenType.LT, TokenType.GT, TokenType.LT_EQ, TokenType.GT_EQ)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseBitwiseOr();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseBitwiseOr() {
        let expr = this.parseBitwiseXor();
        while (this.match(TokenType.PIPE)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseBitwiseXor();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseBitwiseXor() {
        let expr = this.parseBitwiseAnd();
        while (this.match(TokenType.CARET)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseBitwiseAnd();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseBitwiseAnd() {
        let expr = this.parseShift();
        while (this.match(TokenType.AMPERSAND)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseShift();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseShift() {
        let expr = this.parseAddition();
        while (this.match(TokenType.LSHIFT, TokenType.RSHIFT)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseAddition();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseAddition() {
        let expr = this.parseMultiplication();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseMultiplication();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseMultiplication() {
        let expr = this.parseUnary();
        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseUnary();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseUnary() {
        if (this.match(TokenType.AMPERSAND)) {
            const token = this.previous();
            const isMutable = this.match(TokenType.MUT);
            const argument = this.parseUnary();
            return { type: "BorrowExpression", token, isMutable, argument };
        }
        if (this.match(TokenType.MINUS, TokenType.EXCLAMATION)) {
            const token = this.previous();
            const operator = token.value;
            const argument = this.parseUnary();
            return { type: "UnaryExpression", token, operator, argument };
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.match(TokenType.DOT)) {
                const token = this.previous();
                const member = this.consume(TokenType.IDENTIFIER, "Expect member name after '.'").value;
                if (this.match(TokenType.LPAREN)) {
                    const args = [];
                    if (!this.check(TokenType.RPAREN)) {
                        do {
                            args.push(this.parseExpression());
                        } while (this.match(TokenType.COMMA));
                    }
                    this.consume(TokenType.RPAREN, "Expect ')' after args");
                    expr = {
                        type: "CallExpression",
                        token,
                        callee: `${member}`,
                        args: [expr, ...args], // Simple method call desugaring
                    };
                }
                else {
                    expr = {
                        type: "MemberAccessExpression",
                        token,
                        object: expr,
                        member,
                    };
                }
            }
            else if (this.match(TokenType.LBRACKET)) {
                const token = this.previous();
                const index = this.parseExpression();
                this.consume(TokenType.RBRACKET, "Expect ']' after index");
                expr = { type: "IndexExpression", token, object: expr, index };
            }
            else {
                break;
            }
        }
        return expr;
    }
    parsePrimary() {
        if (this.check(TokenType.LBRACE))
            return this.parseBlockStatement();
        if (this.match(TokenType.LBRACKET)) {
            const token = this.previous();
            const elements = [];
            if (!this.check(TokenType.RBRACKET)) {
                do {
                    elements.push(this.parseExpression());
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RBRACKET, "Expect ']' after array elements");
            return { type: "ArrayLiteral", token, elements };
        }
        if (this.match(TokenType.IF)) {
            return this.parseIfStatement();
        }
        if (this.match(TokenType.INTEGER)) {
            const token = this.previous();
            return {
                type: "Literal",
                token,
                value: parseInt(token.value),
                rawType: "integer",
            };
        }
        if (this.match(TokenType.HEX)) {
            const token = this.previous();
            return {
                type: "Literal",
                token,
                value: parseInt(token.value, 16),
                rawType: "hex",
            };
        }
        if (this.match(TokenType.STRING)) {
            const token = this.previous();
            return {
                type: "Literal",
                token,
                value: token.value,
                rawType: "string",
            };
        }
        if (this.match(TokenType.BYTE_LITERAL)) {
            const token = this.previous();
            return {
                type: "Literal",
                token,
                value: parseInt(token.value),
                rawType: "byte",
            };
        }
        if (this.match(TokenType.TRUE)) {
            const token = this.previous();
            return {
                type: "Literal",
                token,
                value: 1,
                rawType: "integer",
            };
        }
        if (this.match(TokenType.FALSE)) {
            const token = this.previous();
            return {
                type: "Literal",
                token,
                value: 0,
                rawType: "integer",
            };
        }
        if (this.match(TokenType.IDENTIFIER, TokenType.PANIC)) {
            const token = this.previous();
            let name = token.value;
            while (this.match(TokenType.COLON_COLON)) {
                name +=
                    "::" +
                        this.consume(TokenType.IDENTIFIER, "Expect identifier after '::'")
                            .value;
            }
            if (this.match(TokenType.EXCLAMATION)) {
                this.consume(TokenType.LPAREN, "Expect '(' after macro name");
                const args = [];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after macro args");
                return { type: "MacroInvocation", token, name, args };
            }
            if (this.match(TokenType.LPAREN)) {
                const args = [];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after args");
                return { type: "CallExpression", token, callee: name, args };
            }
            return { type: "Identifier", token, name };
        }
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Expect ')' after expression");
            return expr;
        }
        throw new Error(formatError(this.source, `Expect expression, found '${this.peek().value}'`, this.peek()));
    }
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(...types) {
        if (this.isAtEnd())
            return false;
        return types.includes(this.peek().type);
    }
    advance() {
        if (!this.isAtEnd())
            this.pos++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }
    peek() {
        return this.tokens[this.pos];
    }
    previous() {
        return this.tokens[this.pos - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        const token = this.peek();
        const prev = this.previous();
        const errorToken = token.type === TokenType.EOF || token.line > prev.line ? prev : token;
        throw new Error(formatError(this.source, message, errorToken));
    }
}
