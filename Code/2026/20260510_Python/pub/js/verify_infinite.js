import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
async function run() {
    const code = `def main():
    index = 0
    while True:
        print(index)
        sleep(10)
        index = index + 1
    return index
`;
    console.log("Lexing...");
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    console.log("Parsing...");
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log("Compiling...");
    const compiler = new Compiler();
    const wasm = compiler.compileWASM(ast);
    let iterations = 0;
    const importObject = {
        env: {
            print: (val) => {
                console.log(`Node Print: ${val}`);
                iterations++;
                if (iterations >= 5) {
                    throw new Error("TERMINATE_FOR_VERIFICATION");
                }
                return 0;
            },
            sleep: (ms) => {
                // Simple busy wait in Node for verification
                const start = Date.now();
                while (Date.now() - start < ms)
                    ;
                return 0;
            },
        },
    };
    console.log("Instantiating WASM...");
    const { instance } = (await WebAssembly.instantiate(wasm, importObject));
    console.log("Starting Execution (will terminate after 5 iterations)...");
    try {
        const main = instance.exports.main;
        main();
    }
    catch (err) {
        if (err.message === "TERMINATE_FOR_VERIFICATION") {
            console.log("✅ Successfully terminated infinite loop after 5 iterations.");
        }
        else {
            throw err;
        }
    }
}
run().catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
});
