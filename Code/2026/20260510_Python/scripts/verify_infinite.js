import { Lexer } from "../pub/js/lexer.js";
import { Parser } from "../pub/js/parser.js";
import { Compiler } from "../pub/js/compiler.js";
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
            },
            sleep: (ms) => {
                // Simple busy wait in Node for verification
                const start = Date.now();
                while (Date.now() - start < ms)
                    ;
            },
        },
    };
    console.log("Instantiating WASM...");
    const { instance } = (await WebAssembly.instantiate(wasm, importObject));
    console.log("Starting Execution (will terminate after 5 iterations)...");
    // We run the function in a way that we can "interrupt" it?
    // No, WASM execution is synchronous.
    // But our 'print' callback can throw an error to stop it!
    try {
        const main = instance.exports.main;
        // Patch print to throw after 5
        const originalPrint = importObject.env.print;
        importObject.env.print = (val) => {
            originalPrint(val);
            if (iterations >= 5) {
                throw new Error("TERMINATE_FOR_VERIFICATION");
            }
        };
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
