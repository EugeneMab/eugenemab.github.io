import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
function test() {
    console.log("Running Parser Tests...");
    const cases = [
        {
            name: "Basic Function AST",
            code: "def main():\n    return 42",
            validate: (ast) => {
                return (ast.body[0].type === "FunctionDef" &&
                    ast.body[0].name === "main" &&
                    ast.body[0].body[0].type === "Return" &&
                    ast.body[0].body[0].value.value === 42);
            },
        },
        {
            name: "Variables and Math AST",
            code: "def main():\n    x = 10\n    y = 20\n    return x + y",
            validate: (ast) => {
                const body = ast.body[0].body;
                return (body[0].type === "Assignment" &&
                    body[0].target === "x" &&
                    body[1].type === "Assignment" &&
                    body[1].target === "y" &&
                    body[2].type === "Return" &&
                    body[2].value.type === "BinaryExpression");
            },
        },
        {
            name: "Complex Expression AST",
            code: "def main():\n    return (1 + 2) - 3",
            validate: (ast) => {
                const ret = ast.body[0].body[0];
                return (ret.type === "Return" &&
                    ret.value.type === "BinaryExpression" &&
                    ret.value.operator === "-" &&
                    ret.value.left.type === "BinaryExpression" &&
                    ret.value.right.value === 3);
            },
        },
    ];
    let passed = 0;
    cases.forEach((c) => {
        try {
            const lexer = new Lexer(c.code);
            const tokens = lexer.tokenize();
            const parser = new Parser(tokens);
            const ast = parser.parse();
            if (c.validate(ast)) {
                console.log(`✅ [PASS] ${c.name}`);
                passed++;
            }
            else {
                console.log(`❌ [FAIL] ${c.name}`);
                console.log("   AST:", JSON.stringify(ast, null, 2));
            }
        }
        catch (e) {
            console.log(`❌ [ERROR] ${c.name}: ${e}`);
        }
    });
    // Test error cases
    const errorCases = [
        { name: "Unexpected token", code: "def main():\n    return 1 2" },
        { name: "Expect function name", code: "def ():" },
        { name: "Expect expression", code: "def main():\n    return +" },
    ];
    errorCases.forEach((ec) => {
        try {
            const lexer = new Lexer(ec.code);
            const tokens = lexer.tokenize();
            const parser = new Parser(tokens);
            parser.parse();
            console.log(`❌ [FAIL] ${ec.name}: Expected error`);
        }
        catch (e) {
            console.log(`✅ [PASS] ${ec.name} error caught: ${e}`);
            passed++;
        }
    });
    const total = cases.length + errorCases.length;
    console.log(`\nTests: ${passed}/${total} passed`);
    if (passed !== total)
        process.exit(1);
}
test();
//# sourceMappingURL=parser.test.js.map