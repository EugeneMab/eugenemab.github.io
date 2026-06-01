// src/parser.ts
import { TokenType, Lexer } from "./lexer.js";
export class Parser {
    tokens;
    pos = 0;
    funcNestingLevel = 0;
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
        if (this.match(TokenType.YIELD))
            return this.parseYield();
        if (this.match(TokenType.WHILE))
            return this.parseWhile();
        if (this.match(TokenType.DO))
            return this.parseDoWhile();
        if (this.match(TokenType.FOR))
            return this.parseFor();
        if (this.match(TokenType.IF))
            return this.parseIf();
        if (this.match(TokenType.WITH))
            return this.parseWith();
        if (this.match(TokenType.GLOBAL))
            return this.parseGlobal();
        if (this.match(TokenType.NONLOCAL))
            return this.parseNonlocal();
        if (this.match(TokenType.PASS)) {
            this.consumeStatementEnd();
            return { type: "Pass" };
        }
        if (this.match(TokenType.NEWLINE))
            return null;
        const expr = this.parseTestList();
        if (this.match(TokenType.EQUALS)) {
            const targets = this.getAssignmentTargets(expr);
            const value = this.parseTestList();
            this.consumeStatementEnd();
            return { type: "Assignment", targets, value };
        }
        this.consumeStatementEnd();
        return expr;
    }
    getAssignmentTargets(expr) {
        if (expr.type === "Identifier") {
            return [expr];
        }
        if (expr.type === "Tuple" || expr.type === "List") {
            return expr.elements.map((e) => {
                if (e.type === "Identifier" ||
                    e.type === "Tuple" ||
                    e.type === "List" ||
                    e.type === "StarTarget") {
                    return e;
                }
                throw new Error("Invalid assignment target");
            });
        }
        throw new Error("Invalid assignment target");
    }
    parseGlobal() {
        const names = [];
        do {
            names.push(this.consume(TokenType.IDENTIFIER, "Expect identifier").value);
        } while (this.match(TokenType.COMMA));
        this.consumeStatementEnd();
        return { type: "Global", names };
    }
    parseNonlocal() {
        if (this.funcNestingLevel === 0) {
            throw new Error("nonlocal declaration not allowed at module level");
        }
        const names = [];
        do {
            names.push(this.consume(TokenType.IDENTIFIER, "Expect identifier").value);
        } while (this.match(TokenType.COMMA));
        this.consumeStatementEnd();
        return { type: "Nonlocal", names };
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
    parseFor() {
        const iterators = [];
        iterators.push(this.consume(TokenType.IDENTIFIER, "Expect iterator name").value);
        while (this.match(TokenType.COMMA)) {
            iterators.push(this.consume(TokenType.IDENTIFIER, "Expect iterator name").value);
        }
        let iterable;
        let start;
        let stop;
        if (this.match(TokenType.IN)) {
            iterable = this.parseExpression();
        }
        else if (this.match(TokenType.FROM)) {
            if (iterators.length > 1) {
                throw new Error("Multiple iterators not supported with 'from ... to'");
            }
            start = this.parseExpression();
            this.consume(TokenType.TO, "Expect 'to' after 'from'");
            stop = this.parseExpression();
        }
        else {
            throw new Error("Expect 'in' or 'from' after for iterator");
        }
        this.consume(TokenType.COLON, "Expect ':' after for header");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indent after for");
        const body = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        this.consume(TokenType.DEDENT, "Expect dedent after for body");
        return { type: "For", iterators, iterable, start, stop, body };
    }
    parseDoWhile() {
        this.consume(TokenType.COLON, "Expect ':' after do");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indent after do");
        const body = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        this.consume(TokenType.DEDENT, "Expect dedent after do body");
        this.consume(TokenType.WHILE, "Expect 'while' after do body");
        const condition = this.parseExpression();
        return { type: "DoWhile", condition, body };
    }
    parseWith() {
        const expression = this.parseExpression();
        let target = null;
        if (this.match(TokenType.AS)) {
            target = this.consume(TokenType.IDENTIFIER, "Expect identifier after 'as'").value;
        }
        this.consume(TokenType.COLON, "Expect ':' after with expression");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indent after with");
        const body = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        this.consume(TokenType.DEDENT, "Expect dedent after with body");
        return { type: "With", expression, target, body };
    }
    parseFunctionDef() {
        const name = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '(' after function name");
        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            let hasDefault = false;
            do {
                const pName = this.consume(TokenType.IDENTIFIER, "Expect parameter name").value;
                let defaultValue;
                if (this.match(TokenType.EQUALS)) {
                    defaultValue = this.parseExpression();
                    hasDefault = true;
                }
                else if (hasDefault) {
                    throw new Error("non-default argument follows default argument");
                }
                params.push({ name: pName, defaultValue });
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
        this.consume(TokenType.COLON, "Expect ':' after parameters");
        this.consume(TokenType.NEWLINE, "Expect newline after ':'");
        this.consume(TokenType.INDENT, "Expect indentation after function definition");
        this.funcNestingLevel++;
        const body = [];
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            const node = this.parseStatement();
            if (node)
                body.push(node);
        }
        this.funcNestingLevel--;
        this.consume(TokenType.DEDENT, "Expect dedent after function body");
        return { type: "FunctionDef", name, params, body };
    }
    parseReturn() {
        const value = this.parseTestList();
        this.consumeStatementEnd();
        return { type: "Return", value };
    }
    parseYield() {
        const value = this.parseTestList();
        this.consumeStatementEnd();
        return { type: "Yield", value };
    }
    parseTestList() {
        const expr = this.parseExpression();
        if (this.match(TokenType.COMMA)) {
            const elements = [expr];
            do {
                if (this.check(TokenType.NEWLINE) ||
                    this.check(TokenType.COLON) ||
                    this.check(TokenType.RSQUARE) ||
                    this.check(TokenType.RPAREN) ||
                    this.check(TokenType.EQUALS))
                    break;
                elements.push(this.parseExpression());
            } while (this.match(TokenType.COMMA));
            return { type: "Tuple", elements };
        }
        return expr;
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
        let left = this.parseBitwiseOr();
        while (this.match(TokenType.EQUALS_EQUALS, TokenType.NOT_EQUALS, TokenType.LESS, TokenType.GREATER, TokenType.LESS_EQUALS, TokenType.GREATER_EQUALS, TokenType.IN)) {
            const operator = this.previous().value;
            const right = this.parseBitwiseOr();
            left = { type: "BinaryExpression", left, operator, right };
        }
        if (this.match(TokenType.NOT)) {
            if (this.match(TokenType.IN)) {
                const operator = "not in";
                const right = this.parseBitwiseOr();
                left = { type: "BinaryExpression", left, operator, right };
            }
        }
        return left;
    }
    parseBitwiseOr() {
        let left = this.parseBitwiseXor();
        while (this.match(TokenType.PIPE)) {
            const operator = "|";
            const right = this.parseBitwiseXor();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseBitwiseXor() {
        let left = this.parseBitwiseAnd();
        while (this.match(TokenType.CARET)) {
            const operator = "^";
            const right = this.parseBitwiseAnd();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseBitwiseAnd() {
        let left = this.parseShift();
        while (this.match(TokenType.AMPERSAND)) {
            const operator = "&";
            const right = this.parseShift();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseShift() {
        let left = this.parseAddition();
        while (this.match(TokenType.LESS_LESS, TokenType.GREATER_GREATER)) {
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
        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.SLASH_SLASH, TokenType.PERCENT)) {
            const operator = this.previous().value;
            const right = this.parseUnary();
            left = { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parseUnary() {
        if (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.TILDE)) {
            const operator = this.previous().value;
            const argument = this.parseUnary();
            return { type: "UnaryExpression", operator, argument };
        }
        if (this.match(TokenType.STAR)) {
            const arg = this.parseUnary();
            if (arg.type !== "Identifier") {
                throw new Error("Expect identifier after *");
            }
            return { type: "StarTarget", name: arg.name };
        }
        return this.parseExponentiation();
    }
    parseExponentiation() {
        const left = this.parsePrimary();
        if (this.match(TokenType.STAR_STAR)) {
            const operator = "**";
            const right = this.parseUnary(); // Exponentiation is right-associative
            return { type: "BinaryExpression", left, operator, right };
        }
        return left;
    }
    parsePrimary() {
        let expr;
        if (this.match(TokenType.NUMBER)) {
            const valStr = this.previous().value;
            if (valStr.includes(".")) {
                expr = { type: "Literal", value: parseFloat(valStr) };
            }
            else {
                const val = BigInt(valStr);
                if (val > BigInt(Number.MAX_SAFE_INTEGER) ||
                    val < BigInt(Number.MIN_SAFE_INTEGER)) {
                    expr = { type: "Literal", value: val };
                }
                else {
                    expr = { type: "Literal", value: Number(val) };
                }
            }
        }
        else if (this.match(TokenType.STRING)) {
            expr = { type: "Literal", value: this.previous().value };
        }
        else if (this.match(TokenType.BYTES)) {
            expr = { type: "Bytes", value: this.previous().value };
        }
        else if (this.match(TokenType.FSTRING)) {
            expr = this.parseFString(this.previous().value);
        }
        else if (this.match(TokenType.TRUE)) {
            expr = { type: "Literal", value: true };
        }
        else if (this.match(TokenType.FALSE)) {
            expr = { type: "Literal", value: false };
        }
        else if (this.match(TokenType.IDENTIFIER)) {
            expr = { type: "Identifier", name: this.previous().value };
        }
        else if (this.match(TokenType.LPAREN)) {
            expr = this.parseTupleOrParenthesized();
        }
        else if (this.match(TokenType.LSQUARE)) {
            expr = this.parseList();
        }
        else if (this.match(TokenType.LBRACE)) {
            expr = this.parseDictOrSet();
        }
        else {
            const token = this.peek();
            throw new Error(`Expect expression at line ${token.line}, col ${token.col}`);
        }
        while (true) {
            if (this.match(TokenType.LPAREN)) {
                expr = this.parseCallArgs(expr);
            }
            else if (this.match(TokenType.LSQUARE)) {
                expr = this.parseSubscript(expr);
            }
            else if (this.match(TokenType.DOT)) {
                const member = this.consume(TokenType.IDENTIFIER, "Expect member name").value;
                expr = { type: "MemberAccess", object: expr, member };
            }
            else {
                break;
            }
        }
        return expr;
    }
    parseCallArgs(callee) {
        const args = [];
        if (!this.check(TokenType.RPAREN)) {
            let hasKeyword = false;
            do {
                const expr = this.parseExpression();
                if (expr.type === "Identifier" && this.match(TokenType.EQUALS)) {
                    const value = this.parseExpression();
                    args.push({ name: expr.name, value });
                    hasKeyword = true;
                }
                else {
                    if (hasKeyword) {
                        throw new Error("positional argument follows keyword argument");
                    }
                    args.push({ value: expr });
                }
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')'");
        if (callee.type === "Identifier") {
            return { type: "CallExpression", callee: callee.name, args };
        }
        return { type: "CallExpression", callee, args };
    }
    parseFString(value) {
        const parts = [];
        let current = "";
        for (let i = 0; i < value.length; i++) {
            if (value[i] === "{") {
                if (current)
                    parts.push(current);
                current = "";
                let exprStr = "";
                let braces = 1;
                i++;
                while (i < value.length && braces > 0) {
                    if (value[i] === "{")
                        braces++;
                    if (value[i] === "}")
                        braces--;
                    if (braces > 0)
                        exprStr += value[i++];
                }
                if (braces > 0) {
                    throw new Error("Unterminated f-string expression");
                }
                const lexer = new Lexer(exprStr);
                const tokens = lexer.tokenize();
                const parser = new Parser(tokens);
                parts.push(parser.parseExpression());
            }
            else {
                current += value[i];
            }
        }
        if (current)
            parts.push(current);
        return { type: "FString", parts };
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
    parseTupleOrParenthesized() {
        if (this.match(TokenType.RPAREN)) {
            return { type: "Tuple", elements: [] };
        }
        const expr = this.parseTestList(); // Tuples in parens are testlists
        this.consume(TokenType.RPAREN, "Expect ')' after tuple");
        return expr;
    }
    parseDictOrSet() {
        if (this.match(TokenType.RBRACE)) {
            return { type: "Dict", entries: [] };
        }
        const firstExpr = this.parseExpression();
        if (this.match(TokenType.COLON)) {
            const value = this.parseExpression();
            if (this.match(TokenType.FOR)) {
                const item = this.consume(TokenType.IDENTIFIER, "Expect variable name").value;
                this.consume(TokenType.IN, "Expect 'in'");
                const iterable = this.parseExpression();
                let condition = null;
                if (this.match(TokenType.IF)) {
                    condition = this.parseExpression();
                }
                this.consume(TokenType.RBRACE, "Expect '}' after dict comprehension");
                return {
                    type: "DictComprehension",
                    key: firstExpr,
                    value,
                    item,
                    iterable,
                    condition,
                };
            }
            else {
                const entries = [{ key: firstExpr, value }];
                while (this.match(TokenType.COMMA)) {
                    if (this.check(TokenType.RBRACE))
                        break;
                    const k = this.parseExpression();
                    this.consume(TokenType.COLON, "Expect ':' after key");
                    const v = this.parseExpression();
                    entries.push({ key: k, value: v });
                }
                this.consume(TokenType.RBRACE, "Expect '}' after dict");
                return { type: "Dict", entries };
            }
        }
        else if (this.match(TokenType.FOR)) {
            const item = this.consume(TokenType.IDENTIFIER, "Expect variable name").value;
            this.consume(TokenType.IN, "Expect 'in'");
            const iterable = this.parseExpression();
            let condition = null;
            if (this.match(TokenType.IF)) {
                condition = this.parseExpression();
            }
            this.consume(TokenType.RBRACE, "Expect '}' after set comprehension");
            return {
                type: "SetComprehension",
                expression: firstExpr,
                item,
                iterable,
                condition,
            };
        }
        else {
            const elements = [firstExpr];
            while (this.match(TokenType.COMMA)) {
                if (this.check(TokenType.RBRACE))
                    break;
                elements.push(this.parseExpression());
            }
            this.consume(TokenType.RBRACE, "Expect '}' after set");
            return { type: "Set", elements };
        }
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
