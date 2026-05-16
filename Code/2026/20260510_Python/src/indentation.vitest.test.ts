import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
import * as fs from "fs";
import * as path from "path";

describe("Compiler WAT Indentation", () => {
  const compiler = new Compiler();

  const testIndentation = (
    name: string,
    pythonCode: string,
    expectedLines: string[],
  ) => {
    const tokens = new Lexer(pythonCode).tokenize();
    const ast = new Parser(tokens).parse();
    const wat = compiler.compileWAT(ast);

    // Save verbose output to test_output folder
    const outputDir = path.join(process.cwd(), "test_output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const safeName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    fs.writeFileSync(path.join(outputDir, `indent_${safeName}.wat`), wat);

    // Check that each expected line exists with its relative indentation
    // We trim the expectations and the actual lines to check for existence,
    // but the test name implies we care about the overall structure.
    for (const expected of expectedLines) {
      // For now, we still check the exact string as it includes the indentation
      // that this specific test suite is intended to verify.
      expect(wat).toContain(expected);
    }
  };

  it("should correctly indent if-else blocks", () => {
    const code = `
def main():
    x = 42
    if x > 0:
        return 1
    else:
        return 0
`;
    testIndentation("if_else", code, [
      "    if\n      i32.const 1\n      return\n    else\n      i32.const 0\n      return\n    end",
    ]);
  });

  it("should correctly indent while loop blocks", () => {
    const code = `
def main():
    while True:
        print(1)
`;
    testIndentation("while_loop", code, [
      "    block\n      loop\n        i32.const 1\n        i32.eqz\n        br_if 1\n        i32.const 1\n        call $print\n        br 0\n      end",
    ]);
  });

  it("should correctly indent nested blocks", () => {
    const code = `
def main():
    if True:
        while True:
            return 1
`;
    // Nested blocks should have cumulative indentation
    testIndentation("nested_blocks", code, [
      "    if\n      block\n        loop\n          i32.const 1\n          i32.eqz\n          br_if 1\n          i32.const 1\n          return\n          br 0\n        end\n      end\n    end",
    ]);
  });
});
