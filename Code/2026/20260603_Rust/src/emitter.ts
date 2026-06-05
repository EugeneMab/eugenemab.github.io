import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  BlockStatement,
} from "./parser.js";

const SECTION_TYPE = 0x01;
const SECTION_IMPORT = 0x02;
const SECTION_FUNCTION = 0x03;
const SECTION_MEMORY = 0x05;
const SECTION_EXPORT = 0x07;
const SECTION_CODE = 0x0a;

const TYPE_I32 = 0x7f;
const TYPE_FUNC = 0x60;

const OP_END = 0x0b;
const OP_CALL = 0x10;
const OP_DROP = 0x1a;
const OP_LOCAL_GET = 0x20;
const OP_LOCAL_SET = 0x21;
const OP_I32_CONST = 0x41;
const OP_I32_ADD = 0x6a;
const OP_I32_SUB = 0x6b;
const OP_I32_MUL = 0x6c;
const OP_I32_DIV_S = 0x6d;
const OP_I32_REM_S = 0x6e;
const OP_I32_AND = 0x71;
const OP_I32_OR = 0x72;
const OP_I32_XOR = 0x73;
const OP_I32_SHL = 0x74;
const OP_I32_SHR_S = 0x75;
const OP_UNREACHABLE = 0x00;

export class Emitter {
  private program: Program;
  private indent = 0;
  private outputWAT: string[] = [];
  private functionIndices: Map<string, number> = new Map();
  private locals: Map<string, number> = new Map();

  constructor(program: Program) {
    this.program = program;
  }

  emitWAT(): string {
    this.outputWAT = [];
    this.emitWATLine("(module");
    this.indent++;
    this.emitWATLine('(import "env" "print" (func $print (param i32)))');
    this.emitWATLine('(import "env" "panic" (func $panic (param i32)))');
    this.emitWATLine('(memory (export "memory") 1)');

    for (const stmt of this.program.body) {
      if (stmt.type === "FunctionDeclaration") {
        this.emitFunctionWAT(stmt);
      }
    }

    this.indent--;
    this.emitWATLine(")");
    return this.outputWAT.join("\n");
  }

  private emitFunctionWAT(fn: FunctionDeclaration) {
    const params = fn.params.map((p) => `(param $${p} i32)`).join(" ");
    this.emitWATLine(`(func (export "${fn.name}") ${params}`);
    this.indent++;

    const localNames = new Set<string>();
    const scan = (s: Statement) => {
      if (s.type === "LetStatement") localNames.add(s.name);
      if (s.type === "BlockStatement") s.body.forEach(scan);
    };
    fn.body.body.forEach(scan);

    for (const name of localNames) {
      this.emitWATLine(`(local $${name} i32)`);
    }

    this.emitBlockWAT(fn.body);
    this.indent--;
    this.emitWATLine(")");
  }

  private emitBlockWAT(block: BlockStatement) {
    for (const stmt of block.body) {
      if (stmt.type === "LetStatement") {
        this.emitExpressionWAT(stmt.initializer);
        this.emitWATLine(`local.set $${stmt.name}`);
      } else if (stmt.type === "ExpressionStatement") {
        this.emitExpressionWAT(stmt.expression);
        this.emitWATLine("drop");
      }
    }
  }

