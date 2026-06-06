import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";

async function runRust(code: string): Promise<{ logs: string[]; result: any }> {
  console.log("Running Code:", code);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  console.log("Tokens:", tokens.map((t) => `${t.value}(${t.type})`).join(" "));
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const emitter = new Emitter(ast);
  const wasm = emitter.emitWASM();

  const logs: string[] = [];
  const importObject = {
    env: {
      print: (val: number) => {
        console.log(
          "Host print called with:",
          val,
          "args:",
          JSON.stringify(Array.from(arguments as any)),
        );
        logs.push(String(val));
        return 0;
      },
      panic: (code: number) => {
        throw new Error(`Panic! Error code: ${code}`);
      },
    },
  };

  const { instance } = (await WebAssembly.instantiate(
    wasm,
    importObject,
  )) as any;
  const result = (instance.exports as any).main();
  return { logs, result };
}

describe("Simple Math Test", () => {
  it("should evaluate % correctly", async () => {
    const { logs } = await runRust(`fn main() { print!(100 % 3); }`);
    expect(logs).toEqual(["1"]);
  });
});
