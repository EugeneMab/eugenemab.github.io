import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";

describe("Parser Legacy Tests", () => {
  const cases = [
    {
      name: "Basic Function AST",
      code: "def main():\n    return 42",
      validate: (ast: any) => {
        return (
          ast.body[0].type === "FunctionDef" &&
          ast.body[0].name === "main" &&
          ast.body[0].body[0].type === "Return" &&
          ast.body[0].body[0].value.value === 42
        );
      },
    },
    {
      name: "Variables and Math AST",
      code: "def main():\n    x = 10\n    y = 20\n    return x + y",
      validate: (ast: any) => {
        const body = ast.body[0].body;
        return (
          body[0].type === "Assignment" &&
          body[0].target === "x" &&
          body[1].type === "Assignment" &&
          body[1].target === "y" &&
          body[2].type === "Return" &&
          body[2].value.type === "BinaryExpression"
        );
      },
    },
    {
      name: "Complex Expression AST",
      code: "def main():\n    return (1 + 2) - 3",
      validate: (ast: any) => {
        const ret = ast.body[0].body[0];
        return (
          ret.type === "Return" &&
          ret.value.type === "BinaryExpression" &&
          ret.value.operator === "-" &&
          ret.value.left.type === "BinaryExpression" &&
          ret.value.right.value === 3
        );
      },
    },
    {
      name: "Pass Statement AST",
      code: "if x == 42:\n    pass\nelse:\n    pass",
      validate: (ast: any) => {
        const ifNode = ast.body[0];
        return (
          ifNode.type === "If" &&
          ifNode.thenBranch[0].type === "Pass" &&
          ifNode.elseBranch[0].type === "Pass"
        );
      },
    },
  ];

  for (const c of cases) {
    it(`should pass case: ${c.name}`, () => {
      const lexer = new Lexer(c.code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      expect(c.validate(ast)).toBe(true);
    });
  }

  const errorCases = [
    { name: "Unexpected token", code: "def main():\n    return 1 2" },
    { name: "Expect function name", code: "def ():" },
    { name: "Expect expression", code: "def main():\n    return +" },
  ];

  for (const ec of errorCases) {
    it(`should throw on ${ec.name}`, () => {
      const lexer = new Lexer(ec.code);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      expect(() => parser.parse()).toThrow();
    });
  }
});
