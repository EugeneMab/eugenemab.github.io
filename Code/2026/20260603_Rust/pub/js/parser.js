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
        const attributes = [];
        while (this.match(TokenType.HASH)) {
            this.consume(TokenType.LBRACKET, "Expect '[' after '#'");
            let attr = "";
            while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
                const token = this.advance();
                attr += token.value;
                if (token.type === TokenType.LPAREN) {
                    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
                        attr += this.advance().value;
                    }
                    attr += this.consume(TokenType.RPAREN, "Expect ')'").value;
                }
            }
            this.consume(TokenType.RBRACKET, "Expect ']' after attribute");
            attributes.push(attr);
        }
        if (this.match(TokenType.LET))
            return this.parseLetStatement();
        if (this.match(TokenType.CONST))
            return this.parseConstStatement();
        if (this.match(TokenType.FN))
            return this.parseFunctionDeclaration(attributes);
        if (this.match(TokenType.STRUCT))
            return this.parseStructDeclaration(attributes);
        if (this.match(TokenType.IMPL))
            return this.parseImplDeclaration();
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
    parseType() {
        let type = "";
        if (this.match(TokenType.LPAREN)) {
            type = "(";
            if (!this.check(TokenType.RPAREN)) {
                do {
                    type += (type === "(" ? "" : ", ") + this.parseType();
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RPAREN, "Expect ')' after tuple type");
            type += ")";
            return type;
        }
        while (this.match(TokenType.AMPERSAND, TokenType.MUT, TokenType.IDENTIFIER)) {
            type += (type ? " " : "") + this.previous().value;
        }
        if (type === "") {
            throw new Error(formatError(this.source, "Expect type name", this.peek()));
        }
        return type;
    }
    parseFunctionDeclaration(attributes = [], implTarget) {
        const token = this.previous();
        const name = this.consume(TokenType.IDENTIFIER, "Expect function name").value;
        this.consume(TokenType.LPAREN, "Expect '(' after function name");
        const params = [];
        if (!this.check(TokenType.RPAREN)) {
            do {
                if (implTarget !== undefined && this.check(TokenType.AMPERSAND)) {
                    // &self or &mut self
                    this.advance(); // consume &
                    const isMut = this.match(TokenType.MUT);
                    const selfTok = this.consume(TokenType.IDENTIFIER, "Expect 'self' after '&'");
                    params.push({
                        name: selfTok.value,
                        type: isMut ? `&mut ${implTarget}` : `&${implTarget}`,
                    });
                }
                else if (implTarget !== undefined &&
                    this.peek().type === TokenType.IDENTIFIER &&
                    this.peek().value === "self" &&
                    this.tokens[this.pos + 1]?.type !== TokenType.COLON) {
                    // bare self (value-consuming)
                    this.advance();
                    params.push({ name: "self", type: implTarget });
                }
                else {
                    const pName = this.consume(TokenType.IDENTIFIER, "Expect parameter name").value;
                    let pType;
                    if (this.match(TokenType.COLON)) {
                        pType = this.parseType();
                    }
                    params.push({ name: pName, type: pType });
                }
            } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, "Expect ')' after parameters");
        let returnType;
        if (this.match(TokenType.ARROW)) {
            returnType = this.parseType();
            // Replace "Self" with the impl target type
            if (implTarget !== undefined && returnType === "Self") {
                returnType = implTarget;
            }
        }
        const body = this.parseBlockStatement();
        return {
            type: "FunctionDeclaration",
            token,
            name,
            params,
            returnType,
            body,
            attributes,
        };
    }
    parseImplDeclaration() {
        const token = this.previous();
        const target = this.consume(TokenType.IDENTIFIER, "Expect struct name after 'impl'").value;
        this.consume(TokenType.LBRACE, "Expect '{' after impl name");
        const functions = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            const attributes = [];
            while (this.match(TokenType.HASH)) {
                this.consume(TokenType.LBRACKET, "Expect '[' after '#'");
                let attr = "";
                while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
                    const tok = this.advance();
                    attr += tok.value;
                    if (tok.type === TokenType.LPAREN) {
                        while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
                            attr += this.advance().value;
                        }
                        attr += this.consume(TokenType.RPAREN, "Expect ')'").value;
                    }
                }
                this.consume(TokenType.RBRACKET, "Expect ']' after attribute");
                attributes.push(attr);
            }
            this.consume(TokenType.FN, "Expect 'fn' in impl block");
            functions.push(this.parseFunctionDeclaration(attributes, target));
        }
        this.consume(TokenType.RBRACE, "Expect '}' after impl block");
        return { type: "ImplDeclaration", token, target, functions };
    }
    parseStructDeclaration(attributes = []) {
        const token = this.previous();
        const name = this.consume(TokenType.IDENTIFIER, "Expect struct name").value;
        if (this.match(TokenType.LBRACE)) {
            const fields = [];
            if (!this.check(TokenType.RBRACE)) {
                do {
                    if (this.check(TokenType.RBRACE))
                        break;
                    const fName = this.consume(TokenType.IDENTIFIER, "Expect field name").value;
                    this.consume(TokenType.COLON, "Expect ':' after field name");
                    const fType = this.parseType();
                    fields.push({ name: fName, type: fType });
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RBRACE, "Expect '}' after struct fields");
            return {
                type: "RegularStructDeclaration",
                token,
                name,
                fields,
                attributes,
            };
        }
        else if (this.match(TokenType.LPAREN)) {
            const fields = [];
            if (!this.check(TokenType.RPAREN)) {
                do {
                    if (this.check(TokenType.RPAREN))
                        break;
                    fields.push(this.parseType());
                } while (this.match(TokenType.COMMA));
            }
            this.consume(TokenType.RPAREN, "Expect ')' after tuple struct fields");
            this.consume(TokenType.SEMICOLON, "Expect ';' after tuple struct");
            return {
                type: "TupleStructDeclaration",
                token,
                name,
                fields,
                attributes,
            };
        }
        else {
            this.consume(TokenType.SEMICOLON, "Expect ';' after unit struct");
            return { type: "UnitStructDeclaration", token, name, attributes };
        }
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
            if (expr.type === "Identifier" ||
                expr.type === "MemberAccessExpression" ||
                expr.type === "IndexExpression") {
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
        const expr = this.parseLogicalOr();
        if (this.match(TokenType.DOT_DOT)) {
            const token = this.previous();
            let end;
            // Ranges can be open-ended, e.g., s[..] or s[0..]
            if (!this.check(TokenType.RBRACKET, TokenType.COMMA, TokenType.SEMICOLON, TokenType.RPAREN, TokenType.RBRACE)) {
                end = this.parseLogicalOr();
            }
            return { type: "RangeExpression", token, start: expr, end };
        }
        return expr;
    }
    parseLogicalOr() {
        let expr = this.parseLogicalAnd();
        while (this.match(TokenType.OR_OR)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseLogicalAnd();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
        }
        return expr;
    }
    parseLogicalAnd() {
        let expr = this.parseComparison();
        while (this.match(TokenType.AND_AND)) {
            const token = this.previous();
            const operator = token.value;
            const right = this.parseComparison();
            expr = { type: "BinaryExpression", token, operator, left: expr, right };
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
                if (!this.match(TokenType.IDENTIFIER, TokenType.INTEGER)) {
                    throw new Error(formatError(this.source, "Expect member name or index after '.'", this.peek()));
                }
                const member = this.previous().value;
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
                        if (this.check(TokenType.RPAREN))
                            break;
                        args.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after args");
                return { type: "CallExpression", token, callee: name, args };
            }
            if (this.check(TokenType.LBRACE) && this.isStructLiteralLookahead()) {
                this.advance(); // consume {
                const fields = [];
                let base;
                if (!this.check(TokenType.RBRACE)) {
                    do {
                        if (this.match(TokenType.DOT_DOT)) {
                            base = this.parseExpression();
                            break;
                        }
                        if (this.check(TokenType.RBRACE))
                            break;
                        const fName = this.consume(TokenType.IDENTIFIER, "Expect field name").value;
                        let value;
                        if (this.match(TokenType.COLON)) {
                            value = this.parseExpression();
                        }
                        else {
                            value = { type: "Identifier", token, name: fName };
                        }
                        fields.push({ name: fName, value });
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RBRACE, "Expect '}' after struct fields");
                return { type: "StructLiteral", token, name, fields, base };
            }
            return { type: "Identifier", token, name };
        }
        if (this.match(TokenType.LPAREN)) {
            const token = this.previous();
            if (this.match(TokenType.RPAREN)) {
                return { type: "TupleLiteral", token, elements: [] };
            }
            const expr = this.parseExpression();
            if (this.match(TokenType.COMMA)) {
                const elements = [expr];
                if (!this.check(TokenType.RPAREN)) {
                    do {
                        elements.push(this.parseExpression());
                    } while (this.match(TokenType.COMMA));
                }
                this.consume(TokenType.RPAREN, "Expect ')' after tuple");
                return { type: "TupleLiteral", token, elements };
            }
            this.consume(TokenType.RPAREN, "Expect ')' after expression");
            return expr;
        }
        throw new Error(formatError(this.source, `Expect expression, found '${this.peek().value}'`, this.peek()));
    }
    isStructLiteralLookahead() {
        const next = this.tokens[this.pos + 1];
        if (!next)
            return false;
        if (next.type === TokenType.RBRACE)
            return true; // Identifier {}
        if (next.type === TokenType.DOT_DOT)
            return true; // Identifier { .. }
        if (next.type === TokenType.IDENTIFIER) {
            const nextNext = this.tokens[this.pos + 2];
            if (!nextNext)
                return false;
            return (nextNext.type === TokenType.COLON || // Identifier { name:
                nextNext.type === TokenType.COMMA || // Identifier { name,
                nextNext.type === TokenType.RBRACE // Identifier { name }
            );
        }
        return false;
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
