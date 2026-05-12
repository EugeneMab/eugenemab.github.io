import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
async function test() {
    console.log("Running Compiler Tests...");
    const cases = [
        {
            name: "Basic Return",
            code: "def main():\n    return 42",
            expectedResult: 42,
        },
        {
            name: "Variables and Math",
            code: "def main():\n    x = 10\n    y = 20\n    return x + y",
            expectedResult: 30,
        },
        {
            name: "Subtraction and Locals",
            code: "def main():\n    a = 100\n    b = 40\n    c = a - b\n    return c - 10",
            expectedResult: 50,
        },
        {
            name: "Complex Math",
            code: "def main():\n    return (10 + 5) - (2 + 3)",
            expectedResult: 10,
        },
    ];
    let passed = 0;
    for (const c of cases) {
        try {
            const lexer = new Lexer(c.code);
            const tokens = lexer.tokenize();
            const parser = new Parser(tokens);
            const ast = parser.parse();
            const compiler = new Compiler();
            compiler.compileWAT(ast);
            const wasm = compiler.compileWASM(ast);
            // Verify by running in WASM runtime
            const { instance } = (await WebAssembly.instantiate(wasm));
            const result = instance.exports.main();
            if (result === c.expectedResult) {
                console.log(`✅ [PASS] ${c.name} (Result: ${result})`);
                passed++;
            }
            else {
                console.log(`❌ [FAIL] ${c.name}`);
                console.log(`   Expected: ${c.expectedResult}, Actual: ${result}`);
            }
        }
        catch (e) {
            console.log(`❌ [ERROR] ${c.name}: ${e}`);
        }
    }
    console.log(`\nTests: ${passed}/${cases.length} passed`);
    if (passed !== cases.length)
        process.exit(1);
}
test();
//# sourceMappingURL=compiler.test.js.map