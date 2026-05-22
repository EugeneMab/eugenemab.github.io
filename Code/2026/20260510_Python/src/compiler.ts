// src/compiler.ts
import { ProgramNode, ASTNode, FunctionDefNode, SliceNode } from "./parser.js";

const SECTION_TYPE = 0x01;
const SECTION_IMPORT = 0x02;
const SECTION_FUNCTION = 0x03;
const SECTION_MEMORY = 0x05;
const SECTION_GLOBAL = 0x06;
const SECTION_EXPORT = 0x07;
const SECTION_CODE = 0x0a;

const TYPE_I32 = 0x7f;
const TYPE_FUNC = 0x60;
const TYPE_EMPTY = 0x40;

const EXT_KIND_FUNC = 0x00;
const EXT_KIND_MEMORY = 0x02;
const EXT_KIND_GLOBAL = 0x03;

const MUTABILITY_VAR = 0x01;

const OP_NOP = 0x01;
const OP_BLOCK = 0x02;
const OP_LOOP = 0x03;
const OP_IF = 0x04;
const OP_ELSE = 0x05;
const OP_END = 0x0b;
const OP_BR = 0x0c;
const OP_BR_IF = 0x0d;
const OP_RETURN = 0x0f;
const OP_CALL = 0x10;
const OP_DROP = 0x1a;
const OP_LOCAL_GET = 0x20;
const OP_LOCAL_SET = 0x21;
const OP_GLOBAL_GET = 0x23;
const OP_GLOBAL_SET = 0x24;
const OP_I32_LOAD = 0x28;
const OP_I32_STORE = 0x36;
const OP_I32_CONST = 0x41;
const OP_I32_EQZ = 0x45;
const OP_I32_EQ = 0x46;
const OP_I32_NE = 0x47;
const OP_I32_LT_S = 0x48;
const OP_I32_GT_S = 0x4a;
const OP_I32_GE_S = 0x4e;
const OP_I32_ADD = 0x6a;
const OP_I32_SUB = 0x6b;
const OP_I32_MUL = 0x6c;
const OP_I32_DIV_S = 0x6d;
const OP_I32_AND = 0x71;
const OP_I32_OR = 0x72;

export class Compiler {
  private locals: Map<string, number> = new Map();
  private localIndex: number = 0;
  private functionMap: Map<string, number> = new Map();
  private tempLocals: string[] = [];
  private watLocalCount: number = 0;

  private allocateTempLocal(): string {
    let candidateIndex = this.tempLocals.length;
    let name = `__tmp${candidateIndex}`;
    while (this.locals.has(name) || this.tempLocals.includes(name)) {
      candidateIndex++;
      name = `__tmp${candidateIndex}`;
    }
    this.tempLocals.push(name);
    return name;
  }

  private getTempLocalIndex(name: string): number {
    const idx = this.tempLocals.indexOf(name);
    if (idx === -1) throw new Error(`Unknown temp local: ${name}`);
    return this.localIndex + idx;
  }

