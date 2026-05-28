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
    const jsCode = compiler.compileJS(ast);
    let iterations = 0;
    const runtime = {
        print: (val) => {
            console.log(`Node Print: ${val}`);
            iterations++;
            if (iterations >= 5) {
                throw new Error("TERMINATE_FOR_VERIFICATION");
            }
            return 0;
        },
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        range: (start, stop, step = 1) => {
            if (stop === undefined) {
                stop = start;
                start = 0;
            }
            const res = [];
            for (let i = start; i < stop; i += step)
                res.push(i);
            return res;
        },
        len: (obj) => obj.length,
        abs: Math.abs,
        math: Math,
        _slice: (obj, start, stop, _step) => {
            // Basic slice implementation for verification script
            return obj.slice(start, stop);
        },
    };
    console.log("Starting Execution (will terminate after 5 iterations)...");
    const wrappedJs = jsCode.replace("export async function main_wrapper", "async function main_wrapper");
    const execute = new Function("runtime", `
        ${wrappedJs}
        return main_wrapper(runtime);
    `);
    try {
        await execute(runtime);
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
