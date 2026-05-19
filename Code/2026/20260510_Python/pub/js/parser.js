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
        if (this.match(TokenType.NEWLINE))
            return null;
        const expr = this.parseExpression();
        if (this.match(TokenType.EQUALS)) {
            if (expr.type !== "Identifier") {
                throw new Error("Invalid assignment target");
            }
            const value = this.parseExpression();
            this.consumeStatementEnd();
            return { type: "Assignment", target: expr.name, value };
        }
        this.consumeStatementEnd();
        return expr;
    }
    consumeStatementEnd() {
        if (this.match(TokenType.NEWLINE) ||
            this.isAtEnd() ||
            this.check(TokenType.DEDENT)) {
            return;
        }
        const token = this.peek();
        throw new Error(`Unexpected token at end of statement: ${token.type} at line ${token.line}, col ${token.col}`);
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
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')'");
        return { type: "CallExpression", callee, args };
    }
    parseFunctionDef() {
        const name = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '(' after function name");
        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                params.push(this.consume(TokenType.IDENTIFIER, "Expect parameter name").value);
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
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
        return { type: "FunctionDef", name, params, body };
    }
    parseAssignment() {
        const target = this.consume(TokenType.IDENTIFIER, "Expect variable name").value;
        this.consume(TokenType.EQUALS, "Expect '=' after variable name");
        const value = this.parseExpression();
        this.consumeStatementEnd();
        return { type: "Assignment", target, value };
    }
    parseReturn() {
        const value = this.parseExpression();
        this.consumeStatementEnd();
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
        let expr;
        if (this.match(TokenType.NUMBER)) {
            expr = { type: "Literal", value: parseInt(this.previous().value) };
        }
        else if (this.match(TokenType.STRING)) {
            expr = { type: "Literal", value: this.previous().value };
        }
        else if (this.match(TokenType.TRUE)) {
            expr = { type: "Literal", value: 1 };
        }
        else if (this.match(TokenType.FALSE)) {
            expr = { type: "Literal", value: 0 };
        }
        else if (this.match(TokenType.IDENTIFIER)) {
            const name = this.previous().value;
            if (this.check(TokenType.LPAREN)) {
                this.pos--; // Backtrack identifier
                expr = this.parseCall();
            }
            else {
                expr = { type: "Identifier", name };
            }
        }
        else if (this.match(TokenType.LPAREN)) {
            expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Expect ')' after expression");
        }
        else if (this.match(TokenType.LSQUARE)) {
            expr = this.parseList();
        }
        else if (this.match(TokenType.LBRACE)) {
            expr = this.parseDict();
        }
        else {
            const token = this.peek();
            throw new Error(`Expect expression at line ${token.line}, col ${token.col}`);
        }
        // Handle post-primary: subscripts
        while (this.match(TokenType.LSQUARE)) {
            expr = this.parseSubscript(expr);
        }
        return expr;
    }
    parseList() {
        if (this.check(TokenType.RSQUARE)) {
            this.advance();
            return { type: "List", elements: [] };
        }
        const firstExpr = this.parseExpression();
        if (this.match(TokenType.FOR)) {
            const item = this.consume(TokenType.IDENTIFIER, "Expect variable name").value;
            this.consume(TokenType.IN, "Expect 'in'");
            const iterable = this.parseExpression();
            let condition = null;
            if (this.match(TokenType.IF)) {
                condition = this.parseExpression();
            }
            this.consume(TokenType.RSQUARE, "Expect ']' after comprehension");
            return {
                type: "ListComprehension",
                expression: firstExpr,
                item,
                iterable,
                condition,
            };
        }
        const elements = [firstExpr];
        while (this.match(TokenType.COMMA)) {
            if (this.check(TokenType.RSQUARE))
                break;
            elements.push(this.parseExpression());
        }
        this.consume(TokenType.RSQUARE, "Expect ']' after list");
        return { type: "List", elements };
    }
    parseDict() {
        const key = this.parseExpression();
        this.consume(TokenType.COLON, "Expect ':' after key in dict comprehension");
        const value = this.parseExpression();
        this.consume(TokenType.FOR, "Expect 'for' in dict comprehension");
        const item = this.consume(TokenType.IDENTIFIER, "Expect variable name").value;
        this.consume(TokenType.IN, "Expect 'in'");
        const iterable = this.parseExpression();
        let condition = null;
        if (this.match(TokenType.IF)) {
            condition = this.parseExpression();
        }
        this.consume(TokenType.RBRACE, "Expect '}' after dict comprehension");
        return { type: "DictComprehension", key, value, item, iterable, condition };
    }
    parseSubscript(value) {
        let start = null;
        let stop = null;
        let step = null;
        let isSlice = false;
        if (!this.check(TokenType.COLON) && !this.check(TokenType.RSQUARE)) {
            start = this.parseExpression();
        }
        if (this.match(TokenType.COLON)) {
            isSlice = true;
            if (!this.check(TokenType.COLON) && !this.check(TokenType.RSQUARE)) {
                stop = this.parseExpression();
            }
            if (this.match(TokenType.COLON)) {
                if (!this.check(TokenType.RSQUARE)) {
                    step = this.parseExpression();
                }
            }
        }
        this.consume(TokenType.RSQUARE, "Expect ']' after subscript");
        if (isSlice) {
            return {
                type: "Subscript",
                value,
                index: { type: "Slice", start, stop, step },
            };
        }
        else {
            if (start === null)
                throw new Error("Expect index in subscript");
            return { type: "Subscript", value, index: start };
        }
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
