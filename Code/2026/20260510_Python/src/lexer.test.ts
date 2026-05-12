import { Lexer, TokenType } from "./lexer.js";

function test() {
  console.log("Running Lexer Tests...");

  const cases = [
    {
      name: "Basic Function",
      code: "def main():\n    return 42",
      expected: [
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.RETURN,
        TokenType.NUMBER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
    {
      name: "Variables and Math",
      code: "def main():\n    x = 10\n    y = 20\n    return x + y",
      expected: [
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.EQUALS,
        TokenType.NUMBER,
        TokenType.NEWLINE,
        TokenType.IDENTIFIER,
        TokenType.EQUALS,
        TokenType.NUMBER,
        TokenType.NEWLINE,
        TokenType.RETURN,
        TokenType.IDENTIFIER,
        TokenType.PLUS,
        TokenType.IDENTIFIER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
    {
      name: "Comments and Tabs",
      code: "# This is a comment\ndef main():\n\tx = 5 # comment\n\treturn x - 2",
      expected: [
        TokenType.NEWLINE,
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.IDENTIFIER,
        TokenType.EQUALS,
        TokenType.NUMBER,
        TokenType.NEWLINE,
        TokenType.RETURN,
        TokenType.IDENTIFIER,
        TokenType.MINUS,
        TokenType.NUMBER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
    {
      name: "Multiple Dedents",
      code: "def outer():\n    def inner():\n        return 1\n    return 2",
      expected: [
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.DEF,
        TokenType.IDENTIFIER,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.COLON,
        TokenType.NEWLINE,
        TokenType.INDENT,
        TokenType.RETURN,
        TokenType.NUMBER,
        TokenType.NEWLINE,
        TokenType.DEDENT,
        TokenType.RETURN,
        TokenType.NUMBER,
        TokenType.DEDENT,
        TokenType.EOF,
      ],
    },
  ];

  let passed = 0;
  cases.forEach((c) => {
    try {
      const lexer = new Lexer(c.code);
      const tokens = lexer.tokenize();
      const types = tokens.map((t) => t.type);

      const isMatch = JSON.stringify(types) === JSON.stringify(c.expected);
      if (isMatch) {
        console.log(`✅ [PASS] ${c.name}`);
        passed++;
      } else {
        console.log(`❌ [FAIL] ${c.name}`);
        console.log("   Expected:", c.expected.join(", "));
        console.log("   Actual:  ", types.join(", "));
      }
    } catch (e) {
      console.log(`❌ [ERROR] ${c.name}: ${e}`);
    }
  });

  // Test error case
  try {
    console.log("Testing unexpected character error...");
    const lexer = new Lexer("@");
    lexer.tokenize();
    console.log("❌ [FAIL] Expected error for @");
  } catch {
    console.log("✅ [PASS] Unexpected character error caught");
    passed++;
  }
  const total = cases.length + 1;
  console.log(`\nTests: ${passed}/${total} passed`);
  if (passed !== total) process.exit(1);
}

test();
