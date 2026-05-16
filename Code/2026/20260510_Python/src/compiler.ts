// src/compiler.ts
import { ProgramNode, ASTNode, FunctionDefNode } from "./parser.js";

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
      `    i32.const 0\n` +
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
      case "While": {
        const loopContent =
          this.emitExpressionWAT(node.condition) +
          "\ni32.eqz\nbr_if 1\n" +
          node.body
            .map((s) => this.emitStatementWAT(s))
            .filter((s) => s)
            .join("\n") +
          "\nbr 0";
        return (
          `block\n` +
          `  loop\n` +
          `${this.indent(this.indent(loopContent))}\n` +
          `  end\n` +
          `end`
        );
      }
      case "If": {
        const thenBranch = this.indent(
          node.thenBranch
            .map((s) => this.emitStatementWAT(s))
            .filter((s) => s)
            .join("\n"),
        );
        const elseBranch = node.elseBranch
          ? `else\n${this.indent(
              node.elseBranch
                .map((s) => this.emitStatementWAT(s))
                .filter((s) => s)
                .join("\n"),
            )}\n`
          : "";
        return (
          `${this.emitExpressionWAT(node.condition)}\n` +
          `if\n` +
          `${thenBranch}\n` +
          `${elseBranch}` +
          `end`
        );
      }
      case "CallExpression":
        return (
          node.args.map((a) => this.emitExpressionWAT(a)).join("\n") +
          `\ncall $${node.callee}`
        );
      default:
        return "";
    }
  }

  private indent(text: string): string {
    if (!text) return "";
    return text
      .split("\n")
      .map((line) => "  " + line)
      .join("\n");
  }

  private emitExpressionWAT(node: ASTNode): string {
    switch (node.type) {
      case "Literal":
        return `i32.const ${node.value}`;
      case "Identifier":
        return `local.get $${node.name}`;
      case "BinaryExpression":
        let op = "";
        switch (node.operator) {
          case "+":
            op = "i32.add";
            break;
          case "-":
            op = "i32.sub";
            break;
          case "*":
            op = "i32.mul";
            break;
          case "/":
            op = "i32.div_s";
            break;
          case "==":
            op = "i32.eq";
            break;
          case "!=":
            op = "i32.ne";
            break;
          case "<":
            op = "i32.lt_s";
            break;
          case ">":
            op = "i32.gt_s";
            break;
          case "and":
            return (
              this.emitExpressionWAT(node.left) +
              `\ni32.const 0\ni32.ne\n` +
              this.emitExpressionWAT(node.right) +
              `\ni32.const 0\ni32.ne\ni32.and`
            );
          case "or":
            return (
              this.emitExpressionWAT(node.left) +
              `\ni32.const 0\ni32.ne\n` +
              this.emitExpressionWAT(node.right) +
              `\ni32.const 0\ni32.ne\ni32.or`
            );
        }
        return (
          this.emitExpressionWAT(node.left) +
          "\n" +
          this.emitExpressionWAT(node.right) +
          "\n" +
          op
        );
      case "UnaryExpression":
        if (node.operator === "-") {
          return (
            `i32.const 0\n` +
            this.emitExpressionWAT(node.argument) +
            `\ni32.sub`
          );
        }
        if (node.operator === "not") {
          return this.emitExpressionWAT(node.argument) + `\ni32.eqz`;
        }
        return this.emitExpressionWAT(node.argument);
      case "CallExpression":
        return (
          node.args.map((a) => this.emitExpressionWAT(a)).join("\n") +
          `\ncall $${node.callee}`
        );
      default:
        return "";
    }
  }

  // --- WASM Binary Emitter ---

  compileWASM(program: ProgramNode): Uint8Array {
    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];

    // 1. Type Section
    const typeSection = this.createSection(1, [
      this.encodeVector([
        [0x60, 0x01, 0x7f, 0x00], // Type 0: (i32) -> void
        [0x60, 0x00, 0x01, 0x7f], // Type 1: () -> i32
      ]),
    ]);

    // 2. Import Section
    const importSection = this.createSection(2, [
      this.encodeVector([
        [
          ...this.encodeString("env"),
          ...this.encodeString("print"),
          0x00,
          0x00,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("sleep"),
          0x00,
          0x00,
        ],
      ]),
    ]);

    // 3. Function Section
    const funcSection = this.createSection(3, [
      this.encodeVector([0x01]), // main uses Type 1
    ]);

    // 7. Export Section
    const mainFunc = program.body.find(
      (n) => n.type === "FunctionDef",
    ) as FunctionDefNode;
    const exportSection = this.createSection(7, [
      this.encodeVector([
        [...this.encodeString(mainFunc.name), 0x00, 0x02], // main index is 2
      ]),
    ]);

    // 10. Code Section
    const code = this.emitFunctionBinary(mainFunc);
    const codeSection = this.createSection(10, [this.encodeVector([code])]);

    return new Uint8Array([
      ...magic,
      ...version,
      ...typeSection,
      ...importSection,
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
    body.push(0x41, ...this.encodeSignedLEB128(0)); // i32.const 0
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
      case "While":
        return [
          0x02,
          0x40, // block
          0x03,
          0x40, // loop
          ...this.emitExpressionBinary(node.condition),
          0x45, // i32.eqz
          0x0d,
          0x01, // br_if 1
          ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
          0x0c,
          0x00, // br 0
          0x0b, // end
          0x0b, // end
        ];
      case "If":
        const thenBytes = node.thenBranch
          .map((s) => this.emitStatementBinary(s))
          .flat();
        const elseBytes = node.elseBranch
          ? [
              0x05,
              ...node.elseBranch.map((s) => this.emitStatementBinary(s)).flat(),
            ]
          : [];
        return [
          ...this.emitExpressionBinary(node.condition),
          0x04,
          0x40, // if (void)
          ...thenBytes,
          ...elseBytes,
          0x0b, // end
        ];
      case "CallExpression":
        const calleeIdx = node.callee === "print" ? 0 : 1;
        return [
          ...node.args.map((a) => this.emitExpressionBinary(a)).flat(),
          0x10,
          ...this.encodeUnsignedLEB128(calleeIdx),
        ];
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
        let opByte = 0;
        switch (node.operator) {
          case "+":
            opByte = 0x6a;
            break;
          case "-":
            opByte = 0x6b;
            break;
          case "*":
            opByte = 0x6c;
            break;
          case "/":
            opByte = 0x6d;
            break;
          case "==":
            opByte = 0x46;
            break;
          case "!=":
            opByte = 0x47;
            break;
          case "<":
            opByte = 0x48;
            break;
          case ">":
            opByte = 0x4a;
            break;
          case "and":
            return [
              ...this.emitExpressionBinary(node.left),
              0x41,
              ...this.encodeSignedLEB128(0),
              0x47, // i32.ne
              ...this.emitExpressionBinary(node.right),
              0x41,
              ...this.encodeSignedLEB128(0),
              0x47, // i32.ne
              0x71, // i32.and
            ];
          case "or":
            return [
              ...this.emitExpressionBinary(node.left),
              0x41,
              ...this.encodeSignedLEB128(0),
              0x47, // i32.ne
              ...this.emitExpressionBinary(node.right),
              0x41,
              ...this.encodeSignedLEB128(0),
              0x47, // i32.ne
              0x72, // i32.or
            ];
        }
        return [
          ...this.emitExpressionBinary(node.left),
          ...this.emitExpressionBinary(node.right),
          opByte,
        ];
      case "UnaryExpression":
        if (node.operator === "-") {
          return [
            0x41,
            ...this.encodeSignedLEB128(0),
            ...this.emitExpressionBinary(node.argument),
            0x6b, // i32.sub
          ];
        }
        if (node.operator === "not") {
          return [
            ...this.emitExpressionBinary(node.argument),
            0x45, // i32.eqz
          ];
        }
        return this.emitExpressionBinary(node.argument);
      case "CallExpression":
        const calleeIdx = node.callee === "print" ? 0 : 1;
        return [
          ...node.args.map((a) => this.emitExpressionBinary(a)).flat(),
          0x10,
          ...this.encodeUnsignedLEB128(calleeIdx),
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
      const byte = n & 0x7f;
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
