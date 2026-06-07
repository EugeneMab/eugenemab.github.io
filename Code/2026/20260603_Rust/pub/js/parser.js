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
                params.push(this.consume(TokenType.IDENTIFIER, "Expect parameter name").value);
                if (this.match(TokenType.COLON)) {
                    this.consume(TokenType.IDENTIFIER, "Expect type name");
                }
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
        if (this.match(TokenType.ARROW)) {
            this.consume(TokenType.IDENTIFIER, "Expect return type");
        }
        const body = this.parseBlockStatement();
        return { type: "FunctionDeclaration", token, name, params, body };
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
        const expr = this.parseComparison();
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
        return this.parsePrimary();
    }
    parsePrimary() {
        if (this.check(TokenType.LBRACE))
            return this.parseBlockStatement();
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
            const name = token.value;
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
