// src/compiler.ts
import {
  ProgramNode,
  ASTNode,
  FunctionDefNode,
  ReturnNode,
  AssignmentNode,
  BinaryExpressionNode,
  LiteralNode,
  IdentifierNode,
} from "./parser.js";

export class Compiler {
  private locals: Map<string, number> = new Map();
  private localIndex: number = 0;

  compileWAT(program: ProgramNode): string {
    let wat = `(module\n`;
    for (const node of program.body) {
      if (node.type === "FunctionDef") {
        wat += this.emitFunctionWAT(node);
      }
    }
    wat += `)\n`;
    return wat;
  }

  private emitFunctionWAT(node: FunctionDefNode): string {
    this.locals.clear();
    this.localIndex = 0;

    // Pre-scan for locals to declare them
    const localDecls: string[] = [];
    const scanBody = (nodes: ASTNode[]) => {
      for (const n of nodes) {
        if (n.type === "Assignment") {
          if (!this.locals.has(n.target)) {
            this.locals.set(n.target, this.localIndex++);
            localDecls.push(`(local $${n.target} i32)`);
          }
        }
      }
    };
    scanBody(node.body);

    const bodyLines: string[] = [];
    for (const stmt of node.body) {
      const stmtWat = this.emitStatementWAT(stmt);
      if (stmtWat) {
        bodyLines.push(...stmtWat.split("\n"));
      }
    }

    const allLines = [...localDecls, ...bodyLines].filter(
      (line) => line.trim().length > 0,
    );

    return (
      `  (func $${node.name} (result i32)\n` +
      `    ${allLines.join("\n    ")}\n` +
      `  )\n` +
      `  (export "${node.name}" (func $${node.name}))\n`
    );
  }

  private emitStatementWAT(node: ASTNode): string {
    switch (node.type) {
      case "Return":
        return this.emitExpressionWAT(node.value) + "\nreturn";
      case "Assignment":
        return (
          this.emitExpressionWAT(node.value) + `\nlocal.set $${node.target}`
        );
      default:
        return "";
    }
  }

  private emitExpressionWAT(node: ASTNode): string {
    switch (node.type) {
      case "Literal":
        return `i32.const ${node.value}`;
      case "Identifier":
        return `local.get $${node.name}`;
      case "BinaryExpression":
        return (
          this.emitExpressionWAT(node.left) +
          "\n" +
          this.emitExpressionWAT(node.right) +
          "\n" +
          (node.operator === "+" ? "i32.add" : "i32.sub")
        );
      default:
        return "";
    }
  }

  // --- WASM Binary Emitter ---

  compileWASM(program: ProgramNode): Uint8Array {
    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];

    const sections: number[][] = [];

    // 1. Type Section
    const typeSection = this.createSection(1, [
      this.encodeVector([
        [0x60, 0x00, 0x01, 0x7f], // (func () (result i32))
      ]),
    ]);

    // 3. Function Section
    const funcSection = this.createSection(3, [
      this.encodeVector([0x00]), // Function 0 uses Type 0
    ]);

    // 7. Export Section
    const mainFunc = program.body.find(
      (n) => n.type === "FunctionDef",
    ) as FunctionDefNode;
    const exportSection = this.createSection(7, [
      this.encodeVector([
        [...this.encodeString(mainFunc.name), 0x00, 0x00], // func 0
      ]),
    ]);

    // 10. Code Section
    const code = this.emitFunctionBinary(mainFunc);
    const codeSection = this.createSection(10, [this.encodeVector([code])]);

    return new Uint8Array([
      ...magic,
      ...version,
      ...typeSection,
      ...funcSection,
      ...exportSection,
      ...codeSection,
    ]);
  }

  private createSection(id: number, content: any[]): number[] {
    const bytes = content.flat();
    return [id, ...this.encodeUnsignedLEB128(bytes.length), ...bytes];
  }

  private encodeVector(items: any[]): number[] {
    const flatItems = items.flat();
    return [...this.encodeUnsignedLEB128(items.length), ...flatItems];
  }

  private encodeString(s: string): number[] {
    const bytes = new TextEncoder().encode(s);
    return [...this.encodeUnsignedLEB128(bytes.length), ...Array.from(bytes)];
  }

  private emitFunctionBinary(node: FunctionDefNode): number[] {
    this.locals.clear();
    this.localIndex = 0;

    // Pre-scan for locals
    const localTypes: number[] = [];
    for (const stmt of node.body) {
      if (stmt.type === "Assignment" && !this.locals.has(stmt.target)) {
        this.locals.set(stmt.target, this.localIndex++);
        localTypes.push(0x7f); // i32
      }
    }

    // Local declarations in WASM binary are grouped by type
    // For simplicity, we treat each local as a separate group of 1
    const localDecls = localTypes.map((t) => [0x01, t]).flat();
    const localVec = [
      ...this.encodeUnsignedLEB128(localTypes.length),
      ...localDecls,
    ];

    const body: number[] = [];
    for (const stmt of node.body) {
      body.push(...this.emitStatementBinary(stmt));
    }
    body.push(0x0b); // end

    const fullFunc = [...localVec, ...body];
    return [...this.encodeUnsignedLEB128(fullFunc.length), ...fullFunc];
  }

  private emitStatementBinary(node: ASTNode): number[] {
    switch (node.type) {
      case "Return":
        return [...this.emitExpressionBinary(node.value), 0x0f]; // return
      case "Assignment":
        const idx = this.locals.get(node.target)!;
        return [
          ...this.emitExpressionBinary(node.value),
          0x21,
          ...this.encodeUnsignedLEB128(idx),
        ]; // local.set
      default:
        return [];
    }
  }

  private emitExpressionBinary(node: ASTNode): number[] {
    switch (node.type) {
      case "Literal":
        return [0x41, ...this.encodeSignedLEB128(node.value)]; // i32.const
      case "Identifier":
        const idx = this.locals.get(node.name)!;
        return [0x20, ...this.encodeUnsignedLEB128(idx)]; // local.get
      case "BinaryExpression":
        return [
          ...this.emitExpressionBinary(node.left),
          ...this.emitExpressionBinary(node.right),
          node.operator === "+" ? 0x6a : 0x6b, // i32.add / i32.sub
        ];
      default:
        return [];
    }
  }

  private encodeUnsignedLEB128(n: number): number[] {
    const buffer = [];
    do {
      let byte = n & 0x7f;
      n >>>= 7;
      if (n !== 0) byte |= 0x80;
      buffer.push(byte);
    } while (n !== 0);
    return buffer;
  }

  private encodeSignedLEB128(n: number): number[] {
    const buffer = [];
    while (true) {
      let byte = n & 0x7f;
      n >>= 7;
      if (
        (n === 0 && (byte & 0x40) === 0) ||
        (n === -1 && (byte & 0x40) !== 0)
      ) {
        buffer.push(byte);
        break;
      } else {
        buffer.push(byte | 0x80);
      }
    }
    return buffer;
  }
}
