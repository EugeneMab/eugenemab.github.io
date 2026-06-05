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
        if (this.match(TokenType.FN))
            return this.parseFunctionDeclaration();
        if (this.peek().type === TokenType.LBRACE)
            return this.parseBlockStatement();
        return this.parseExpressionStatement();
    }
    parseLetStatement() {
        const isMutable = this.match(TokenType.MUT);
        const name = this.consume(TokenType.IDENTIFIER, "Expect identifier after 'let'").value;
        this.consume(TokenType.EQUALS, "Expect '=' after identifier");
        const initializer = this.parseExpression();
        this.consume(TokenType.SEMICOLON, "Expect ';' after let statement");
        return { type: "LetStatement", name, isMutable, initializer };
    }
    parseFunctionDeclaration() {
        const name = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '(' after function name");
        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                params.push(this.consume(TokenType.IDENTIFIER, "Expect parameter name").value);
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
        const body = this.parseBlockStatement();
        return { type: "FunctionDeclaration", name, params, body };
    }
    parseBlockStatement() {
        this.consume(TokenType.LBRACE, "Expect '{' to start block");
        const body = [];
        let tailExpression;
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            if (this.match(TokenType.LET)) {
                body.push(this.parseLetStatement());
            }
            else if (this.match(TokenType.FN)) {
                body.push(this.parseFunctionDeclaration());
            }
            else if (this.peek().type === TokenType.LBRACE) {
                body.push(this.parseBlockStatement());
            }
            else {
                const expr = this.parseExpression();
                if (this.match(TokenType.SEMICOLON)) {
                    body.push({ type: "ExpressionStatement", expression: expr });
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
        return { type: "BlockStatement", body, tailExpression };
    }
    parseExpressionStatement() {
        const expression = this.parseExpression();
        this.consume(TokenType.SEMICOLON, "Expect ';' after expression");
        return { type: "ExpressionStatement", expression };
    }
    parseExpression() {
        return this.parseBitwiseOr();
    }
    parseBitwiseOr() {
        let expr = this.parseBitwiseXor();
        while (this.match(TokenType.PIPE)) {
            const operator = this.previous().value;
            const right = this.parseBitwiseXor();
            expr = { type: "BinaryExpression", operator, left: expr, right };
        }
        return expr;
    }
    parseBitwiseXor() {
        let expr = this.parseBitwiseAnd();
        while (this.match(TokenType.CARET)) {
            const operator = this.previous().value;
            const right = this.parseBitwiseAnd();
            expr = { type: "BinaryExpression", operator, left: expr, right };
        }
        return expr;
    }
    parseBitwiseAnd() {
        let expr = this.parseShift();
        while (this.match(TokenType.AMPERSAND)) {
            const operator = this.previous().value;
            const right = this.parseShift();
            expr = { type: "BinaryExpression", operator, left: expr, right };
        }
        return expr;
    }
    parseShift() {
        let expr = this.parseAddition();
        while (this.match(TokenType.LSHIFT, TokenType.RSHIFT)) {
            const operator = this.previous().value;
            const right = this.parseAddition();
            expr = { type: "BinaryExpression", operator, left: expr, right };
        }
        return expr;
    }
    parseAddition() {
        let expr = this.parseMultiplication();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous().value;
            const right = this.parseMultiplication();
            expr = { type: "BinaryExpression", operator, left: expr, right };
        }
        return expr;
    }
    parseMultiplication() {
        let expr = this.parseUnary();
        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            expr = { type: "BinaryExpression", operator, left: expr, right };
        }
        return expr;
    }
    parseUnary() {
        if (this.match(TokenType.MINUS, TokenType.EXCLAMATION, TokenType.AMPERSAND)) {
            const operator = this.previous().value;
            const argument = this.parseUnary();
            return { type: "UnaryExpression", operator, argument };
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        if (this.match(TokenType.INTEGER))
            return {
                type: "Literal",
                value: parseInt(this.previous().value),
                rawType: "integer",
            };
        if (this.match(TokenType.HEX))
            return {
                type: "Literal",
                value: parseInt(this.previous().value, 16),
                rawType: "hex",
            };
        if (this.match(TokenType.STRING))
            return {
                type: "Literal",
                value: this.previous().value,
                rawType: "string",
            };
        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            if (this.match(TokenType.EXCLAMATION)) {
                // Macro call: print!(...)
                this.consume(TokenType.LPAREN, "Expect '(' after macro name");
                const args = [];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after macro args");
                return { type: "MacroInvocation", name, args };
            }
            if (this.match(TokenType.LPAREN)) {
                // Function call
                const args = [];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after args");
                return { type: "CallExpression", callee: name, args };
            }
            return { type: "Identifier", name };
        }
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Expect ')' after expression");
            return expr;
        }
        throw new Error(formatError(this.source, `Expect expression, found '${this.peek().value}'`, this.peek()));
    }
    // Helpers
    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
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
        // If the next token is on a new line, point to the previous token (likely where the missing semicolon should be)
        const errorToken = token.type === TokenType.EOF || token.line > prev.line ? prev : token;
        throw new Error(formatError(this.source, message, errorToken));
    }
}
