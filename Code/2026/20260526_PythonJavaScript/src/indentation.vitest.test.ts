import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";
import { Compiler } from "./compiler.ts";

describe("Compiler JS Indentation", () => {
  const testIndentation = (code: string, expectedLines: string[]) => {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const compiler = new Compiler();
    const js = compiler.compileJS(ast);

    for (const expected of expectedLines) {
      expect(js).toContain(expected);
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
    testIndentation(code, [
      "    if (__true(__gt(x, 0))) {",
      "      return 1;",
      "    } else {",
      "      return 0;",
      "    }",
    ]);
  });

  it("should correctly indent while loop blocks", () => {
    const code = `
def main():
    while 1:
        print(1)
`;
    testIndentation(code, [
      "    while (__true(1)) {",
      "      print(1);",
      "    }",
    ]);
  });

  it("should correctly indent nested blocks", () => {
    const code = `
def main():
    if 1:
        while 1:
            return 1
`;
    testIndentation(code, [
      "    if (__true(1)) {",
      "      while (__true(1)) {",
      "        return 1;",
      "      }",
      "    }",
    ]);
  });
});
