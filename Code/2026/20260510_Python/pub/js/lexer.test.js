import { Lexer, TokenType } from "./lexer.js";
function test() {
    console.log("Running Lexer Tests...");
    const cases = [
        {
            name: "Basic Function",
            code: "def main():\n    return 42",
            expected: [
                TokenType.DEF,
                TokenType.IDENTIFIER,
                TokenType.LPAREN,
                TokenType.RPAREN,
                TokenType.COLON,
                TokenType.NEWLINE,
                TokenType.INDENT,
                TokenType.RETURN,
                TokenType.NUMBER,
                TokenType.DEDENT,
                TokenType.EOF,
            ],
        },
        {
            name: "Variables and Math",
            code: "def main():\n    x = 10\n    y = 20\n    return x + y",
            expected: [
                TokenType.DEF,
                TokenType.IDENTIFIER,
                TokenType.LPAREN,
                TokenType.RPAREN,
                TokenType.COLON,
                TokenType.NEWLINE,
                TokenType.INDENT,
                TokenType.IDENTIFIER,
                TokenType.EQUALS,
                TokenType.NUMBER,
                TokenType.NEWLINE,
                TokenType.IDENTIFIER,
                TokenType.EQUALS,
                TokenType.NUMBER,
                TokenType.NEWLINE,
                TokenType.RETURN,
                TokenType.IDENTIFIER,
                TokenType.PLUS,
                TokenType.IDENTIFIER,
                TokenType.DEDENT,
                TokenType.EOF,
            ],
        },
    ];
    let passed = 0;
    cases.forEach((c) => {
        const lexer = new Lexer(c.code);
        const tokens = lexer.tokenize();
        const types = tokens.map((t) => t.type);
        const isMatch = JSON.stringify(types) === JSON.stringify(c.expected);
        if (isMatch) {
            console.log(`✅ [PASS] ${c.name}`);
            passed++;
        }
        else {
            console.log(`❌ [FAIL] ${c.name}`);
            console.log("   Expected:", c.expected.join(", "));
            console.log("   Actual:  ", types.join(", "));
        }
    });
    console.log(`\nTests: ${passed}/${cases.length} passed`);
    if (passed !== cases.length)
        process.exit(1);
}
test();
//# sourceMappingURL=lexer.test.js.map