  compileWAT(program: ProgramNode): string {
    this.functionMap.clear();
    this.functionMap.set("print", 0);
    this.functionMap.set("sleep", 1);
    this.functionMap.set("print_str", 2);
    this.functionMap.set("itoa", 3);
    this.functionMap.set("concat", 4);
    this.functionMap.set("_get_item", 5);
    this.functionMap.set("_slice", 6);

    const userFunctions = program.body.filter(
      (n) => n.type === "FunctionDef",
    ) as FunctionDefNode[];
    userFunctions.forEach((f, i) => this.functionMap.set(f.name, 7 + i));

    let wat = `(module\n`;
    wat += `  (import "env" "print" (func $print (param i32) (result i32)))\n`;
    wat += `  (import "env" "sleep" (func $sleep (param i32) (result i32)))\n`;
    wat += `  (import "env" "print_str" (func $print_str (param i32) (result i32)))\n`;
    wat += `  (import "env" "itoa" (func $itoa (param i32) (result i32)))\n`;
    wat += `  (import "env" "concat" (func $concat (param i32 i32) (result i32)))\n`;
    wat += `  (import "env" "_get_item" (func $_get_item (param i32 i32) (result i32)))\n`;
    wat += `  (import "env" "_slice" (func $_slice (param i32 i32 i32 i32) (result i32)))\n`;
    wat += `  (memory (export "memory") 1)\n`;
    wat += `  (global $heap_ptr (export "heap_ptr") (mut i32) (i32.const 1024))\n`;

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
    this.watLocalCount = 0;
    this.tempLocals = [];

    const paramsWAT = node.params
      .map((p) => {
        this.locals.set(p, this.localIndex++);
        return `(param $${p} i32)`;
      })
      .join(" ");

    const localDecls: string[] = [];
    const scanNode = (n: ASTNode) => {
      if (!n) return;
      if (n.type === "Assignment" && !this.locals.has(n.target)) {
        this.locals.set(n.target, this.localIndex++);
        localDecls.push(`(local $${n.target} i32)`);
      }
      if (n.type === "For" && !this.locals.has(n.iterator)) {
        this.locals.set(n.iterator, this.localIndex++);
        localDecls.push(`(local $${n.iterator} i32)`);
      }
      if (n.type === "ListComprehension" || n.type === "DictComprehension") {
        if (!this.locals.has(n.item)) {
          this.locals.set(n.item, this.localIndex++);
          localDecls.push(`(local $${n.item} i32)`);
        }
      }
      // Recursively scan
      switch (n.type) {
        case "Assignment":
          scanNode(n.value);
          break;
        case "BinaryExpression":
          scanNode(n.left);
          scanNode(n.right);
          break;
        case "If":
          scanNode(n.condition);
          n.thenBranch.forEach(scanNode);
          if (n.elseBranch) n.elseBranch.forEach(scanNode);
          break;
        case "While":
          scanNode(n.condition);
          n.body.forEach(scanNode);
          break;
        case "For":
          if (n.iterable) scanNode(n.iterable);
          if (n.start) scanNode(n.start);
          if (n.stop) scanNode(n.stop);
          n.body.forEach(scanNode);
          break;
        case "DoWhile":
          scanNode(n.condition);
          n.body.forEach(scanNode);
          break;
        case "Return":
          scanNode(n.value);
          break;
        case "List":
          n.elements.forEach(scanNode);
          break;
        case "ListComprehension":
          scanNode(n.iterable);
          scanNode(n.expression);
          if (n.condition) scanNode(n.condition);
          break;
        case "DictComprehension":
          scanNode(n.iterable);
          scanNode(n.key);
          scanNode(n.value);
          if (n.condition) scanNode(n.condition);
          break;
        case "Subscript":
          scanNode(n.value);
          scanNode(n.index);
          break;
        case "Slice":
          if (n.start) scanNode(n.start);
          if (n.stop) scanNode(n.stop);
          if (n.step) scanNode(n.step);
          break;
      }
    };
    node.body.forEach(scanNode);

    const bodyLines: string[] = [];
    for (const stmt of node.body) {
      const stmtWat = this.emitStatementWAT(stmt);
      if (stmtWat) bodyLines.push(...stmtWat.split("\n"));
    }

    // Add generic locals for WAT emission based on usage
    this.tempLocals.forEach((name) => {
      localDecls.push(`(local $${name} i32)`);
    });

    const allLines = [...localDecls, ...bodyLines].filter(
      (line) => line.trim().length > 0,
    );

    const paramsPart = paramsWAT ? " " + paramsWAT : "";

    return (
      `  (func $${node.name}${paramsPart} (result i32)\n` +
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
        return `block\n  loop\n${this.indent(this.indent(loopContent))}\n  end\nend`;
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
        return `${this.emitExpressionWAT(node.condition)}\nif\n${thenBranch}\n${elseBranch}end`;
      }
      case "For": {
        if (node.start && node.stop) {
          const init = `${this.emitExpressionWAT(node.start)}\nlocal.set $${node.iterator}`;
          const condition = `local.get $${node.iterator}\n${this.emitExpressionWAT(node.stop)}\ni32.ge_s\nbr_if 1`;
          const body = node.body
            .map((s) => this.emitStatementWAT(s))
            .filter((s) => s)
            .join("\n");
          const step = `local.get $${node.iterator}\ni32.const 1\ni32.add\nlocal.set $${node.iterator}`;
          return `${init}\nblock\n  loop\n${this.indent(this.indent(condition + "\n" + body + "\n" + step + "\nbr 0"))}\n  end\nend`;
        } else if (node.iterable) {
          const iterPtr = this.allocateTempLocal();
          const iterLen = this.allocateTempLocal();
          const iterIdx = this.allocateTempLocal();
          const init = `${this.emitExpressionWAT(node.iterable)}\nlocal.set $${iterPtr}\nlocal.get $${iterPtr}\ni32.load\nlocal.set $${iterLen}\ni32.const 0\nlocal.set $${iterIdx}`;
          const condition = `local.get $${iterIdx}\nlocal.get $${iterLen}\ni32.ge_s\nbr_if 1`;
          const updateIter = `local.get $${iterPtr}\ni32.const 4\ni32.add\nlocal.get $${iterIdx}\ni32.const 4\ni32.mul\ni32.add\ni32.load\nlocal.set $${node.iterator}`;
          const body = node.body
            .map((s) => this.emitStatementWAT(s))
            .filter((s) => s)
            .join("\n");
          const step = `local.get $${iterIdx}\ni32.const 1\ni32.add\nlocal.set $${iterIdx}`;
          return `${init}\nblock\n  loop\n${this.indent(this.indent(condition + "\n" + updateIter + "\n" + body + "\n" + step + "\nbr 0"))}\n  end\nend`;
        }
        return "";
      }
      case "DoWhile": {
        const body =
          node.body
            .map((s) => this.emitStatementWAT(s))
            .filter((s) => s)
            .join("\n") + "\n";
        const condition = `${this.emitExpressionWAT(node.condition)}\nbr_if 0`;
        return `loop\n${this.indent(body + condition)}\nend`;
      }
      case "Pass":
        return "nop";
      default:
        const expr = this.emitExpressionWAT(node);
        return expr ? expr + "\ndrop" : "";
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
        if (typeof node.value === "string") {
          const str = node.value;
          const tmp0 = this.allocateTempLocal();
          let wat = `global.get $heap_ptr\nlocal.set $${tmp0}\n`;
          wat += `global.get $heap_ptr\ni32.const ${(str.length + 1) * 4}\ni32.add\nglobal.set $heap_ptr\n`;
          wat += `local.get $${tmp0}\ni32.const ${str.length}\ni32.store\n`;
          for (let i = 0; i < str.length; i++) {
            wat += `local.get $${tmp0}\ni32.const ${(i + 1) * 4}\ni32.add\ni32.const ${str.charCodeAt(i)}\ni32.store\n`;
          }
          wat += `local.get $${tmp0}`;
          return wat;
        }
        return `i32.const ${node.value === true ? 1 : node.value === false ? 0 : node.value}`;
      case "Identifier":
        return `local.get $${node.name}`;
      case "BinaryExpression": {
        const leftWAT = this.emitExpressionWAT(node.left);
        const rightWAT = this.emitExpressionWAT(node.right);
        if (node.operator === "+") {
          const isString = (n: ASTNode) =>
            (n.type === "Literal" && typeof n.value === "string") ||
            n.type === "FString";
          if (isString(node.left) || isString(node.right)) {
            return `${leftWAT}\n${rightWAT}\ncall $concat`;
          }
          return `${leftWAT}\n${rightWAT}\ni32.add`;
        }
        let op = "";
        switch (node.operator) {
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
              leftWAT +
              `\ni32.const 0\ni32.ne\n` +
              rightWAT +
              `\ni32.const 0\ni32.ne\ni32.and`
            );
          case "or":
            return (
              leftWAT +
              `\ni32.const 0\ni32.ne\n` +
              rightWAT +
              `\ni32.const 0\ni32.ne\ni32.or`
            );
        }
        return leftWAT + "\n" + rightWAT + "\n" + op;
      }
      case "UnaryExpression":
        if (node.operator === "-")
          return (
            `i32.const 0\n` +
            this.emitExpressionWAT(node.argument) +
            `\ni32.sub`
          );
        if (node.operator === "not")
          return this.emitExpressionWAT(node.argument) + `\ni32.eqz`;
        return this.emitExpressionWAT(node.argument);
      case "CallExpression": {
        const argWAT = node.args
          .map((a) => this.emitExpressionWAT(a))
          .join("\n");
        if (node.callee === "print" && node.args.length === 1) {
          const arg = node.args[0];
          // Heuristic: If it's a string literal or f-string, use print_str
          if (
            (arg.type === "Literal" && typeof arg.value === "string") ||
            arg.type === "FString"
          ) {
            return argWAT + "\ncall $print_str";
          }
        }
        return argWAT + `\ncall $${node.callee}`;
      }
      case "FString": {
        let wat = "";
        node.parts.forEach((part, i) => {
          if (typeof part === "string") {
            wat +=
              this.emitExpressionWAT({
                type: "Literal",
                value: part,
              } as any) + "\n";
          } else {
            wat += this.emitExpressionWAT(part) + "\ncall $itoa\n";
          }
          if (i > 0) {
            wat += "call $concat\n";
          }
        });
        return wat;
      }
      case "List": {
        const tmp0 = this.allocateTempLocal();
        let wat = `global.get $heap_ptr\nlocal.set $${tmp0}\n`;
        const len = node.elements.length;
        wat += `global.get $heap_ptr\ni32.const ${(len + 1) * 4}\ni32.add\nglobal.set $heap_ptr\n`;
        wat += `local.get $${tmp0}\ni32.const ${len}\ni32.store\n`;
        node.elements.forEach((el, i) => {
          wat +=
            `local.get $${tmp0}\ni32.const ${(i + 1) * 4}\ni32.add\n` +
            this.emitExpressionWAT(el) +
            `\ni32.store\n`;
        });
        wat += `local.get $${tmp0}`;
        return wat;
      }
      case "Subscript": {
        if (node.index.type === "Slice") {
          const slice = node.index as SliceNode;
          const start = slice.start
            ? this.emitExpressionWAT(slice.start)
            : "i32.const 2147483647";
          const stop = slice.stop
            ? this.emitExpressionWAT(slice.stop)
            : "i32.const 2147483647";
          const step = slice.step
            ? this.emitExpressionWAT(slice.step)
            : "i32.const 2147483647";
          return (
            this.emitExpressionWAT(node.value) +
            "\n" +
            start +
            "\n" +
            stop +
            "\n" +
            step +
            "\ncall $_slice"
          );
        }
        return (
          this.emitExpressionWAT(node.value) +
          "\n" +
          this.emitExpressionWAT(node.index) +
          "\ncall $_get_item"
        );
      }
      case "ListComprehension": {
        const iterPtr = this.allocateTempLocal();
        const iterLen = this.allocateTempLocal();
        const resPtr = this.allocateTempLocal();
        const count = this.allocateTempLocal();
        const iIdx = this.allocateTempLocal();
        const resItemPtr = this.allocateTempLocal();

        let wat =
          this.emitExpressionWAT(node.iterable) + `\nlocal.set $${iterPtr}\n`;
        wat += `local.get $${iterPtr}\ni32.load\nlocal.set $${iterLen}\n`;
        wat += `global.get $heap_ptr\nlocal.set $${resPtr}\n`;
        wat += `local.get $${resPtr}\ni32.const 0\ni32.store\n`;
        wat += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
        wat += `i32.const 0\nlocal.set $${count}\n`;
        wat += `i32.const 0\nlocal.set $${iIdx}\n`;

        let loopBody = `local.get $${iIdx}\nlocal.get $${iterLen}\ni32.ge_s\nbr_if 1\n`;
        loopBody += `local.get $${iterPtr}\nlocal.get $${iIdx}\ni32.const 4\ni32.mul\ni32.add\ni32.const 4\ni32.add\ni32.load\nlocal.set $${node.item}\n`;

        let action =
          `global.get $heap_ptr\nlocal.set $${resItemPtr}\n` +
          `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n` +
          `local.get $${resItemPtr}\n` +
          this.emitExpressionWAT(node.expression) +
          `\ni32.store\n`;
        action += `local.get $${count}\ni32.const 1\ni32.add\nlocal.set $${count}`;

        if (node.condition) {
          loopBody +=
            this.emitExpressionWAT(node.condition) +
            `\nif\n` +
            this.indent(action) +
            `\nend\n`;
        } else {
          loopBody += action + `\n`;
        }
        loopBody += `local.get $${iIdx}\ni32.const 1\ni32.add\nlocal.set $${iIdx}\nbr 0`;

        wat += `block\n  loop\n${this.indent(this.indent(loopBody))}\n  end\nend\n`;
        wat += `local.get $${resPtr}\nlocal.get $${count}\ni32.store\n`;
        wat += `local.get $${resPtr}`;
        return wat;
      }
      case "DictComprehension": {
        const iterPtr = this.allocateTempLocal();
        const iterLen = this.allocateTempLocal();
        const resPtr = this.allocateTempLocal();
        const count = this.allocateTempLocal();
        const iIdx = this.allocateTempLocal();
        const resItemPtr = this.allocateTempLocal();

        let wat =
          this.emitExpressionWAT(node.iterable) + `\nlocal.set $${iterPtr}\n`;
        wat += `local.get $${iterPtr}\ni32.load\nlocal.set $${iterLen}\n`;
        wat += `global.get $heap_ptr\nlocal.set $${resPtr}\n`;
        wat += `local.get $${resPtr}\ni32.const 0\ni32.store\n`;
        wat += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
        wat += `i32.const 0\nlocal.set $${count}\n`;
        wat += `i32.const 0\nlocal.set $${iIdx}\n`;

        let loopBody = `local.get $${iIdx}\nlocal.get $${iterLen}\ni32.ge_s\nbr_if 1\n`;
        loopBody += `local.get $${iterPtr}\nlocal.get $${iIdx}\ni32.const 4\ni32.mul\ni32.add\ni32.const 4\ni32.add\ni32.load\nlocal.set $${node.item}\n`;

        let action =
          `global.get $heap_ptr\nlocal.set $${resItemPtr}\n` +
          `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n` +
          `local.get $${resItemPtr}\n` +
          this.emitExpressionWAT(node.key) +
          `\ni32.store\n`;
        action +=
          `global.get $heap_ptr\nlocal.set $${resItemPtr}\n` +
          `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n` +
          `local.get $${resItemPtr}\n` +
          this.emitExpressionWAT(node.value) +
          `\ni32.store\n`;
        action += `local.get $${count}\ni32.const 1\ni32.add\nlocal.set $${count}`;

        if (node.condition) {
          loopBody +=
            this.emitExpressionWAT(node.condition) +
            `\nif\n` +
            this.indent(action) +
            `\nend\n`;
        } else {
          loopBody += action + `\n`;
        }
        loopBody += `local.get $${iIdx}\ni32.const 1\ni32.add\nlocal.set $${iIdx}\nbr 0`;

        wat += `block\n  loop\n${this.indent(this.indent(loopBody))}\n  end\nend\n`;
        wat += `local.get $${resPtr}\nlocal.get $${count}\ni32.store\n`;
        wat += `local.get $${resPtr}`;
        return wat;
      }
      default:
        return "";
    }
  }

  // --- WASM Binary Emitter (remains mostly as is, but keeping consistency) ---

  compileWASM(program: ProgramNode): Uint8Array {
    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];
    this.functionMap.clear();
    this.functionMap.set("print", 0);
    this.functionMap.set("sleep", 1);
    this.functionMap.set("print_str", 2);
    this.functionMap.set("itoa", 3);
    this.functionMap.set("concat", 4);
    this.functionMap.set("_get_item", 5);
    this.functionMap.set("_slice", 6);
    const userFunctions = program.body.filter(
      (n) => n.type === "FunctionDef",
    ) as FunctionDefNode[];
    userFunctions.forEach((f, i) => this.functionMap.set(f.name, 7 + i));

    const types: number[][] = [];
    types.push([TYPE_FUNC, 1, TYPE_I32, 1, TYPE_I32]); // index 0: (i32) -> i32
    types.push([TYPE_FUNC, 2, TYPE_I32, TYPE_I32, 1, TYPE_I32]); // index 1: (i32, i32) -> i32
    types.push([TYPE_FUNC, 3, TYPE_I32, TYPE_I32, TYPE_I32, 1, TYPE_I32]); // index 2: (i32, i32, i32) -> i32
    types.push([
      TYPE_FUNC,
      4,
      TYPE_I32,
      TYPE_I32,
      TYPE_I32,
      TYPE_I32,
      1,
      TYPE_I32,
    ]); // index 3
    const userFuncTypeIndices: number[] = [];
    for (const f of userFunctions) {
      const type = [
        TYPE_FUNC,
        ...this.encodeUnsignedLEB128(f.params.length),
        ...new Array(f.params.length).fill(TYPE_I32),
        1,
        TYPE_I32,
      ];
      let idx = types.findIndex(
        (t) => JSON.stringify(t) === JSON.stringify(type),
      );
      if (idx === -1) {
        idx = types.length;
        types.push(type);
      }
      userFuncTypeIndices.push(idx);
    }
    const typeSection = this.createSection(SECTION_TYPE, [
      this.encodeVector(types),
    ]);
    const importSection = this.createSection(SECTION_IMPORT, [
      this.encodeVector([
        [
          ...this.encodeString("env"),
          ...this.encodeString("print"),
          EXT_KIND_FUNC,
          0,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("sleep"),
          EXT_KIND_FUNC,
          0,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("print_str"),
          EXT_KIND_FUNC,
          0,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("itoa"),
          EXT_KIND_FUNC,
          0,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("concat"),
          EXT_KIND_FUNC,
          1,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("_get_item"),
          EXT_KIND_FUNC,
          1,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("_slice"),
          EXT_KIND_FUNC,
          3,
        ],
      ]),
    ]);
    const funcSection = this.createSection(SECTION_FUNCTION, [
      this.encodeVector(userFuncTypeIndices.map((i) => [i])),
    ]);
    const memorySection = this.createSection(SECTION_MEMORY, [
      this.encodeVector([[0, 1]]),
    ]);
    const globalSection = this.createSection(SECTION_GLOBAL, [
      this.encodeVector([
        [
          TYPE_I32,
          MUTABILITY_VAR,
          OP_I32_CONST,
          ...this.encodeSignedLEB128(1024),
          OP_END,
        ],
      ]),
    ]);
    const exports: number[][] = [];
    userFunctions.forEach((f, i) =>
      exports.push([
        ...this.encodeString(f.name),
        EXT_KIND_FUNC,
        ...this.encodeUnsignedLEB128(7 + i),
      ]),
    );
    exports.push([...this.encodeString("memory"), EXT_KIND_MEMORY, 0]);
    exports.push([...this.encodeString("heap_ptr"), EXT_KIND_GLOBAL, 0]);
    const exportSection = this.createSection(SECTION_EXPORT, [
      this.encodeVector(exports),
    ]);
    const codes = [...userFunctions.map((f) => this.emitFunctionBinary(f))];
    const codeSection = this.createSection(SECTION_CODE, [
      this.encodeVector(codes),
    ]);

    return new Uint8Array([
      ...magic,
      ...version,
      ...typeSection,
      ...importSection,
      ...funcSection,
      ...memorySection,
      ...globalSection,
      ...exportSection,
      ...codeSection,
    ]);
  }

  private createSection(id: number, content: number[][]): number[] {
    const bytes = content.flat();
    return [id, ...this.encodeUnsignedLEB128(bytes.length), ...bytes];
  }

  private encodeVector(items: number[][]): number[] {
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
    this.tempLocals = [];
    for (const p of node.params) this.locals.set(p, this.localIndex++);
    const localTypes: number[] = [];
    const scanNode = (n: ASTNode) => {
      if (!n) return;
      if (n.type === "Assignment" && !this.locals.has(n.target)) {
        this.locals.set(n.target, this.localIndex++);
        localTypes.push(TYPE_I32);
      }
      if (n.type === "ListComprehension" || n.type === "DictComprehension") {
        if (!this.locals.has(n.item)) {
          this.locals.set(n.item, this.localIndex++);
          localTypes.push(TYPE_I32);
        }
      }
      switch (n.type) {
        case "Assignment":
          scanNode(n.value);
          break;
        case "BinaryExpression":
          scanNode(n.left);
          scanNode(n.right);
          break;
        case "CallExpression":
          n.args.forEach(scanNode);
          break;
        case "If":
          scanNode(n.condition);
          n.thenBranch.forEach(scanNode);
          if (n.elseBranch) n.elseBranch.forEach(scanNode);
          break;
        case "While":
          scanNode(n.condition);
          n.body.forEach(scanNode);
          break;
        case "For":
          if (!this.locals.has(n.iterator)) {
            this.locals.set(n.iterator, this.localIndex++);
            localTypes.push(TYPE_I32);
          }
          if (n.iterable) scanNode(n.iterable);
          if (n.start) scanNode(n.start);
          if (n.stop) scanNode(n.stop);
          n.body.forEach(scanNode);
          break;
        case "DoWhile":
          scanNode(n.condition);
          n.body.forEach(scanNode);
          break;
        case "Return":
          scanNode(n.value);
          break;
        case "FString":
          n.parts.forEach((p) => {
            if (typeof p !== "string") scanNode(p);
          });
          break;
        case "UnaryExpression":
          scanNode(n.argument);
          break;
        case "List":
          n.elements.forEach(scanNode);
          break;
        case "ListComprehension":
          scanNode(n.iterable);
          scanNode(n.expression);
          if (n.condition) scanNode(n.condition);
          break;
        case "DictComprehension":
          scanNode(n.iterable);
          scanNode(n.key);
          scanNode(n.value);
          if (n.condition) scanNode(n.condition);
          break;
        case "Subscript":
          scanNode(n.value);
          scanNode(n.index);
          break;
        case "Slice":
          if (n.start) scanNode(n.start);
          if (n.stop) scanNode(n.stop);
          if (n.step) scanNode(n.step);
          break;
      }
    };
    node.body.forEach(scanNode);
    const body: number[] = [];
    for (const stmt of node.body) body.push(...this.emitStatementBinary(stmt));
    body.push(OP_I32_CONST, 0, OP_END);

    // After emission, we know how many tempLocals were allocated
    this.tempLocals.forEach(() => localTypes.push(TYPE_I32));

    const localDecls =
      localTypes.length > 0
        ? [
            ...this.encodeUnsignedLEB128(1),
            ...this.encodeUnsignedLEB128(localTypes.length),
            TYPE_I32,
          ]
        : [...this.encodeUnsignedLEB128(0)];

    const fullFunc = [...localDecls, ...body];
    return [...this.encodeUnsignedLEB128(fullFunc.length), ...fullFunc];
  }

  private emitStatementBinary(node: ASTNode): number[] {
    switch (node.type) {
      case "Return":
        return [...this.emitExpressionBinary(node.value), OP_RETURN];
      case "Assignment":
        return [
          ...this.emitExpressionBinary(node.value),
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(this.locals.get(node.target)!),
        ];
      case "While":
        return [
          OP_BLOCK,
          TYPE_EMPTY,
          OP_LOOP,
          TYPE_EMPTY,
          ...this.emitExpressionBinary(node.condition),
          OP_I32_EQZ,
          OP_BR_IF,
          1,
          ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
          OP_BR,
          0,
          OP_END,
          OP_END,
        ];
      case "If":
        const thenBytes = node.thenBranch
          .map((s) => this.emitStatementBinary(s))
          .flat();
        const elseBytes = node.elseBranch
          ? [
              OP_ELSE,
              ...node.elseBranch.map((s) => this.emitStatementBinary(s)).flat(),
            ]
          : [];
        return [
          ...this.emitExpressionBinary(node.condition),
          OP_IF,
          TYPE_EMPTY,
          ...thenBytes,
          ...elseBytes,
          OP_END,
        ];
      case "Pass":
        return [OP_NOP];
      case "For": {
        if (node.start && node.stop) {
          const iterIdx = this.locals.get(node.iterator)!;
          return [
            ...this.emitExpressionBinary(node.start),
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(iterIdx),
            OP_BLOCK,
            TYPE_EMPTY, // block
            OP_LOOP,
            TYPE_EMPTY, // loop
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(iterIdx),
            ...this.emitExpressionBinary(node.stop),
            OP_I32_GE_S, // i32.ge_s
            OP_BR_IF,
            1, // br_if 1
            ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(iterIdx),
            OP_I32_CONST,
            1,
            OP_I32_ADD, // i32.add
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(iterIdx),
            OP_BR,
            0, // br 0
            OP_END,
            OP_END,
          ];
        } else if (node.iterable) {
          const iterIdx = this.locals.get(node.iterator)!;
          const iterPtrLocal = this.allocateTempLocal();
          const iterPtr = this.getTempLocalIndex(iterPtrLocal);
          const iterLenLocal = this.allocateTempLocal();
          const iterLen = this.getTempLocalIndex(iterLenLocal);
          const idxLocalName = this.allocateTempLocal();
          const idxLocal = this.getTempLocalIndex(idxLocalName);
          return [
            ...this.emitExpressionBinary(node.iterable),
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(iterPtr),
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(iterPtr),
            OP_I32_LOAD, // i32.load
            2,
            0,
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(iterLen),
            OP_I32_CONST,
            0,
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(idxLocal),
            OP_BLOCK,
            TYPE_EMPTY, // block
            OP_LOOP,
            TYPE_EMPTY, // loop
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(idxLocal),
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(iterLen),
            OP_I32_GE_S, // i32.ge_s
            OP_BR_IF,
            1, // br_if 1
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(iterPtr),
            OP_I32_CONST,
            4,
            OP_I32_ADD, // add 4
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(idxLocal),
            OP_I32_CONST,
            4,
            OP_I32_MUL, // mul 4
            OP_I32_ADD, // add
            OP_I32_LOAD, // load
            2,
            0,
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(iterIdx),
            ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(idxLocal),
            OP_I32_CONST,
            1,
            OP_I32_ADD, // i32.add
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(idxLocal),
            OP_BR,
            0, // br 0
            OP_END,
            OP_END,
          ];
        }
        return [];
      }
      case "DoWhile": {
        return [
          OP_LOOP,
          TYPE_EMPTY, // loop
          ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
          ...this.emitExpressionBinary(node.condition),
          OP_BR_IF,
          0, // br_if 0
          OP_END,
        ];
      }
      default:
        const expr = this.emitExpressionBinary(node);
        return expr.length > 0 ? [...expr, OP_DROP] : [];
    }
  }

  private emitExpressionBinary(node: ASTNode): number[] {
    switch (node.type) {
      case "Literal":
        if (typeof node.value === "number")
          return [OP_I32_CONST, ...this.encodeSignedLEB128(node.value)];
        if (typeof node.value === "boolean")
          return [OP_I32_CONST, node.value ? 1 : 0];
        if (typeof node.value === "string") {
          const str = node.value;
          const size = (str.length + 1) * 4;
          const tmp0 = this.allocateTempLocal();
          const tmp0Idx = this.getTempLocalIndex(tmp0);
          const bytes: number[] = [
            OP_GLOBAL_GET, // global.get 0
            0,
            OP_LOCAL_SET, // local.set tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
            OP_GLOBAL_GET, // global.get 0
            0,
            OP_I32_CONST, // i32.const size
            ...this.encodeSignedLEB128(size),
            OP_I32_ADD, // i32.add
            OP_GLOBAL_SET, // global.set 0
            0,
            OP_LOCAL_GET, // local.get tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
            OP_I32_CONST, // i32.const str.length
            ...this.encodeSignedLEB128(str.length),
            OP_I32_STORE, // i32.store
            2,
            0,
          ];
          for (let i = 0; i < str.length; i++)
            bytes.push(
              OP_LOCAL_GET, // local.get tmp0
              ...this.encodeUnsignedLEB128(tmp0Idx),
              OP_I32_CONST, // i32.const (i+1)*4
              ...this.encodeSignedLEB128((i + 1) * 4),
              OP_I32_ADD, // i32.add
              OP_I32_CONST, // i32.const charCode
              ...this.encodeSignedLEB128(str.charCodeAt(i)),
              OP_I32_STORE, // i32.store
              2,
              0,
            );
          bytes.push(
            OP_LOCAL_GET, // local.get tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
          );
          return bytes;
        }
        return [];
      case "List": {
        const length = node.elements.length;
        const size = (length + 1) * 4;
        const tmp0 = this.allocateTempLocal();
        const tmp0Idx = this.getTempLocalIndex(tmp0);
        const listBytes: number[] = [
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_LOCAL_SET, // local.set tmp0
          ...this.encodeUnsignedLEB128(tmp0Idx),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_I32_CONST, // i32.const size
          ...this.encodeSignedLEB128(size),
          OP_I32_ADD, // i32.add
          OP_GLOBAL_SET, // global.set 0
          0,
          OP_LOCAL_GET, // local.get tmp0
          ...this.encodeUnsignedLEB128(tmp0Idx),
          OP_I32_CONST, // i32.const length
          ...this.encodeSignedLEB128(length),
          OP_I32_STORE, // i32.store
          2,
          0,
        ];
        node.elements.forEach((el, i) => {
          listBytes.push(
            OP_LOCAL_GET, // local.get tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
            OP_I32_CONST, // i32.const (i+1)*4
            ...this.encodeSignedLEB128((i + 1) * 4),
            OP_I32_ADD, // i32.add
          );
          listBytes.push(...this.emitExpressionBinary(el));
          listBytes.push(
            OP_I32_STORE, // i32.store
            2,
            0,
          );
        });
        listBytes.push(
          OP_LOCAL_GET, // local.get tmp0
          ...this.encodeUnsignedLEB128(tmp0Idx),
        );
        return listBytes;
      }
      case "Subscript":
        const base = this.emitExpressionBinary(node.value);
        if (node.index.type === "Slice") {
          const slice = node.index as SliceNode;
          const start = slice.start
            ? this.emitExpressionBinary(slice.start)
            : [OP_I32_CONST, ...this.encodeSignedLEB128(0x7fffffff)];
          const stop = slice.stop
            ? this.emitExpressionBinary(slice.stop)
            : [OP_I32_CONST, ...this.encodeSignedLEB128(0x7fffffff)];
          const step = slice.step
            ? this.emitExpressionBinary(slice.step)
            : [OP_I32_CONST, ...this.encodeSignedLEB128(0x7fffffff)];
          return [
            ...base,
            ...start,
            ...stop,
            ...step,
            OP_CALL,
            ...this.encodeUnsignedLEB128(this.functionMap.get("_slice")!),
          ];
        }
        return [
          ...base,
          ...this.emitExpressionBinary(node.index),
          OP_CALL,
          ...this.encodeUnsignedLEB128(this.functionMap.get("_get_item")!),
        ];
      case "Identifier":
        return [
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(this.locals.get(node.name)!),
        ];
      case "ListComprehension": {
        const itemLocalIdx = this.locals.get(node.item)!;
        const resLocal = this.allocateTempLocal();
        const resLocalIdx = this.getTempLocalIndex(resLocal);
        const countLocal = this.allocateTempLocal();
        const countLocalIdx = this.getTempLocalIndex(countLocal);
        const iterPtrLocal = this.allocateTempLocal();
        const iterPtrLocalIdx = this.getTempLocalIndex(iterPtrLocal);
        const iterLenLocal = this.allocateTempLocal();
        const iterLenLocalIdx = this.getTempLocalIndex(iterLenLocal);
        const iLocal = this.allocateTempLocal();
        const iLocalIdx = this.getTempLocalIndex(iLocal);
        const resItemPtr = this.allocateTempLocal();
        const resItemPtrIdx = this.getTempLocalIndex(resItemPtr);

        const actionBytes = [
          ...(node.condition
            ? [...this.emitExpressionBinary(node.condition), OP_IF, TYPE_EMPTY]
            : []),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_LOCAL_SET, // local.set resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_I32_CONST, // i32.const 4
          4,
          OP_I32_ADD, // i32.add
          OP_GLOBAL_SET, // global.set 0
          0,
          OP_LOCAL_GET, // local.get resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          ...this.emitExpressionBinary(node.expression),
          OP_I32_STORE, // i32.store
          2,
          0,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          OP_I32_CONST,
          1,
          OP_I32_ADD,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          ...(node.condition ? [OP_END] : []),
        ];

        return [
          ...this.emitExpressionBinary(node.iterable),
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          OP_I32_LOAD, // i32.load
          2,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iterLenLocalIdx),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          OP_I32_CONST,
          0,
          OP_I32_STORE, // i32.store count 0
          2,
          0,
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_I32_CONST,
          4,
          OP_I32_ADD,
          OP_GLOBAL_SET, // global.set 0
          0,
          OP_I32_CONST,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          OP_I32_CONST,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_BLOCK,
          TYPE_EMPTY,
          OP_LOOP,
          TYPE_EMPTY,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iterLenLocalIdx),
          OP_I32_GE_S, // i32.ge_s
          OP_BR_IF,
          1, // br_if 1
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_I32_CONST,
          4,
          OP_I32_MUL,
          OP_I32_ADD,
          OP_I32_CONST,
          4,
          OP_I32_ADD,
          OP_I32_LOAD, // i32.load
          2,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(itemLocalIdx),
          ...actionBytes,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_I32_CONST,
          1,
          OP_I32_ADD,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_BR,
          0,
          OP_END,
          OP_END,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          OP_I32_STORE, // store final count
          2,
          0,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
        ];
      }
      case "DictComprehension": {
        const itemLocalIdx = this.locals.get(node.item)!;
        const resLocal = this.allocateTempLocal();
        const resLocalIdx = this.getTempLocalIndex(resLocal);
        const countLocal = this.allocateTempLocal();
        const countLocalIdx = this.getTempLocalIndex(countLocal);
        const iterPtrLocal = this.allocateTempLocal();
        const iterPtrLocalIdx = this.getTempLocalIndex(iterPtrLocal);
        const iterLenLocal = this.allocateTempLocal();
        const iterLenLocalIdx = this.getTempLocalIndex(iterLenLocal);
        const iLocal = this.allocateTempLocal();
        const iLocalIdx = this.getTempLocalIndex(iLocal);
        const resItemPtr = this.allocateTempLocal();
        const resItemPtrIdx = this.getTempLocalIndex(resItemPtr);

        const actionBytes = [
          ...(node.condition
            ? [...this.emitExpressionBinary(node.condition), OP_IF, TYPE_EMPTY]
            : []),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_LOCAL_SET, // local.set resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_I32_CONST, // i32.const 4
          4,
          OP_I32_ADD, // i32.add
          OP_GLOBAL_SET, // global.set 0
          0,
          OP_LOCAL_GET, // local.get resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          ...this.emitExpressionBinary(node.key),
          OP_I32_STORE, // i32.store
          2,
          0,
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_LOCAL_SET, // local.set resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_I32_CONST, // i32.const 4
          4,
          OP_I32_ADD, // i32.add
          OP_GLOBAL_SET, // global.set 0
          0,
          OP_LOCAL_GET, // local.get resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          ...this.emitExpressionBinary(node.value),
          OP_I32_STORE, // i32.store
          2,
          0,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          OP_I32_CONST,
          1,
          OP_I32_ADD,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          ...(node.condition ? [OP_END] : []),
        ];

        return [
          ...this.emitExpressionBinary(node.iterable),
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          OP_I32_LOAD, // i32.load
          2,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iterLenLocalIdx),
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          OP_I32_CONST,
          0,
          OP_I32_STORE, // i32.store count 0
          2,
          0,
          OP_GLOBAL_GET, // global.get 0
          0,
          OP_I32_CONST,
          4,
          OP_I32_ADD,
          OP_GLOBAL_SET, // global.set 0
          0,
          OP_I32_CONST,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          OP_I32_CONST,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_BLOCK,
          TYPE_EMPTY,
          OP_LOOP,
          TYPE_EMPTY,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iterLenLocalIdx),
          OP_I32_GE_S, // i32.ge_s
          OP_BR_IF,
          1, // br_if 1
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_I32_CONST,
          4,
          OP_I32_MUL,
          OP_I32_ADD,
          OP_I32_CONST,
          4,
          OP_I32_ADD,
          OP_I32_LOAD, // i32.load
          2,
          0,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(itemLocalIdx),
          ...actionBytes,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_I32_CONST,
          1,
          OP_I32_ADD,
          OP_LOCAL_SET,
          ...this.encodeUnsignedLEB128(iLocalIdx),
          OP_BR,
          0,
          OP_END,
          OP_END,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          OP_I32_STORE, // store final count
          2,
          0,
          OP_LOCAL_GET,
          ...this.encodeUnsignedLEB128(resLocalIdx),
        ];
      }
      case "BinaryExpression": {
        if (node.operator === "+") {
          const isString = (n: ASTNode) =>
            (n.type === "Literal" && typeof n.value === "string") ||
            n.type === "FString";
          if (isString(node.left) || isString(node.right)) {
            return [
              ...this.emitExpressionBinary(node.left),
              ...this.emitExpressionBinary(node.right),
              OP_CALL,
              ...this.encodeUnsignedLEB128(this.functionMap.get("concat")!),
            ];
          }
        }
        let opByte = 0;
        switch (node.operator) {
          case "+":
            opByte = OP_I32_ADD;
            break;
          case "-":
            opByte = OP_I32_SUB;
            break;
          case "*":
            opByte = OP_I32_MUL;
            break;
          case "/":
            opByte = OP_I32_DIV_S;
            break;
          case "==":
            opByte = OP_I32_EQ;
            break;
          case "!=":
            opByte = OP_I32_NE;
            break;
          case "<":
            opByte = OP_I32_LT_S;
            break;
          case ">":
            opByte = OP_I32_GT_S;
            break;
          case "and":
            return [
              ...this.emitExpressionBinary(node.left),
              OP_I32_CONST,
              0,
              OP_I32_NE,
              ...this.emitExpressionBinary(node.right),
              OP_I32_CONST,
              0,
              OP_I32_NE,
              OP_I32_AND,
            ];
          case "or":
            return [
              ...this.emitExpressionBinary(node.left),
              OP_I32_CONST,
              0,
              OP_I32_NE,
              ...this.emitExpressionBinary(node.right),
              OP_I32_CONST,
              0,
              OP_I32_NE,
              OP_I32_OR,
            ];
        }
        return [
          ...this.emitExpressionBinary(node.left),
          ...this.emitExpressionBinary(node.right),
          opByte,
        ];
      }
      case "UnaryExpression":
        if (node.operator === "-")
          return [
            OP_I32_CONST,
            0,
            ...this.emitExpressionBinary(node.argument),
            OP_I32_SUB,
          ];
        if (node.operator === "not")
          return [...this.emitExpressionBinary(node.argument), OP_I32_EQZ];
        return this.emitExpressionBinary(node.argument);
      case "CallExpression": {
        const calleeIdx = this.functionMap.get(node.callee);
        if (calleeIdx === undefined) {
          throw new Error(`Undefined function: ${node.callee}`);
        }
        const argsBytes = node.args
          .map((a) => this.emitExpressionBinary(a))
          .flat();

        if (node.callee === "print" && node.args.length === 1) {
          const arg = node.args[0];
          if (
            (arg.type === "Literal" && typeof arg.value === "string") ||
            arg.type === "FString"
          ) {
            return [
              ...argsBytes,
              OP_CALL,
              ...this.encodeUnsignedLEB128(this.functionMap.get("print_str")!),
            ];
          }
        }

        return [...argsBytes, OP_CALL, ...this.encodeUnsignedLEB128(calleeIdx)];
      }
      case "FString": {
        const bytes: number[] = [];
        node.parts.forEach((part, i) => {
          if (typeof part === "string") {
            bytes.push(
              ...this.emitExpressionBinary({
                type: "Literal",
                value: part,
              } as any),
            );
          } else {
            bytes.push(
              ...this.emitExpressionBinary(part),
              OP_CALL,
              ...this.encodeUnsignedLEB128(this.functionMap.get("itoa")!),
            );
          }
          if (i > 0) {
            bytes.push(
              OP_CALL,
              ...this.encodeUnsignedLEB128(this.functionMap.get("concat")!),
            );
          }
        });
        return bytes;
      }
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
