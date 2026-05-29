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
        __true: (val) => {
            if (val === null || val === undefined)
                return false;
            if (typeof val === "boolean")
                return val;
            if (typeof val === "number")
                return val !== 0;
            if (typeof val === "bigint")
                return val !== 0n;
            if (typeof val === "string")
                return val.length > 0;
            if (Array.isArray(val))
                return val.length > 0;
            if (typeof val === "object") {
                if (Object.keys(val).length === 0)
                    return false;
                return true;
            }
            return true;
        },
        __and: async (aFn, bFn) => {
            const a = await aFn();
            return runtime.__true(a) ? await bFn() : a;
        },
        __or: async (aFn, bFn) => {
            const a = await aFn();
            return runtime.__true(a) ? a : await bFn();
        },
        __item: (obj, idx) => {
            if (typeof idx === "number" &&
                idx < 0 &&
                (Array.isArray(obj) || typeof obj === "string")) {
                return obj[obj.length + idx];
            }
            return obj[idx];
        },
        __add: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) + BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a + b;
        },
        __sub: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) - BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a - b;
        },
        __mul: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                const res = BigInt(a) * BigInt(b);
                return res <= BigInt(Number.MAX_SAFE_INTEGER) &&
                    res >= BigInt(Number.MIN_SAFE_INTEGER)
                    ? Number(res)
                    : res;
            }
            return a * b;
        },
        __div: (a, b) => {
            return Number(a) / Number(b);
        },
        __eq: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) === BigInt(b);
            }
            return a === b;
        },
        __ne: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) !== BigInt(b);
            }
            return a !== b;
        },
        __lt: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) < BigInt(b);
            }
            return a < b;
        },
        __gt: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) > BigInt(b);
            }
            return a > b;
        },
        __le: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) <= BigInt(b);
            }
            return a <= b;
        },
        __ge: (a, b) => {
            if ((typeof a === "bigint" || Number.isInteger(a)) &&
                (typeof b === "bigint" || Number.isInteger(b))) {
                return BigInt(a) >= BigInt(b);
            }
            return a >= b;
        },
        __slice: (obj, start, stop, _step) => {
            // Basic slice implementation for verification script
            return obj.slice(start, stop);
        },
        __iter: (obj) => obj,
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
