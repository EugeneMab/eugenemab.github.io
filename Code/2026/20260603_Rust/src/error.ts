import { Token } from "./lexer.js";

export function formatError(
  source: string,
  message: string,
  token: Token,
): string {
  const lines = source.split("\n");
  const lineNum = token.line;
  const colNum = token.col;
  const rawLine = lines[lineNum - 1] || "";

  const marker = " ".repeat(Math.max(0, colNum - 1)) + "####";

  return `Error at line ${lineNum}, column ${colNum}: ${message}\n\n${rawLine}\n${marker}`;
}
