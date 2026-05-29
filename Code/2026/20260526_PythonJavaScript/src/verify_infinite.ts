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
    print: (val: any) => {
      console.log(`Node Print: ${val}`);
      iterations++;
      if (iterations >= 5) {
        throw new Error("TERMINATE_FOR_VERIFICATION");
      }
      return 0;
    },
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    range: (start: number, stop?: number, step: number = 1) => {
      if (stop === undefined) {
        stop = start;
        start = 0;
      }
      const res = [];
      for (let i = start; i < stop; i += step) res.push(i);
      return res;
    },
    len: (obj: any) => obj.length,
    abs: Math.abs,
    math: Math,
    _slice: (obj: any, start: any, stop: any, _step: any) => {
      // Basic slice implementation for verification script
      return obj.slice(start, stop);
    },
    _is_truthy: (val: any) => {
      if (val === null || val === undefined) return false;
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val !== 0;
      if (typeof val === "bigint") return val !== 0n;
      if (typeof val === "string") return val.length > 0;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === "object") {
        if (Object.keys(val).length === 0) return false;
        return true;
      }
      return true;
    },
    _binop: (op: string, a: any, b: any) => {
      const isAInt = typeof a === "bigint" || Number.isInteger(a);
      const isBInt = typeof b === "bigint" || Number.isInteger(b);

      if (isAInt && isBInt) {
        const ba = BigInt(a);
        const bb = BigInt(b);
        let res;
        switch (op) {
          case "+":
            res = ba + bb;
            break;
          case "-":
            res = ba - bb;
            break;
          case "*":
            res = ba * bb;
            break;
          case "/":
            res = Number(ba) / Number(bb);
            break;
          case "===":
            return ba === bb;
          case "!==":
            return ba !== bb;
          case "<":
            return ba < bb;
          case ">":
            return ba > bb;
          case "<=":
            return ba <= bb;
          case ">=":
            return ba >= bb;
          default:
            throw new Error(`Operator ${op} not implemented for integers`);
        }
        if (
          res <= BigInt(Number.MAX_SAFE_INTEGER) &&
          res >= BigInt(Number.MIN_SAFE_INTEGER)
        ) {
          return Number(res);
        }
        return res;
      }

      switch (op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return a / b;
        case "===":
          return a === b;
        case "!==":
          return a !== b;
        case "<":
          return a < b;
        case ">":
          return a > b;
        case "<=":
          return a <= b;
        case ">=":
          return a >= b;
        default:
          throw new Error(`Operator ${op} not implemented`);
      }
    },
  };

  console.log("Starting Execution (will terminate after 5 iterations)...");

  const wrappedJs = jsCode.replace(
    "export async function main_wrapper",
    "async function main_wrapper",
  );
  const execute = new Function(
    "runtime",
    `
        ${wrappedJs}
        return main_wrapper(runtime);
    `,
  );

  try {
    await execute(runtime);
  } catch (err: any) {
    if (err.message === "TERMINATE_FOR_VERIFICATION") {
      console.log(
        "✅ Successfully terminated infinite loop after 5 iterations.",
      );
    } else {
      throw err;
    }
  }
}

run().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