  private emitExpressionWAT(expr: Expression) {
    switch (expr.type) {
      case "Literal":
        this.emitWATLine(`i32.const ${expr.value}`);
        break;
      case "Identifier":
        this.emitWATLine(`local.get $${expr.name}`);
        break;
      case "BinaryExpression":
        this.emitExpressionWAT(expr.left);
        this.emitExpressionWAT(expr.right);
        switch (expr.operator) {
          case "+":
            this.emitWATLine("i32.add");
            break;
          case "-":
            this.emitWATLine("i32.sub");
            break;
          case "*":
            this.emitWATLine("i32.mul");
            break;
          case "/":
            this.emitWATLine("i32.div_s");
            break;
          case "%":
            this.emitWATLine("i32.rem_s");
            break;
          case "&":
            this.emitWATLine("i32.and");
            break;
          case "|":
            this.emitWATLine("i32.or");
            break;
          case "^":
            this.emitWATLine("i32.xor");
            break;
          case "<<":
            this.emitWATLine("i32.shl");
            break;
          case ">>":
            this.emitWATLine("i32.shr_s");
            break;
        }
        break;
      case "MacroInvocation":
        if (expr.name === "print") {
          this.emitExpressionWAT(expr.args[0]);
          this.emitWATLine("call $print");
          this.emitWATLine("i32.const 0"); // dummy return
        } else if (expr.name === "panic") {
          this.emitExpressionWAT(
            expr.args[0] ?? { type: "Literal", value: 0, rawType: "integer" },
          );
          this.emitWATLine("call $panic");
          this.emitWATLine("unreachable");
          this.emitWATLine("i32.const 0"); // dummy return for stack consistency
        }
        break;
    }
  }

  private emitWATLine(line: string) {
    this.outputWAT.push("  ".repeat(this.indent) + line);
  }

  emitWASM(): Uint8Array {
    this.functionIndices.clear();
    this.functionIndices.set("print", 0);
    this.functionIndices.set("panic", 1);

    const userFunctions = this.program.body.filter(
      (s) => s.type === "FunctionDeclaration",
    ) as FunctionDeclaration[];
    userFunctions.forEach((fn, i) => this.functionIndices.set(fn.name, 2 + i));

    const typeSection = this.encodeSection(
      SECTION_TYPE,
      this.encodeVector([
        [TYPE_FUNC, 1, TYPE_I32, 1, TYPE_I32], // index 0: (i32) -> i32 (for print/panic)
        ...userFunctions.map((fn) => [
          TYPE_FUNC,
          fn.params.length,
          ...new Array(fn.params.length).fill(TYPE_I32),
          1,
          TYPE_I32,
        ]),
      ]),
    );

    const importSection = this.encodeSection(
      SECTION_IMPORT,
      this.encodeVector([
        [
          ...this.encodeString("env"),
          ...this.encodeString("print"),
          0x00,
          0x00,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("panic"),
          0x00,
          0x00,
        ],
      ]),
    );

    const funcSection = this.encodeSection(
      SECTION_FUNCTION,
      this.encodeVector(userFunctions.map((_, i) => [i + 1])),
    );

    const memSection = this.encodeSection(
      SECTION_MEMORY,
      this.encodeVector([[0x00, 0x01]]),
    );

    const exportSection = this.encodeSection(
      SECTION_EXPORT,
      this.encodeVector([
        [...this.encodeString("memory"), 0x02, 0x00],
        ...userFunctions.map((fn) => [
          ...this.encodeString(fn.name),
          0x00,
          this.functionIndices.get(fn.name)!,
        ]),
      ]),
    );

    const codeSection = this.encodeSection(
      SECTION_CODE,
      this.encodeVector(userFunctions.map((fn) => this.emitFunctionBinary(fn))),
    );

    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];

