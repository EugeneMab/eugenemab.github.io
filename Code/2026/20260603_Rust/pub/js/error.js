export function formatError(source, message, token) {
    const lines = source.split("\n");
    const lineNum = token.line;
    const colNum = token.col;
    const rawLine = lines[lineNum - 1] || "";
    const embeddedLine = rawLine.slice(0, colNum - 1) + rawLine.slice(colNum - 1) + "####";
    return `Error at line ${lineNum}, column ${colNum}: ${message}\n\n${embeddedLine}`;
}
