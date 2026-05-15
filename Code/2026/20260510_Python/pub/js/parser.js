// src/parser.ts
import { TokenType } from "./lexer.js";
export class Parser {
    tokens;
    pos = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parse() {
        const body = [];
        while (!this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        return { type: "Program", body };
    }
    parseStatement() {
        if (this.match(TokenType.DEF))
            return this.parseFunctionDef();
        if (this.match(TokenType.RETURN))
            return this.parseReturn();
        if (this.match(TokenType.WHILE))
            return this.parseWhile();
        if (this.match(TokenType.IF))
            return this.parseIf();
        if (this.peek().type === TokenType.IDENTIFIER) {
            if (this.peekNext()?.type === TokenType.EQUALS) {
                return this.parseAssignment();
            }
            if (this.peekNext()?.type === TokenType.LPAREN) {
                const call = this.parseCall();
                if (this.match(TokenType.NEWLINE) ||
                    this.isAtEnd() ||
                    this.check(TokenType.DEDENT)) {
                    // statement call
                }
                return call;
            }
        }
        // Skip stray newlines
        if (this.match(TokenType.NEWLINE))
            return null;
        const token = this.peek();
        throw new Error(`Unexpected token: ${token.type} at line ${token.line}, col ${token.col}`);
    }
    parseIf() {
        const condition = this.parseExpression();
        this.consume(TokenType.COLON, "Expect ':' after if condition");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indent after if");
        const thenBranch = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                thenBranch.push(node);
        }
        this.consume(TokenType.DEDENT, "Expect dedent after if body");
        let elseBranch = null;
        if (this.match(TokenType.ELIF)) {
            elseBranch = [this.parseIf()];
        }
        else if (this.match(TokenType.ELSE)) {
            this.consume(TokenType.COLON, "Expect ':' after else");
            this.consume(TokenType.NEWLINE, "Expect newline after ':'");
            this.consume(TokenType.INDENT, "Expect indent after else");
            elseBranch = [];
            while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
                const node = this.parseStatement();
                if (node)
                    elseBranch.push(node);
            }
            this.consume(TokenType.DEDENT, "Expect dedent after else body");
        }
        return { type: "If", condition, thenBranch, elseBranch };
    }
    parseWhile() {
        const condition = this.parseExpression();
        this.consume(TokenType.COLON, "Expect ':' after while condition");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indent after while");
        const body = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        this.consume(TokenType.DEDENT, "Expect dedent after while body");
        return { type: "While", condition, body };
    }
    parseCall() {
        const callee = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '('");
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                args.push(this.parseExpression());
            } while (this.match(TokenType.PLUS)); // Separator hack
        }
        this.consume(TokenType.RPAREN, "Expect ')'");
        return { type: "CallExpression", callee, args };
    }
    parseFunctionDef() {
        const name = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '(' after function name");
        this.consume(TokenType.RPAREN, "Expect ')' after '('");
        this.consume(TokenType.COLON, "Expect ':' after parameters");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indentation after function definition");
        const body = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        this.consume(TokenType.DEDENT, "Expect dedent after function body");
        return { type: "FunctionDef", name, body };
    }
    parseAssignment() {
        const target = this.consume(TokenType.IDENTIFIER, "Expect variable name").value;
        this.consume(TokenType.EQUALS, "Expect '=' after variable name");
        const value = this.parseExpression();
        this.consume(TokenType.NEWLINE, "Expect newline after assignment");
        return { type: "Assignment", target, value };
    }
    parseReturn() {
        const value = this.parseExpression();
        // Return is often the last statement, might be followed by NEWLINE then DEDENT
        if (this.check(TokenType.NEWLINE))
            this.advance();
        return { type: "Return", value };
    }
    parseExpression() {
        return this.parseOr();
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.match(TokenType.OR)) {
            const operator = "or";
            const right = this.parseAnd();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseAnd() {
        let left = this.parseNot();
        while (this.match(TokenType.AND)) {
            const operator = "and";
            const right = this.parseNot();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseNot() {
        if (this.match(TokenType.NOT)) {
            const operator = "not";
            const argument = this.parseNot();
            return { type: "UnaryExpression", operator, argument };
        }
        return this.parseComparison();
    }
    parseComparison() {
        let left = this.parseAddition();
        while (this.match(TokenType.EQUALS_EQUALS, TokenType.NOT_EQUALS, TokenType.LESS, TokenType.GREATER)) {
            const operator = this.previous().value;
            const right = this.parseAddition();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseAddition() {
        let left = this.parseMultiplication();
        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous().type === TokenType.PLUS ? "+" : "-";
            const right = this.parseMultiplication();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseMultiplication() {
        let left = this.parseUnary();
        while (this.match(TokenType.STAR, TokenType.SLASH)) {
            const operator = this.previous().type === TokenType.STAR ? "*" : "/";
            const right = this.parseUnary();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseUnary() {
        if (this.match(TokenType.MINUS)) {
            const operator = "-";
            const argument = this.parseUnary();
            return { type: "UnaryExpression", operator, argument };
        }
        return this.parsePrimary();
    }
    parsePrimary() {
        if (this.match(TokenType.NUMBER)) {
            return { type: "Literal", value: parseInt(this.previous().value) };
        }
        if (this.match(TokenType.TRUE)) {
            return { type: "Literal", value: 1 };
        }
        if (this.match(TokenType.FALSE)) {
            return { type: "Literal", value: 0 };
        }
        if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            if (this.check(TokenType.LPAREN)) {
                this.pos--; // Backtrack identifier
                return this.parseCall();
            }
            return { type: "Identifier", name };
        }
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Expect ')' after expression");
            return expr;
        }
        const token = this.peek();
        throw new Error(`Expect expression at line ${token.line}, col ${token.col}`);
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
    peekNext() {
        if (this.pos + 1 >= this.tokens.length)
            return null;
        return this.tokens[this.pos + 1];
    }
    previous() {
        return this.tokens[this.pos - 1];
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        const token = this.peek();
        throw new Error(`${message} at line ${token.line}, col ${token.col}, found ${token.type}`);
    }
}