    return new Uint8Array([
      ...magic,
      ...version,
      ...typeSection,
      ...importSection,
      ...funcSection,
      ...memSection,
      ...exportSection,
      ...codeSection,
    ]);
  }

  private emitFunctionBinary(fn: FunctionDeclaration): number[] {
    this.locals.clear();
    fn.params.forEach((p, i) => this.locals.set(p, i));

    const localNames = new Set<string>();
    const scan = (s: Statement) => {
      if (s.type === "LetStatement" && !this.locals.has(s.name))
        localNames.add(s.name);
      if (s.type === "BlockStatement") {
        s.body.forEach(scan);
        if (s.tailExpression) this.scanExpression();
      }
    };
    fn.body.body.forEach(scan);
    if (fn.body.tailExpression) this.scanExpression();

    const localList = Array.from(localNames);
    localList.forEach((name, i) => this.locals.set(name, fn.params.length + i));

    const localDecls =
      localList.length > 0 ? [[localList.length, TYPE_I32]] : [];
    const body: number[] = [];
    this.emitBlockBinary(fn.body, body);

    // Default return 0 if no tail expression
    if (!fn.body.tailExpression) {
      body.push(OP_I32_CONST, 0);
    }
    body.push(OP_END);

    const localBytes = this.encodeVector(
      localDecls.map((d) => [...this.encodeUnsignedLEB128(d[0]), d[1]]),
    );
    return [
      ...this.encodeUnsignedLEB128(localBytes.length + body.length),
      ...localBytes,
      ...body,
    ];
  }

  private scanExpression() {
    // Current expressions don't declare new locals, but future ones might
  }

  private emitBlockBinary(block: any, body: number[]) {
    for (const stmt of block.body) {
      if (stmt.type === "LetStatement") {
        this.emitExpressionBinary(stmt.initializer, body);
        body.push(
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(this.locals.get(stmt.name)!),
        );
      } else if (stmt.type === "ExpressionStatement") {
        this.emitExpressionBinary(stmt.expression, body);
        body.push(OP_DROP);
      }
    }
    if (block.tailExpression) {
      this.emitExpressionBinary(block.tailExpression, body);
    }
  }

  private emitExpressionBinary(expr: Expression, body: number[]) {
    switch (expr.type) {
      case "Literal":
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(Number(expr.value)));
        break;
      case "Identifier":
        body.push(
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(this.locals.get(expr.name)!),
        );
        break;
      case "BinaryExpression":
        this.emitExpressionBinary(expr.left, body);
        this.emitExpressionBinary(expr.right, body);
        switch (expr.operator) {
          case "+":
            body.push(OP_I32_ADD);
            break;
          case "-":
            body.push(OP_I32_SUB);
            break;
          case "*":
            body.push(OP_I32_MUL);
            break;
          case "/":
            body.push(OP_I32_DIV_S);
            break;
          case "%":
            body.push(OP_I32_REM_S);
            break;
          case "&":
            body.push(OP_I32_AND);
            break;
          case "|":
            body.push(OP_I32_OR);
            break;
          case "^":
            body.push(OP_I32_XOR);
            break;
          case "<<":
            body.push(OP_I32_SHL);
            break;
          case ">>":
            body.push(OP_I32_SHR_S);
            break;
        }
        break;
      case "MacroInvocation":
        if (expr.name === "print") {
          this.emitExpressionBinary(expr.args[0], body);
          body.push(OP_CALL, ...this.encodeUnsignedLEB128(0));
        } else if (expr.name === "panic") {
          this.emitExpressionBinary(
            expr.args[0] ?? { type: "Literal", value: 0, rawType: "integer" },
            body,
          );
          body.push(OP_CALL, ...this.encodeUnsignedLEB128(1));
          body.push(OP_UNREACHABLE);
        }
        break;
    }
  }

  private encodeSection(id: number, content: number[]): number[] {
    return [id, ...this.encodeUnsignedLEB128(content.length), ...content];
  }

  private encodeVector(items: number[][]): number[] {
    return [...this.encodeUnsignedLEB128(items.length), ...items.flat()];
  }

  private encodeString(s: string): number[] {
    const bytes = new TextEncoder().encode(s);
    return [...this.encodeUnsignedLEB128(bytes.length), ...Array.from(bytes)];
  }

  private encodeUnsignedLEB128(n: number): number[] {
    const result = [];
    do {
      let byte = n & 0x7f;
      n >>>= 7;
      if (n !== 0) byte |= 0x80;
      result.push(byte);
    } while (n !== 0);
    return result;
  }

  private encodeSignedLEB128(n: number): number[] {
    const result = [];
    while (true) {
      const byte = n & 0x7f;
      n >>= 7;
      if (
        (n === 0 && (byte & 0x40) === 0) ||
        (n === -1 && (byte & 0x40) !== 0)
      ) {
        result.push(byte);
        break;
      }
      result.push(byte | 0x80);
    }
    return result;
  }
}
