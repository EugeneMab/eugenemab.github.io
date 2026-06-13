import {
  Program,
  Expression,
  FunctionDeclaration,
  BlockStatement,
  ASTNode,
} from "./parser.js";
import { formatError } from "./error.js";

const SECTION_TYPE = 0x01;
const SECTION_IMPORT = 0x02;
const SECTION_FUNCTION = 0x03;
const SECTION_MEMORY = 0x05;
const SECTION_EXPORT = 0x07;
const SECTION_CODE = 0x0a;

const TYPE_I32 = 0x7f;
const TYPE_FUNC = 0x60;
const HEAP_BASE = 1024;

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
const OP_I32_REM_S = 0x6f;
const OP_I32_AND = 0x71;
const OP_I32_OR = 0x72;
const OP_I32_XOR = 0x73;
const OP_I32_SHL = 0x74;
const OP_I32_SHR_S = 0x75;
const OP_I32_EQ = 0x46;
const OP_I32_NE = 0x47;
const OP_I32_LT_S = 0x48;
const OP_I32_GT_S = 0x4a;
const OP_I32_LE_S = 0x4c;
const OP_I32_GE_S = 0x4e;
const OP_IF = 0x04;
const OP_ELSE = 0x05;
const OP_LOOP = 0x03;
const OP_BR = 0x0c;
const OP_BLOCK = 0x02;
const OP_RETURN = 0x0f;
const OP_UNREACHABLE = 0x00;
const OP_I32_EQZ = 0x45;
const OP_I32_LOAD = [0x28, 0x00, 0x00];
const OP_I32_LOAD8_U = [0x2d, 0x00, 0x00];
const OP_I32_STORE = [0x36, 0x00, 0x00];
const OP_GLOBAL_GET = [0x23, 0x00];
const OP_GLOBAL_SET = [0x24, 0x00];
const OP_MEMORY_COPY = [0xfc, 0x0a, 0x00, 0x00];
// System helpers are imported from JS runtime after the 3 base imports.
// Indices: get_item=3, get_item_i32=4, set_item=5, set_item_i32=6.
// User functions start at HELPER_FN_START.
const HELPER_FN_START = 7;

interface VariableInfo {
  uniqueName: string;
  isMutable: boolean;
  isBorrowedMut: boolean;
  borrowCount: number;
  valueType?: string;
}

interface Scope {
  vars: Map<string, VariableInfo>;
  borrows: { info: VariableInfo; isMut: boolean }[];
  heapBackupName: string;
}

export class Emitter {
  private program: Program;
  private source: string;
  private indent = 0;
  private outputWAT: string[] = [];
  private functionIndices: Map<string, number> = new Map();
  private locals: Map<string, number> = new Map();
  private scopeStack: Scope[] = [];
  private loopStack: { breakDepth: number; continueDepth: number }[] = [];
  private allLocals: Set<string> = new Set();
  private localCounter = 0;
  private stringConstants: Map<string, number> = new Map();
  private stringOffset = 0;
  private currentBlockDepth = 0;
  private functionReturnTypes: Map<string, string | undefined> = new Map();
  private structDefinitions: Map<string, any> = new Map();

  constructor(program: Program, source: string) {
    this.program = program;
    this.source = source;
  }

  private throwError(message: string, node: ASTNode): never {
    if (node.token) {
      throw new Error(formatError(this.source, message, node.token));
    }
    throw new Error(message);
  }

  private normalizeType(type?: string): string | undefined {
    if (!type) return undefined;
    return type.trim().replace(/\s+/g, " ").replace(/&\s+/g, "&");
  }

  private getBaseType(type?: string): string | undefined {
    let t = this.normalizeType(type);
    if (!t) return undefined;
    while (t.startsWith("&") || t.startsWith("mut ")) {
      if (t.startsWith("&")) t = t.substring(1).trim();
      else if (t.startsWith("mut ")) t = t.substring(4).trim();
    }
    return t;
  }

  private getStructFieldOffset(structName: string, fieldName: string): number {
    const struct = this.structDefinitions.get(structName);
    if (!struct) this.throwError(`Unknown struct: ${structName}`, {} as any);
    if (struct.type === "RegularStructDeclaration") {
      let offset = 0;
      for (const field of struct.fields) {
        if (field.name === fieldName) return offset;
        offset += 4; // Assume 4 bytes for everything for now
      }
    } else if (struct.type === "TupleStructDeclaration") {
      const index = parseInt(fieldName);
      if (!isNaN(index)) {
        return index * 4;
      }
    }
    this.throwError(
      `Unknown field: ${fieldName} in struct ${structName}`,
      {} as any,
    );
  }

  private getStructSize(structName: string): number {
    const struct = this.structDefinitions.get(structName);
    if (!struct) return 4; // Default to 4 if not found (might be a pointer)
    if (struct.type === "RegularStructDeclaration") {
      return struct.fields.length * 4;
    } else if (struct.type === "TupleStructDeclaration") {
      return struct.fields.length * 4;
    }
    return 0; // Unit struct
  }

  private isStringLikeType(type?: string): boolean {
    const normalized = this.normalizeType(type);
    return (
      normalized === "String" ||
      normalized === "&String" ||
      normalized === "&str"
    );
  }

  private isByteLikeType(type?: string): boolean {
    return this.normalizeType(type) === "bytes";
  }

  private isArrayLikeType(type?: string): boolean {
    const normalized = this.normalizeType(type);
    return (
      normalized === "array" ||
      normalized === "slice" ||
      this.isByteLikeType(normalized)
    );
  }

  private inferExpressionType(expr: Expression): string | undefined {
    switch (expr.type) {
      case "Literal":
        if (expr.rawType === "string") return "&str";
        if (expr.rawType === "byte") return "u8";
        if (expr.rawType === "bool") return "bool";
        return "i32";
      case "ArrayLiteral":
        return "array";
      case "Identifier": {
        const info = this.resolveVariable(expr.name);
        if (info) return info.valueType;
        if (this.structDefinitions.has(expr.name)) return expr.name;
        return undefined;
      }
      case "BorrowExpression":
        return this.inferExpressionType(expr.argument);
      case "RangeExpression":
        return "range";
      case "MemberAccessExpression": {
        if (expr.member === "len") return "usize";
        const objectType = this.inferExpressionType(expr.object);
        const baseType = this.getBaseType(objectType);
        if (baseType && this.structDefinitions.has(baseType)) {
          const struct = this.structDefinitions.get(baseType);
          if (struct.type === "RegularStructDeclaration") {
            const field = struct.fields.find(
              (f: any) => f.name === expr.member,
            );
            if (field) return this.normalizeType(field.type);
          } else if (struct.type === "TupleStructDeclaration") {
            const index = parseInt(expr.member);
            if (!isNaN(index) && index < struct.fields.length) {
              return this.normalizeType(struct.fields[index]);
            }
          }
        } else if (objectType && objectType.startsWith("(")) {
          const index = parseInt(expr.member);
          const types = objectType
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim());
          if (!isNaN(index) && index < types.length) {
            return types[index];
          }
        }
        return undefined;
      }
      case "StructLiteral":
        return expr.name;
      case "TupleLiteral": {
        const types = expr.elements.map(
          (e) => this.inferExpressionType(e) || "i32",
        );
        return `(${types.join(", ")})`;
      }
      case "IndexExpression": {
        const objectType = this.inferExpressionType(expr.object);
        if (expr.index.type === "RangeExpression") {
          if (this.isStringLikeType(objectType)) return "&str";
          if (this.isByteLikeType(objectType)) return "bytes";
          if (this.isArrayLikeType(objectType)) return "slice";
          return objectType;
        }
        if (
          this.isStringLikeType(objectType) ||
          this.isByteLikeType(objectType)
        ) {
          return "u8";
        }
        if (this.isArrayLikeType(objectType)) return "i32";
        return undefined;
      }
      case "CallExpression":
        if (expr.callee === "String::from") return "String";
        if (expr.callee === "as_bytes") return "bytes";
        if (expr.callee === "iter" || expr.callee === "enumerate") {
          return this.inferExpressionType(expr.args[0]);
        }
        if (expr.callee === "len") return "usize";
        if (this.structDefinitions.has(expr.callee)) return expr.callee;
        return this.normalizeType(this.functionReturnTypes.get(expr.callee));
      case "MacroInvocation":
        return "i32";
      case "UnaryExpression":
        if (expr.operator === "!") return "bool";
        return "i32";
      case "BinaryExpression":
        if (
          ["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(expr.operator)
        ) {
          return "bool";
        }
        return "i32";
      case "BlockStatement":
        return expr.tailExpression
          ? this.inferExpressionType(expr.tailExpression)
          : "i32";
      case "IfStatement":
        return this.inferExpressionType(expr.thenBranch);
    }
  }

  private emitPrintCallForExpression(
    expr: Expression,
    body: number[],
    specifier: string = "",
  ) {
    const type = this.inferExpressionType(expr);
    const baseType = this.getBaseType(type);

    if (specifier === ":?" || specifier === ":#?") {
      if (
        (baseType && this.structDefinitions.has(baseType)) ||
        (baseType && baseType.startsWith("("))
      ) {
        this.emitDebugPrint(expr, baseType || "", body);
        return;
      }
    }

    if (
      (baseType && this.structDefinitions.has(baseType)) ||
      (baseType && baseType.startsWith("("))
    ) {
      if (specifier === "") {
        this.throwError(
          `\`${baseType}\` cannot be formatted with the default formatter`,
          expr,
        );
      }
    }

    this.emitExpressionBinary(expr, body);
    if (type === "bool") {
      body.push(OP_IF, 0x40);
      this.emitStringPrintBinary("true", body);
      body.push(OP_ELSE);
      this.emitStringPrintBinary("false", body);
      body.push(OP_END);
      body.push(OP_I32_CONST, 0); // Result of printing for the caller
    } else {
      body.push(
        OP_CALL,
        ...this.encodeUnsignedLEB128(this.isStringLikeType(type) ? 1 : 0),
      );
    }
  }

  private emitDebugPrint(expr: Expression, baseType: string, body: number[]) {
    const ptrLocal = `debug_ptr_${++this.localCounter}`;
    this.allLocals.add(ptrLocal);
    this.emitExpressionBinary(expr, body);
    body.push(OP_LOCAL_SET, 0xfe, ptrLocal as any);

    if (baseType.startsWith("(")) {
      this.emitStringPrintBinary("(", body);
      const types = baseType
        .slice(1, -1)
        .split(",")
        .map((t) => t.trim());
      types.forEach((t, i) => {
        if (i > 0) this.emitStringPrintBinary(", ", body);
        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(i * 4));
        body.push(OP_I32_ADD);
        body.push(...OP_I32_LOAD);
        body.push(
          OP_CALL,
          ...this.encodeUnsignedLEB128(this.isStringLikeType(t) ? 1 : 0),
        );
        body.push(OP_DROP);
      });
      this.emitStringPrintBinary(")", body);
      return;
    }

    const struct = this.structDefinitions.get(baseType);
    if (!struct) {
      // Fallback for non-struct types with :? (just print normally)
      body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
      body.push(
        OP_CALL,
        ...this.encodeUnsignedLEB128(
          this.isStringLikeType(this.normalizeType(baseType)) ? 1 : 0,
        ),
      );
      body.push(OP_DROP);
      return;
    }

    if (struct.type === "RegularStructDeclaration") {
      this.emitStringPrintBinary(`${baseType} { `, body);
      struct.fields.forEach((field: any, i: number) => {
        if (i > 0) this.emitStringPrintBinary(", ", body);
        this.emitStringPrintBinary(`${field.name}: `, body);

        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        const offset = this.getStructFieldOffset(baseType, field.name);
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(offset));
        body.push(OP_I32_ADD);
        body.push(...OP_I32_LOAD);

        const fieldType = this.normalizeType(field.type);
        body.push(
          OP_CALL,
          ...this.encodeUnsignedLEB128(
            this.isStringLikeType(fieldType) ? 1 : 0,
          ),
        );
        body.push(OP_DROP);
      });
      this.emitStringPrintBinary(" }", body);
    } else if (struct.type === "TupleStructDeclaration") {
      this.emitStringPrintBinary(`${baseType}(`, body);
      struct.fields.forEach((fieldType: string, i: number) => {
        if (i > 0) this.emitStringPrintBinary(", ", body);

        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(i * 4));
        body.push(OP_I32_ADD);
        body.push(...OP_I32_LOAD);

        const normalizedFieldType = this.normalizeType(fieldType);
        body.push(
          OP_CALL,
          ...this.encodeUnsignedLEB128(
            this.isStringLikeType(normalizedFieldType) ? 1 : 0,
          ),
        );
        body.push(OP_DROP);
      });
      this.emitStringPrintBinary(")", body);
    } else if (struct.type === "UnitStructDeclaration") {
      this.emitStringPrintBinary(baseType, body);
    }
    body.push(OP_I32_CONST, 0);
  }

  private emitCallArgumentWAT(arg: Expression, retainBorrow: boolean) {
    if (
      !retainBorrow &&
      arg.type === "BorrowExpression" &&
      !arg.isMutable &&
      arg.argument.type === "Identifier"
    ) {
      const info = this.resolveVariable(arg.argument.name);
      if (!info) {
        this.throwError(
          `Undefined variable: ${arg.argument.name}`,
          arg.argument,
        );
      }
      if (info.isBorrowedMut) {
        this.throwError(
          `Cannot borrow '${arg.argument.name}' as immutable: already borrowed as mutable`,
          arg,
        );
      }
      this.emitWATLine(`local.get $${info.uniqueName}`);
      return;
    }
    this.emitExpressionWAT(arg);
  }

  private emitCallArgumentBinary(
    arg: Expression,
    body: number[],
    retainBorrow: boolean,
  ) {
    if (
      !retainBorrow &&
      arg.type === "BorrowExpression" &&
      !arg.isMutable &&
      arg.argument.type === "Identifier"
    ) {
      const info = this.resolveVariable(arg.argument.name);
      if (!info) {
        this.throwError(
          `Undefined variable: ${arg.argument.name}`,
          arg.argument,
        );
      }
      if (info.isBorrowedMut) {
        this.throwError(
          `Cannot borrow '${arg.argument.name}' as immutable: already borrowed as mutable`,
          arg,
        );
      }
      body.push(OP_LOCAL_GET, 0xfe, info.uniqueName as any);
      return;
    }
    this.emitExpressionBinary(arg, body);
  }

  private emitPrintCallForVariable(info: VariableInfo) {
    this.emitWATLine(`local.get $${info.uniqueName}`);
    if (info.valueType === "bool") {
      this.emitWATLine("if");
      this.emitStringPrintWAT("true");
      this.emitWATLine("else");
      this.emitStringPrintWAT("false");
      this.emitWATLine("end");
      this.emitWATLine("i32.const 0");
    } else {
      this.emitWATLine(
        `call $${this.isStringLikeType(info.valueType) ? "print_str" : "print"}`,
      );
    }
  }

  private emitPrintCallForExpressionWAT(expr: Expression) {
    const type = this.inferExpressionType(expr);
    if (type === "bool") {
      this.emitExpressionWAT(expr);
      this.emitWATLine("if");
      this.emitStringPrintWAT("true");
      this.emitWATLine("else");
      this.emitStringPrintWAT("false");
      this.emitWATLine("end");
      this.emitWATLine("i32.const 0");
    } else {
      this.emitExpressionWAT(expr);
      this.emitWATLine(
        `call $${this.isStringLikeType(type) ? "print_str" : "print"}`,
      );
    }
  }

  private prepareFunctionMetadata() {
    this.functionIndices.clear();
    this.functionIndices.set("print", 0);
    this.functionIndices.set("print_str", 1);
    this.functionIndices.set("panic", 2);
    // System helpers imported from runtime.
    this.functionIndices.set("get_item", 3);
    this.functionIndices.set("get_item_i32", 4);
    this.functionIndices.set("set_item", 5);
    this.functionIndices.set("set_item_i32", 6);

    this.functionReturnTypes.clear();
    this.structDefinitions.clear();
    this.program.body.forEach((s) => {
      if (
        s.type === "RegularStructDeclaration" ||
        s.type === "TupleStructDeclaration" ||
        s.type === "UnitStructDeclaration"
      ) {
        this.structDefinitions.set(s.name, s);
        if (s.type === "RegularStructDeclaration") {
          s.fields.forEach((f) => {
            if (f.type.includes("&") && !f.type.includes("'")) {
              this.throwError("missing lifetime specifier", s);
            }
          });
        }
      }
    });

    const userFunctions: FunctionDeclaration[] = [];
    this.program.body.forEach((s) => {
      if (s.type === "FunctionDeclaration") {
        userFunctions.push(s);
      } else if (s.type === "ImplDeclaration") {
        s.functions.forEach((fn) => {
          const mangledName = `${s.target}::${fn.name}`;
          const params = fn.params.map((p) => {
            if (p.isSelf && !p.type) {
              return {
                ...p,
                type:
                  (p.isBorrow ? "&" : "") + (p.isMut ? "mut " : "") + s.target,
              };
            }
            return {
              ...p,
              type: p.type === "Self" ? s.target : p.type,
            };
          });
          userFunctions.push({
            ...fn,
            name: mangledName,
            params,
            returnType: fn.returnType === "Self" ? s.target : fn.returnType,
          });
        });
      }
    });

    userFunctions.forEach((fn, i) => {
      this.functionIndices.set(fn.name, HELPER_FN_START + i);
      this.functionReturnTypes.set(fn.name, this.normalizeType(fn.returnType));
    });
    return userFunctions;
  }

  emitWAT(): string {
    this.outputWAT = [];
    this.stringConstants.clear();
    this.stringOffset = 0;
    const userFunctions = this.prepareFunctionMetadata();

    const moduleWAT: string[] = [];
    this.indent++;

    const oldOutputWAT = this.outputWAT;
    this.outputWAT = moduleWAT;

    this.emitWATLine(
      '(import "env" "print" (func $print (param i32) (result i32)))',
    );
    this.emitWATLine(
      '(import "env" "print_str" (func $print_str (param i32) (result i32)))',
    );
    this.emitWATLine(
      '(import "env" "panic" (func $panic (param i32) (result i32)))',
    );
    this.emitWATLine(
      '(import "env" "get_item" (func $get_item (param i32 i32) (result i32)))',
    );
    this.emitWATLine(
      '(import "env" "get_item_i32" (func $get_item_i32 (param i32 i32) (result i32)))',
    );
    this.emitWATLine(
      '(import "env" "set_item" (func $set_item (param i32 i32 i32) (result i32)))',
    );
    this.emitWATLine(
      '(import "env" "set_item_i32" (func $set_item_i32 (param i32 i32 i32) (result i32)))',
    );
    this.emitWATLine('(memory (export "memory") 1)');

    for (const fn of userFunctions) {
      this.emitFunctionWAT(fn);
    }

    this.emitWATLine(
      `(global $heap_ptr (mut i32) (i32.const ${Math.max(HEAP_BASE, this.stringOffset)}))`,
    );

    // Emit data sections for strings
    for (const [str, offset] of this.stringConstants.entries()) {
      const bytes = Array.from(new TextEncoder().encode(str));
      const len = bytes.length;
      const lenBytes = [
        len & 0xff,
        (len >> 8) & 0xff,
        (len >> 16) & 0xff,
        (len >> 24) & 0xff,
      ];
      const hex = [...lenBytes, ...bytes]
        .map((b) => "\\" + b.toString(16).padStart(2, "0"))
        .join("");
      this.emitWATLine(`(data (i32.const ${offset}) "${hex}")`);
    }

    this.indent--;
    this.outputWAT = oldOutputWAT;
    this.emitWATLine("(module");
    moduleWAT.forEach((line) => this.outputWAT.push(line));
    this.emitWATLine(")");
    return this.outputWAT.join("\n");
  }

  private emitFunctionWAT(fn: FunctionDeclaration) {
    this.localCounter = 0;
    this.currentBlockDepth = 0;
    this.allLocals.clear();
    this.scopeStack = [
      {
        vars: new Map(),
        borrows: [],
        heapBackupName: "",
      },
    ];
    for (const p of fn.params) {
      this.scopeStack[0].vars.set(p.name, {
        uniqueName: p.name,
        isMutable: false,
        isBorrowedMut: false,
        borrowCount: 0,
        valueType: this.normalizeType(p.type),
      });
    }

    const oldOutput = this.outputWAT;
    this.outputWAT = [];
    this.indent = 0;

    this.emitBlockWAT(fn.body);
    const bodyWAT = this.outputWAT;
    this.outputWAT = oldOutput;
    this.indent = 1;

    const params = fn.params.map((p) => `(param $${p.name} i32)`).join(" ");
    this.emitWATLine(`(func (export "${fn.name}") ${params} (result i32)`);
    this.indent++;

    for (const local of this.allLocals) {
      this.emitWATLine(`(local $${local} i32)`);
    }

    bodyWAT.forEach((line) => {
      this.outputWAT.push("  ".repeat(this.indent) + line);
    });

    this.indent--;
    this.emitWATLine(")");
  }

  private emitBlockWAT(block: BlockStatement) {
    const heapBackupName = `old_heap_ptr_${++this.localCounter}`;
    this.allLocals.add(heapBackupName);

    this.emitWATLine("global.get $heap_ptr");
    this.emitWATLine(`local.set $${heapBackupName}`);

    this.scopeStack.push({
      vars: new Map(),
      borrows: [],
      heapBackupName,
    });

    for (const stmt of block.body) {
      if (stmt.type === "LetStatement") {
        this.emitExpressionWAT(stmt.initializer);
        const uniqueName = `${stmt.name}_${++this.localCounter}`;
        this.allLocals.add(uniqueName);
        const info: VariableInfo = {
          uniqueName,
          isMutable: stmt.isMutable,
          isBorrowedMut: false,
          borrowCount: 0,
          valueType: this.inferExpressionType(stmt.initializer),
        };
        this.scopeStack[this.scopeStack.length - 1].vars.set(stmt.name, info);
        this.emitWATLine(`local.set $${uniqueName}`);
      } else if (stmt.type === "ConstStatement") {
        this.emitExpressionWAT(stmt.initializer);
        const uniqueName = `${stmt.name}_${++this.localCounter}`;
        this.allLocals.add(uniqueName);
        const info: VariableInfo = {
          uniqueName,
          isMutable: false,
          isBorrowedMut: false,
          borrowCount: 0,
          valueType: this.inferExpressionType(stmt.initializer),
        };
        this.scopeStack[this.scopeStack.length - 1].vars.set(stmt.name, info);
        this.emitWATLine(`local.set $${uniqueName}`);
      } else if (stmt.type === "IfStatement") {
        this.emitExpressionWAT(stmt.condition);
        this.emitWATLine("if (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.emitBlockWAT(stmt.thenBranch);
        this.indent--;
        if (stmt.elseBranch) {
          this.emitWATLine("else");
          this.indent++;
          if (stmt.elseBranch.type === "BlockStatement") {
            this.emitBlockWAT(stmt.elseBranch);
          } else {
            // else if
            this.emitBlockWAT({
              type: "BlockStatement",
              body: [stmt.elseBranch],
            });
          }
          this.indent--;
        } else {
          this.emitWATLine("else");
          this.indent++;
          this.emitWATLine("i32.const 0");
          this.indent--;
        }
        this.currentBlockDepth--;
        this.emitWATLine("end");
        this.emitWATLine("drop");
      } else if (stmt.type === "LoopStatement") {
        this.emitWATLine("block $exit (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.emitWATLine("loop $loop (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.loopStack.push({
          breakDepth: this.currentBlockDepth - 1,
          continueDepth: this.currentBlockDepth,
        });
        this.emitBlockWAT(stmt.body);
        this.emitWATLine("drop");
        this.emitWATLine("i32.const 0"); // Loop fallthrough value
        this.emitWATLine("br $loop");
        this.indent--;
        this.currentBlockDepth--;
        this.loopStack.pop();
        this.emitWATLine("end");
        this.indent--;
        this.currentBlockDepth--;
        this.emitWATLine("end");
        this.emitWATLine("drop");
      } else if (stmt.type === "WhileStatement") {
        this.emitWATLine("block (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.emitWATLine("loop (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.loopStack.push({
          breakDepth: this.currentBlockDepth - 1,
          continueDepth: this.currentBlockDepth,
        });
        // Condition check: if NOT condition, break out
        this.emitExpressionWAT(stmt.condition);
        this.emitWATLine("i32.eqz");
        this.emitWATLine("if");
        this.indent++;
        this.currentBlockDepth++;
        const wLoop = this.loopStack[this.loopStack.length - 1];
        const wBreakLevels = this.currentBlockDepth - wLoop.breakDepth;
        this.emitWATLine("i32.const 0");
        this.emitWATLine(`br ${wBreakLevels}`);
        this.indent--;
        this.currentBlockDepth--;
        this.emitWATLine("end");
        this.emitBlockWAT(stmt.body);
        this.emitWATLine("drop");
        this.emitWATLine("i32.const 0");
        this.emitWATLine("br 0");
        this.indent--;
        this.currentBlockDepth--;
        this.loopStack.pop();
        this.emitWATLine("end");
        this.indent--;
        this.currentBlockDepth--;
        this.emitWATLine("end");
        this.emitWATLine("drop");
      } else if (stmt.type === "ForStatement") {
        const iterLocal = `iter_idx_${++this.localCounter}`;
        const objLocal = `iter_obj_${++this.localCounter}`;
        const lenLocal = `iter_len_${++this.localCounter}`;
        this.allLocals.add(iterLocal);
        this.allLocals.add(objLocal);
        this.allLocals.add(lenLocal);

        const iterableTypeWAT = this.inferExpressionType(stmt.iterable);
        if (
          !this.isByteLikeType(iterableTypeWAT) &&
          !this.isStringLikeType(iterableTypeWAT)
        ) {
          this.throwError(
            "for-in currently only supports iterating over byte sequences (e.g., s.as_bytes())",
            stmt,
          );
        }

        this.emitExpressionWAT(stmt.iterable);
        this.emitWATLine(`local.set $${objLocal}`);
        this.emitWATLine(`local.get $${objLocal}`);
        this.emitWATLine("i32.load");
        this.emitWATLine(`local.set $${lenLocal}`);
        this.emitWATLine("i32.const 0");
        this.emitWATLine(`local.set $${iterLocal}`);

        this.emitWATLine("block (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.emitWATLine("loop (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.loopStack.push({
          breakDepth: this.currentBlockDepth - 1,
          continueDepth: this.currentBlockDepth,
        });

        this.emitWATLine(`local.get $${iterLocal}`);
        this.emitWATLine(`local.get $${lenLocal}`);
        this.emitWATLine("i32.ge_s");
        this.emitWATLine("if");
        this.indent++;
        this.currentBlockDepth++;
        const fLoop = this.loopStack[this.loopStack.length - 1];
        this.emitWATLine("i32.const 0");
        this.emitWATLine(`br ${this.currentBlockDepth - fLoop.breakDepth}`);
        this.indent--;
        this.currentBlockDepth--;
        this.emitWATLine("end");

        this.emitForPatternWAT(stmt.pattern, iterLocal, objLocal);

        this.emitBlockWAT(stmt.body);
        this.emitWATLine("drop");

        this.emitWATLine(`local.get $${iterLocal}`);
        this.emitWATLine("i32.const 1");
        this.emitWATLine("i32.add");
        this.emitWATLine(`local.set $${iterLocal}`);

        this.emitWATLine("i32.const 0");
        this.emitWATLine("br 0");
        this.indent--;
        this.currentBlockDepth--;
        this.loopStack.pop();
        this.emitWATLine("end");
        this.indent--;
        this.currentBlockDepth--;
        this.emitWATLine("end");
        this.emitWATLine("drop");
      } else if (stmt.type === "BreakStatement") {
        if (this.loopStack.length === 0)
          this.throwError("'break' outside of loop", stmt);
        const loop = this.loopStack[this.loopStack.length - 1];
        const levels = this.currentBlockDepth - loop.breakDepth;
        this.emitWATLine("i32.const 0");
        this.emitWATLine(`br ${levels}`);
      } else if (stmt.type === "ContinueStatement") {
        if (this.loopStack.length === 0)
          this.throwError("'continue' outside of loop", stmt);
        const loop = this.loopStack[this.loopStack.length - 1];
        const levels = this.currentBlockDepth - loop.continueDepth;
        this.emitWATLine("i32.const 0");
        this.emitWATLine(`br ${levels}`);
      } else if (stmt.type === "ReturnStatement") {
        if (stmt.argument) {
          this.emitExpressionWAT(stmt.argument);
        } else {
          this.emitWATLine("i32.const 0");
        }
        this.emitWATLine("return");
      } else if (stmt.type === "ExpressionStatement") {
        this.emitExpressionWAT(stmt.expression);
        this.emitWATLine("drop");
      } else if (stmt.type === "BlockStatement") {
        this.emitBlockWAT(stmt);
        this.emitWATLine("drop");
      }
    }

    this.emitWATLine(`local.get $${heapBackupName}`);
    this.emitWATLine("global.set $heap_ptr");

    if (block.tailExpression) {
      this.emitExpressionWAT(block.tailExpression);
    } else {
      this.emitWATLine("i32.const 0");
    }

    // Release borrows
    const scope = this.scopeStack.pop()!;
    for (const borrow of scope.borrows) {
      if (borrow.isMut) {
        borrow.info.isBorrowedMut = false;
      } else {
        borrow.info.borrowCount--;
      }
    }
  }

  private resolveVariable(name: string): VariableInfo | undefined {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      if (this.scopeStack[i].vars.has(name)) {
        return this.scopeStack[i].vars.get(name)!;
      }
    }
    return undefined;
  }

  private emitExpressionWAT(expr: Expression) {
    switch (expr.type) {
      case "BlockStatement":
        this.emitBlockWAT(expr);
        break;
      case "IfStatement": {
        this.emitExpressionWAT(expr.condition);
        this.emitWATLine("if (result i32)");
        this.indent++;
        this.currentBlockDepth++;
        this.emitBlockWAT(expr.thenBranch);
        this.indent--;
        if (expr.elseBranch) {
          this.emitWATLine("else");
          this.indent++;
          if (expr.elseBranch.type === "BlockStatement") {
            this.emitBlockWAT(expr.elseBranch);
          } else {
            this.emitBlockWAT({
              type: "BlockStatement",
              body: [expr.elseBranch],
            });
          }
          this.indent--;
        } else {
          this.emitWATLine("else");
          this.indent++;
          this.emitWATLine("i32.const 0");
          this.indent--;
        }
        this.currentBlockDepth--;
        this.emitWATLine("end");
        break;
      }
      case "ArrayLiteral": {
        const ptrLocal = `array_ptr_${++this.localCounter}`;
        this.allLocals.add(ptrLocal);
        this.emitWATLine("global.get $heap_ptr");
        this.emitWATLine(`local.set $${ptrLocal}`);

        // Store length
        this.emitWATLine(`local.get $${ptrLocal}`);
        this.emitWATLine(`i32.const ${expr.elements.length}`);
        this.emitWATLine("i32.store");

        // Store elements
        expr.elements.forEach((el, i) => {
          this.emitWATLine(`local.get $${ptrLocal}`);
          this.emitWATLine(`i32.const ${4 + i * 4}`);
          this.emitWATLine("i32.add");
          this.emitExpressionWAT(el);
          this.emitWATLine("i32.store");
        });

        // Update heap_ptr
        this.emitWATLine(`local.get $${ptrLocal}`);
        this.emitWATLine(`i32.const ${4 + expr.elements.length * 4}`);
        this.emitWATLine("i32.add");
        this.emitWATLine("global.set $heap_ptr");

        this.emitWATLine(`local.get $${ptrLocal}`);
        break;
      }
      case "Literal":
        if (expr.rawType === "string") {
          const strValue = expr.value as string;
          if (!this.stringConstants.has(strValue)) {
            this.stringConstants.set(strValue, this.stringOffset);
            this.stringOffset += 4 + new TextEncoder().encode(strValue).length;
          }
          const offset = this.stringConstants.get(strValue)!;
          this.emitWATLine(`i32.const ${offset}`);
        } else if (expr.rawType === "byte") {
          this.emitWATLine(`i32.const ${expr.value}`);
        } else {
          this.emitWATLine(`i32.const ${expr.value}`);
        }
        break;
      case "RangeExpression":
        if (expr.start) {
          this.emitExpressionWAT(expr.start);
        } else {
          this.emitWATLine("i32.const 0");
        }
        if (expr.end) {
          this.emitExpressionWAT(expr.end);
        } else {
          this.emitWATLine("i32.const -1");
        }
        break;
      case "MemberAccessExpression": {
        if (expr.member === "len") {
          this.emitExpressionWAT(expr.object);
          this.emitWATLine("i32.load");
        } else {
          const objectType = this.inferExpressionType(expr.object);
          const baseType = this.getBaseType(objectType);
          if (baseType && this.structDefinitions.has(baseType)) {
            const offset = this.getStructFieldOffset(baseType, expr.member);
            this.emitExpressionWAT(expr.object);
            this.emitWATLine(`i32.const ${offset}`);
            this.emitWATLine("i32.add");
            this.emitWATLine("i32.load");
          } else if (objectType && objectType.startsWith("(")) {
            const index = parseInt(expr.member);
            if (isNaN(index)) {
              this.throwError(`Invalid tuple index: ${expr.member}`, expr);
            }
            this.emitExpressionWAT(expr.object);
            this.emitWATLine(`i32.const ${index * 4}`);
            this.emitWATLine("i32.add");
            this.emitWATLine("i32.load");
          } else {
            this.throwError(`Unsupported member: ${expr.member}`, expr);
          }
        }
        break;
      }
      case "IndexExpression": {
        this.emitExpressionWAT(expr.object);
        if (expr.index.type === "RangeExpression") {
          const range = expr.index;
          const objectType = this.inferExpressionType(expr.object);
          const elementSize =
            this.isArrayLikeType(objectType) &&
            !this.isByteLikeType(objectType) &&
            !this.isStringLikeType(objectType)
              ? 4
              : 1;
          const startLocal = `range_start_${++this.localCounter}`;
          const endLocal = `range_end_${++this.localCounter}`;
          const objLocal = `obj_ptr_${++this.localCounter}`;
          this.allLocals.add(startLocal);
          this.allLocals.add(endLocal);
          this.allLocals.add(objLocal);

          this.emitWATLine(`local.set $${objLocal}`);
          this.emitExpressionWAT(range);
          this.emitWATLine(`local.set $${endLocal}`);
          this.emitWATLine(`local.set $${startLocal}`);

          this.emitWATLine(`local.get $${endLocal}`);
          this.emitWATLine("i32.const -1");
          this.emitWATLine("i32.eq");
          this.emitWATLine("if");
          this.emitWATLine(`local.get $${objLocal}`);
          this.emitWATLine("i32.load");
          this.emitWATLine(`local.set $${endLocal}`);
          this.emitWATLine("end");

          this.emitWATLine("global.get $heap_ptr");
          this.emitWATLine(`local.get $${endLocal}`);
          this.emitWATLine(`local.get $${startLocal}`);
          this.emitWATLine("i32.sub");
          this.emitWATLine("i32.store");

          this.emitWATLine("global.get $heap_ptr");
          this.emitWATLine("i32.const 4");
          this.emitWATLine("i32.add");
          this.emitWATLine(`local.get $${objLocal}`);
          this.emitWATLine("i32.const 4");
          this.emitWATLine("i32.add");
          this.emitWATLine(`local.get $${startLocal}`);
          if (elementSize !== 1) {
            this.emitWATLine(`i32.const ${elementSize}`);
            this.emitWATLine("i32.mul");
          }
          this.emitWATLine("i32.add");
          this.emitWATLine(`local.get $${endLocal}`);
          this.emitWATLine(`local.get $${startLocal}`);
          this.emitWATLine("i32.sub");
          if (elementSize !== 1) {
            this.emitWATLine(`i32.const ${elementSize}`);
            this.emitWATLine("i32.mul");
          }
          this.emitWATLine("memory.copy");

          this.emitWATLine("global.get $heap_ptr");
          this.emitWATLine("global.get $heap_ptr");
          this.emitWATLine("i32.const 4");
          this.emitWATLine("i32.add");
          this.emitWATLine(`local.get $${endLocal}`);
          this.emitWATLine(`local.get $${startLocal}`);
          this.emitWATLine("i32.sub");
          if (elementSize !== 1) {
            this.emitWATLine(`i32.const ${elementSize}`);
            this.emitWATLine("i32.mul");
          }
          this.emitWATLine("i32.add");
          this.emitWATLine("global.set $heap_ptr");
        } else {
          const objectType = this.inferExpressionType(expr.object);
          const isI32Array =
            this.isArrayLikeType(objectType) &&
            !this.isByteLikeType(objectType) &&
            !this.isStringLikeType(objectType);
          this.emitExpressionWAT(expr.index);
          this.emitWATLine(`call $${isI32Array ? "get_item_i32" : "get_item"}`);
        }
        break;
      }
      case "CallExpression":
        if (
          expr.callee === "as_bytes" ||
          expr.callee === "iter" ||
          expr.callee === "enumerate"
        ) {
          this.emitExpressionWAT(expr.args[0]);
          break;
        }
        if (expr.callee === "String::from") {
          this.emitExpressionWAT(expr.args[0]);
          break;
        }
        if (expr.callee === "len") {
          this.emitExpressionWAT(expr.args[0]);
          this.emitWATLine("i32.load");
          break;
        }
        if (expr.callee === "clear") {
          if (expr.args[0]?.type === "Identifier") {
            const info = this.resolveVariable(expr.args[0].name);
            if (!info) {
              this.throwError(
                `Undefined variable: ${expr.args[0].name}`,
                expr.args[0],
              );
            }
            if (info.isBorrowedMut || info.borrowCount > 0) {
              this.throwError(
                `Cannot use '${expr.args[0].name}' while it is mutably borrowed`,
                expr.args[0],
              );
            }
            if (!info.isMutable) {
              this.throwError(
                `Cannot borrow '${expr.args[0].name}' as mutable: it is not declared as mutable`,
                expr.args[0],
              );
            }
          }
          this.emitExpressionWAT(expr.args[0]);
          this.emitWATLine("i32.const 0");
          this.emitWATLine("i32.store");
          this.emitWATLine("i32.const 0");
          break;
        }
        const retainBorrow = this.isStringLikeType(
          this.functionReturnTypes.get(expr.callee),
        );

        let callee = expr.callee;
        if (!this.functionIndices.has(callee) && expr.args.length > 0) {
          const type = this.inferExpressionType(expr.args[0]);
          const baseType = this.getBaseType(type);
          if (baseType) {
            const mangled = `${baseType}::${callee}`;
            if (this.functionIndices.has(mangled)) {
              callee = mangled;
            }
          }
        }

        for (const arg of expr.args) {
          this.emitCallArgumentWAT(arg, retainBorrow);
        }
        this.emitWATLine(`call $${callee}`);
        break;
      case "Identifier": {
        const info = this.resolveVariable(expr.name);
        if (info) {
          if (info.isBorrowedMut) {
            this.throwError(
              `Cannot use '${expr.name}' while it is mutably borrowed`,
              expr,
            );
          }
          this.emitWATLine(`local.get $${info.uniqueName}`);
        } else {
          const struct = this.structDefinitions.get(expr.name);
          if (struct && struct.type === "UnitStructDeclaration") {
            this.emitWATLine("i32.const 0");
          } else {
            this.throwError(`Undefined variable: ${expr.name}`, expr);
          }
        }
        break;
      }
      case "BorrowExpression":
        if (expr.argument.type === "Identifier") {
          const info = this.resolveVariable(expr.argument.name);
          if (!info) {
            this.throwError(
              `Undefined variable: ${expr.argument.name}`,
              expr.argument,
            );
          }
          if (expr.isMutable) {
            if (info.isBorrowedMut || info.borrowCount > 0) {
              this.throwError(
                `Cannot borrow '${expr.argument.name}' as mutable: already borrowed`,
                expr,
              );
            }
            if (!info.isMutable) {
              this.throwError(
                `Cannot borrow '${expr.argument.name}' as mutable: it is not declared as mutable`,
                expr,
              );
            }
            info.isBorrowedMut = true;
            this.scopeStack[this.scopeStack.length - 1].borrows.push({
              info,
              isMut: true,
            });
          } else {
            if (info.isBorrowedMut) {
              this.throwError(
                `Cannot borrow '${expr.argument.name}' as immutable: already borrowed as mutable`,
                expr,
              );
            }
            info.borrowCount++;
            this.scopeStack[this.scopeStack.length - 1].borrows.push({
              info,
              isMut: false,
            });
          }
          this.emitWATLine(`local.get $${info.uniqueName}`);
        } else if (expr.argument.type === "IndexExpression") {
          this.emitExpressionWAT(expr.argument);
        } else {
          this.throwError(
            "Can only borrow identifiers or index expressions",
            expr,
          );
        }
        break;
      case "UnaryExpression":
        if (expr.operator === "-") {
          this.emitWATLine("i32.const 0");
          this.emitExpressionWAT(expr.argument);
          this.emitWATLine("i32.sub");
        } else if (expr.operator === "!") {
          this.emitExpressionWAT(expr.argument);
          this.emitWATLine("i32.eqz");
        } else {
          this.throwError(`Unsupported unary operator: ${expr.operator}`, expr);
        }
        break;
      case "BinaryExpression":
        if (expr.operator === "=") {
          if (expr.left.type === "Identifier") {
            const info = this.resolveVariable(expr.left.name);
            if (!info) {
              this.throwError(
                `Undefined variable: ${expr.left.name}`,
                expr.left,
              );
            }
            if (!info.isMutable) {
              this.throwError(
                `Cannot assign to immutable variable: ${expr.left.name}`,
                expr.left,
              );
            }
            this.emitExpressionWAT(expr.right);
            this.emitWATLine(`local.tee $${info.uniqueName}`);
          } else if (expr.left.type === "MemberAccessExpression") {
            const memberExpr = expr.left;
            const objectType = this.inferExpressionType(memberExpr.object);
            const baseType = this.getBaseType(objectType);
            if (baseType && this.structDefinitions.has(baseType)) {
              const offset = this.getStructFieldOffset(
                baseType,
                memberExpr.member,
              );
              this.emitExpressionWAT(memberExpr.object);
              this.emitWATLine(`i32.const ${offset}`);
              this.emitWATLine("i32.add");
              this.emitExpressionWAT(expr.right);
              this.emitWATLine("i32.store");
              // Assignment expression returns the value
              this.emitExpressionWAT(expr.right);
            } else if (objectType && objectType.startsWith("(")) {
              const index = parseInt(memberExpr.member);
              if (isNaN(index)) {
                this.throwError(
                  `Invalid tuple index: ${memberExpr.member}`,
                  memberExpr,
                );
              }
              this.emitExpressionWAT(memberExpr.object);
              this.emitWATLine(`i32.const ${index * 4}`);
              this.emitWATLine("i32.add");
              this.emitExpressionWAT(expr.right);
              this.emitWATLine("i32.store");
              this.emitExpressionWAT(expr.right);
            } else {
              this.throwError("Invalid l-value", expr.left);
            }
          } else {
            this.throwError("Invalid l-value", expr.left);
          }
          break;
        }

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
          case "==":
            this.emitWATLine("i32.eq");
            break;
          case "!=":
            this.emitWATLine("i32.ne");
            break;
          case "<":
            this.emitWATLine("i32.lt_s");
            break;
          case ">":
            this.emitWATLine("i32.gt_s");
            break;
          case "<=":
            this.emitWATLine("i32.le_s");
            break;
          case ">=":
            this.emitWATLine("i32.ge_s");
            break;
        }
        break;
      case "MacroInvocation":
        if (expr.name === "print" || expr.name === "println") {
          const formatArg = expr.args[0];
          if (
            formatArg &&
            formatArg.type === "Literal" &&
            formatArg.rawType === "string"
          ) {
            const formatStr = formatArg.value as string;
            let argIndex = 1;
            let lastPos = 0;
            const regex = /\{([a-zA-Z0-9_]*)\}/g;
            let match;

            while ((match = regex.exec(formatStr)) !== null) {
              const textBefore = formatStr.substring(lastPos, match.index);
              if (textBefore) {
                this.emitStringPrintWAT(textBefore);
              }

              const varName = match[1];
              if (varName) {
                // {varName}
                const info = this.resolveVariable(varName);
                if (!info) {
                  this.throwError(`Undefined variable: ${varName}`, expr);
                }
                this.emitPrintCallForVariable(info);
                this.emitWATLine("drop");
              } else {
                // {}
                if (argIndex < expr.args.length) {
                  const arg = expr.args[argIndex++];
                  this.emitPrintCallForExpressionWAT(arg);
                  this.emitWATLine("drop");
                } else {
                  this.throwError(
                    "Not enough arguments for format string",
                    expr,
                  );
                }
              }
              lastPos = regex.lastIndex;
            }

            const textAfter = formatStr.substring(lastPos);
            if (textAfter) {
              this.emitStringPrintWAT(textAfter);
            }

            if (expr.name === "println") {
              this.emitStringPrintWAT("\n");
            }

            this.emitWATLine("i32.const 0"); // Result of macro
          } else if (formatArg) {
            this.emitPrintCallForExpressionWAT(formatArg);
            this.emitWATLine("drop");
            if (expr.name === "println") {
              this.emitStringPrintWAT("\n");
            }
            this.emitWATLine("i32.const 0");
          } else {
            this.emitWATLine("i32.const 0");
          }
        } else if (expr.name === "panic") {
          this.emitExpressionWAT(
            expr.args[0] ?? { type: "Literal", value: 0, rawType: "integer" },
          );
          this.emitWATLine("call $panic");
          this.emitWATLine("unreachable");
        } else if (expr.name === "alloc") {
          const sizeExpr = expr.args[0];
          if (!sizeExpr) {
            this.throwError("alloc! expects exactly one argument", expr);
          }
          this.emitWATLine("global.get $heap_ptr");
          this.emitWATLine("global.get $heap_ptr");
          this.emitExpressionWAT(sizeExpr);
          this.emitWATLine("i32.add");
          this.emitWATLine("global.set $heap_ptr");
        }
        break;
    }
  }

  private emitWATLine(line: string) {
    this.outputWAT.push("  ".repeat(this.indent) + line);
  }

  private emitStringPrintWAT(str: string) {
    if (!this.stringConstants.has(str)) {
      this.stringConstants.set(str, this.stringOffset);
      this.stringOffset += 4 + new TextEncoder().encode(str).length;
    }
    const offset = this.stringConstants.get(str)!;
    this.emitWATLine(`i32.const ${offset}`);
    this.emitWATLine("call $print_str");
    this.emitWATLine("drop");
  }

  private emitForPatternWAT(
    pattern: any, // Pattern type
    iterLocal: string,
    objLocal: string,
  ) {
    if (pattern.type === "TuplePattern") {
      // (i, &item)
      // i is the index (iterLocal)
      // item binds to the current element value (the `&` pattern is ignored here)
      if (pattern.elements.length === 2) {
        // Element 0: i
        const iPattern = pattern.elements[0];
        if (iPattern.type === "IdentifierPattern") {
          const uniqueName = `${iPattern.name}_${++this.localCounter}`;
          this.allLocals.add(uniqueName);
          this.scopeStack[this.scopeStack.length - 1].vars.set(iPattern.name, {
            uniqueName,
            isMutable: false,
            isBorrowedMut: false,
            borrowCount: 0,
          });
          this.emitWATLine(`local.get $${iterLocal}`);
          this.emitWATLine(`local.set $${uniqueName}`);
        }

        // Element 1: &item
        const itemPattern = pattern.elements[1];
        this.emitPatternWAT(itemPattern, iterLocal, objLocal);
      }
    } else {
      this.emitPatternWAT(pattern, iterLocal, objLocal);
    }
  }

  private emitPatternWAT(pattern: any, iterLocal: string, objLocal: string) {
    if (pattern.type === "ReferencePattern") {
      this.emitPatternWAT(pattern.pattern, iterLocal, objLocal);
    } else if (pattern.type === "IdentifierPattern") {
      const uniqueName = `${pattern.name}_${++this.localCounter}`;
      this.allLocals.add(uniqueName);
      this.scopeStack[this.scopeStack.length - 1].vars.set(pattern.name, {
        uniqueName,
        isMutable: false,
        isBorrowedMut: false,
        borrowCount: 0,
      });
      // Load value from objLocal + 4 + iterLocal
      this.emitWATLine(`local.get $${objLocal}`);
      this.emitWATLine("i32.const 4");
      this.emitWATLine("i32.add");
      this.emitWATLine(`local.get $${iterLocal}`);
      this.emitWATLine("i32.add");
      this.emitWATLine("i32.load8_u");
      this.emitWATLine(`local.set $${uniqueName}`);
    }
  }

  emitWASM(): Uint8Array {
    this.stringConstants.clear();
    this.stringOffset = 0;
    const userFunctions = this.prepareFunctionMetadata();

    const typeSection = this.encodeSection(
      SECTION_TYPE,
      this.encodeVector([
        [TYPE_FUNC, 1, TYPE_I32, 1, TYPE_I32], // type 0: (i32) -> i32  — imports
        [TYPE_FUNC, 2, TYPE_I32, TYPE_I32, 1, TYPE_I32], // type 1: (i32, i32) -> i32  — get_item, get_item_i32
        [TYPE_FUNC, 3, TYPE_I32, TYPE_I32, TYPE_I32, 1, TYPE_I32], // type 2: (i32, i32, i32) -> i32  — set_item, set_item_i32
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
          ...this.encodeString("print_str"),
          0x00,
          0x00,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("panic"),
          0x00,
          0x00,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("get_item"),
          0x00,
          0x01,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("get_item_i32"),
          0x00,
          0x01,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("set_item"),
          0x00,
          0x02,
        ],
        [
          ...this.encodeString("env"),
          ...this.encodeString("set_item_i32"),
          0x00,
          0x02,
        ],
      ]),
    );

    const funcSection = this.encodeSection(
      SECTION_FUNCTION,
      this.encodeVector([
        ...userFunctions.map((_, i) => [i + 3]), // user functions -> types 3+
      ]),
    );

    const memSection = this.encodeSection(
      SECTION_MEMORY,
      this.encodeVector([[0x00, 0x01]]),
    );

    const functionBodies = userFunctions.map((fn) =>
      this.emitFunctionBinary(fn),
    );
    const initialHeapPtr = Math.max(HEAP_BASE, this.stringOffset);

    const globalSection = this.encodeSection(
      0x06,
      this.encodeVector([
        [
          TYPE_I32,
          0x01,
          OP_I32_CONST,
          ...this.encodeSignedLEB128(initialHeapPtr),
          OP_END,
        ],
      ]),
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
      this.encodeVector(functionBodies),
    );

    // Data section
    const dataEntries: number[][] = [];
    for (const [str, offset] of this.stringConstants.entries()) {
      const bytes = Array.from(new TextEncoder().encode(str));
      const len = bytes.length;
      const lenBytes = [
        len & 0xff,
        (len >> 8) & 0xff,
        (len >> 16) & 0xff,
        (len >> 24) & 0xff,
      ];
      dataEntries.push([
        0x00, // active memory 0
        OP_I32_CONST,
        ...this.encodeSignedLEB128(offset),
        OP_END,
        ...this.encodeUnsignedLEB128(lenBytes.length + bytes.length),
        ...lenBytes,
        ...bytes,
      ]);
    }
    const dataSection =
      dataEntries.length > 0
        ? this.encodeSection(0x0b, this.encodeVector(dataEntries))
        : [];

    const magic = [0x00, 0x61, 0x73, 0x6d];
    const version = [0x01, 0x00, 0x00, 0x00];

    return new Uint8Array([
      ...magic,
      ...version,
      ...typeSection,
      ...importSection,
      ...funcSection,
      ...memSection,
      ...globalSection,
      ...exportSection,
      ...codeSection,
      ...dataSection,
    ]);
  }

  private currentFunctionName: string | undefined;

  private emitFunctionBinary(fn: FunctionDeclaration): number[] {
    this.currentFunctionName = fn.name;
    this.localCounter = 0;
    this.currentBlockDepth = 0;
    this.allLocals.clear();
    this.locals.clear();
    this.scopeStack = [
      {
        vars: new Map(),
        borrows: [],
        heapBackupName: "",
      },
    ];
    fn.params.forEach((p, i) => {
      this.scopeStack[0].vars.set(p.name, {
        uniqueName: p.name,
        isMutable: false,
        isBorrowedMut: false,
        borrowCount: 0,
        valueType: this.normalizeType(p.type),
      });
      this.locals.set(p.name, i);
    });

    const body: number[] = [];
    this.emitBlockBinary(fn.body, body);
    body.push(OP_END);

    const localList = Array.from(this.allLocals);
    const localMap = new Map<string, number>();
    localList.forEach((name, i) => localMap.set(name, fn.params.length + i));

    const finalBody: number[] = [];
    for (let i = 0; i < body.length; i++) {
      if (body[i] === 0xfe) {
        const name = (body as any)[i + 1];
        const idx = localMap.has(name)
          ? localMap.get(name)!
          : this.locals.get(name)!;
        finalBody.push(...this.encodeUnsignedLEB128(idx));
        i++;
      } else {
        finalBody.push(body[i]);
      }
    }

    const localDecls =
      localList.length > 0 ? [[localList.length, TYPE_I32]] : [];
    const localBytes = this.encodeVector(
      localDecls.map((d) => [...this.encodeUnsignedLEB128(d[0]), d[1]]),
    );
    return [
      ...this.encodeUnsignedLEB128(localBytes.length + finalBody.length),
      ...localBytes,
      ...finalBody,
    ];
  }

  private emitBlockBinary(block: BlockStatement, body: number[]) {
    const heapBackupName = `old_heap_ptr_${++this.localCounter}`;
    this.allLocals.add(heapBackupName);

    body.push(...OP_GLOBAL_GET);
    body.push(OP_LOCAL_SET, 0xfe, heapBackupName as any);

    this.scopeStack.push({
      vars: new Map(),
      borrows: [],
      heapBackupName,
    });

    for (const stmt of block.body) {
      if (stmt.type === "LetStatement") {
        this.emitExpressionBinary(stmt.initializer, body);
        const uniqueName = `${stmt.name}_${++this.localCounter}`;
        this.allLocals.add(uniqueName);
        const info: VariableInfo = {
          uniqueName,
          isMutable: stmt.isMutable,
          isBorrowedMut: false,
          borrowCount: 0,
          valueType: this.inferExpressionType(stmt.initializer),
        };
        this.scopeStack[this.scopeStack.length - 1].vars.set(stmt.name, info);
        body.push(OP_LOCAL_SET, 0xfe, uniqueName as any);
      } else if (stmt.type === "ConstStatement") {
        this.emitExpressionBinary(stmt.initializer, body);
        const uniqueName = `${stmt.name}_${++this.localCounter}`;
        this.allLocals.add(uniqueName);
        const info: VariableInfo = {
          uniqueName,
          isMutable: false,
          isBorrowedMut: false,
          borrowCount: 0,
          valueType: this.inferExpressionType(stmt.initializer),
        };
        this.scopeStack[this.scopeStack.length - 1].vars.set(stmt.name, info);
        body.push(OP_LOCAL_SET, 0xfe, uniqueName as any);
      } else if (stmt.type === "IfStatement") {
        this.emitExpressionBinary(stmt.condition, body);
        this.currentBlockDepth++;
        body.push(OP_IF, TYPE_I32);
        this.emitBlockBinary(stmt.thenBranch, body);
        if (stmt.elseBranch) {
          body.push(OP_ELSE);
          if (stmt.elseBranch.type === "BlockStatement") {
            this.emitBlockBinary(stmt.elseBranch, body);
          } else {
            this.emitBlockBinary(
              { type: "BlockStatement", body: [stmt.elseBranch] },
              body,
            );
          }
        } else {
          body.push(OP_ELSE, OP_I32_CONST, 0);
        }
        this.currentBlockDepth--;
        body.push(OP_END, OP_DROP);
      } else if (stmt.type === "LoopStatement") {
        this.currentBlockDepth++;
        body.push(OP_BLOCK, TYPE_I32);
        this.currentBlockDepth++;
        body.push(OP_LOOP, TYPE_I32);
        this.loopStack.push({
          breakDepth: this.currentBlockDepth - 1,
          continueDepth: this.currentBlockDepth,
        });
        this.emitBlockBinary(stmt.body, body);
        body.push(OP_DROP);
        body.push(OP_I32_CONST, 0); // Loop fallthrough value
        body.push(OP_BR, ...this.encodeUnsignedLEB128(0));
        body.push(OP_END);
        this.currentBlockDepth--;
        body.push(OP_END);
        this.currentBlockDepth--;
        this.loopStack.pop();
        body.push(OP_DROP);
      } else if (stmt.type === "WhileStatement") {
        this.currentBlockDepth++;
        body.push(OP_BLOCK, TYPE_I32);
        this.currentBlockDepth++;
        body.push(OP_LOOP, TYPE_I32);
        this.loopStack.push({
          breakDepth: this.currentBlockDepth - 1,
          continueDepth: this.currentBlockDepth,
        });
        // Condition check: if NOT condition, break out
        this.emitExpressionBinary(stmt.condition, body);
        body.push(OP_I32_EQZ);
        this.currentBlockDepth++;
        body.push(OP_IF, 0x40); // void if block
        const wbLoop = this.loopStack[this.loopStack.length - 1];
        const wbBreakLevels = this.currentBlockDepth - wbLoop.breakDepth;
        body.push(OP_I32_CONST, 0);
        body.push(OP_BR, ...this.encodeUnsignedLEB128(wbBreakLevels));
        this.currentBlockDepth--;
        body.push(OP_END);
        this.emitBlockBinary(stmt.body, body);
        body.push(OP_DROP);
        body.push(OP_I32_CONST, 0);
        body.push(OP_BR, ...this.encodeUnsignedLEB128(0));
        body.push(OP_END);
        this.currentBlockDepth--;
        body.push(OP_END);
        this.currentBlockDepth--;
        this.loopStack.pop();
        body.push(OP_DROP);
      } else if (stmt.type === "ForStatement") {
        const iterLocal = `iter_idx_${++this.localCounter}`;
        const objLocal = `iter_obj_${++this.localCounter}`;
        const lenLocal = `iter_len_${++this.localCounter}`;
        this.allLocals.add(iterLocal);
        this.allLocals.add(objLocal);
        this.allLocals.add(lenLocal);

        const iterableTypeBin = this.inferExpressionType(stmt.iterable);
        if (
          !this.isByteLikeType(iterableTypeBin) &&
          !this.isStringLikeType(iterableTypeBin)
        ) {
          this.throwError(
            "for-in currently only supports iterating over byte sequences (e.g., s.as_bytes())",
            stmt,
          );
        }

        this.emitExpressionBinary(stmt.iterable, body);
        body.push(OP_LOCAL_SET, 0xfe, objLocal as any);
        body.push(OP_LOCAL_GET, 0xfe, objLocal as any);
        body.push(...OP_I32_LOAD);
        body.push(OP_LOCAL_SET, 0xfe, lenLocal as any);
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(0));
        body.push(OP_LOCAL_SET, 0xfe, iterLocal as any);

        this.currentBlockDepth++;
        body.push(OP_BLOCK, TYPE_I32);
        this.currentBlockDepth++;
        body.push(OP_LOOP, TYPE_I32);
        this.loopStack.push({
          breakDepth: this.currentBlockDepth - 1,
          continueDepth: this.currentBlockDepth,
        });

        body.push(OP_LOCAL_GET, 0xfe, iterLocal as any);
        body.push(OP_LOCAL_GET, 0xfe, lenLocal as any);
        body.push(OP_I32_GE_S);
        this.currentBlockDepth++;
        body.push(OP_IF, 0x40);
        const fbLoop = this.loopStack[this.loopStack.length - 1];
        body.push(OP_I32_CONST, 0);
        body.push(
          OP_BR,
          ...this.encodeUnsignedLEB128(
            this.currentBlockDepth - fbLoop.breakDepth,
          ),
        );
        this.currentBlockDepth--;
        body.push(OP_END);

        this.emitForPatternBinary(stmt.pattern, iterLocal, objLocal, body);

        this.emitBlockBinary(stmt.body, body);
        body.push(OP_DROP);

        body.push(OP_LOCAL_GET, 0xfe, iterLocal as any);
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(1));
        body.push(OP_I32_ADD);
        body.push(OP_LOCAL_SET, 0xfe, iterLocal as any);

        body.push(OP_I32_CONST, 0);
        body.push(OP_BR, ...this.encodeUnsignedLEB128(0));
        body.push(OP_END);
        this.currentBlockDepth--;
        body.push(OP_END);
        this.currentBlockDepth--;
        this.loopStack.pop();
        body.push(OP_DROP);
      } else if (stmt.type === "BreakStatement") {
        if (this.loopStack.length === 0)
          this.throwError("'break' outside of loop", stmt);
        const loop = this.loopStack[this.loopStack.length - 1];
        const levels = this.currentBlockDepth - loop.breakDepth;
        body.push(OP_I32_CONST, 0);
        body.push(OP_BR, ...this.encodeUnsignedLEB128(levels));
      } else if (stmt.type === "ContinueStatement") {
        if (this.loopStack.length === 0)
          this.throwError("'continue' outside of loop", stmt);
        const loop = this.loopStack[this.loopStack.length - 1];
        const levels = this.currentBlockDepth - loop.continueDepth;
        body.push(OP_I32_CONST, 0);
        body.push(OP_BR, ...this.encodeUnsignedLEB128(levels));
      } else if (stmt.type === "ReturnStatement") {
        if (stmt.argument) {
          this.emitExpressionBinary(stmt.argument, body);
        } else {
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(0));
        }
        body.push(OP_RETURN);
      } else if (stmt.type === "ExpressionStatement") {
        this.emitExpressionBinary(stmt.expression, body);
        body.push(OP_DROP);
      } else if (stmt.type === "BlockStatement") {
        this.emitBlockBinary(stmt, body);
        body.push(OP_DROP);
      }
    }

    body.push(OP_LOCAL_GET, 0xfe, heapBackupName as any);
    body.push(...OP_GLOBAL_SET);

    if (block.tailExpression) {
      this.emitExpressionBinary(block.tailExpression, body);
    } else {
      body.push(OP_I32_CONST, 0);
    }

    // Release borrows
    const scope = this.scopeStack.pop()!;
    for (const borrow of scope.borrows) {
      if (borrow.isMut) {
        borrow.info.isBorrowedMut = false;
      } else {
        borrow.info.borrowCount--;
      }
    }
  }

  private emitExpressionBinary(expr: Expression, body: number[]) {
    switch (expr.type) {
      case "BlockStatement":
        this.emitBlockBinary(expr, body);
        break;
      case "IfStatement": {
        this.emitExpressionBinary(expr.condition, body);
        this.currentBlockDepth++;
        body.push(OP_IF, TYPE_I32);
        this.emitBlockBinary(expr.thenBranch, body);
        if (expr.elseBranch) {
          body.push(OP_ELSE);
          if (expr.elseBranch.type === "BlockStatement") {
            this.emitBlockBinary(expr.elseBranch, body);
          } else {
            this.emitBlockBinary(
              { type: "BlockStatement", body: [expr.elseBranch] },
              body,
            );
          }
        } else {
          body.push(OP_ELSE, OP_I32_CONST, 0);
        }
        this.currentBlockDepth--;
        body.push(OP_END);
        // no drop - this is an expression
        break;
      }
      case "StructLiteral": {
        let structName = expr.name;
        if (structName === "Self") {
          // Find target struct from the current function's name if it's mangled
          const fnName = Array.from(this.functionIndices.entries()).find(
            ([, idx]) =>
              idx === this.functionIndices.get(this.currentFunctionName || ""),
          )?.[0];
          if (fnName && fnName.includes("::")) {
            structName = fnName.split("::")[0];
          }
        }
        const size = this.getStructSize(structName);
        const ptrLocal = `struct_ptr_${++this.localCounter}`;
        this.allLocals.add(ptrLocal);

        // Allocate memory
        body.push(...OP_GLOBAL_GET);
        body.push(OP_LOCAL_SET, 0xfe, ptrLocal as any);

        // Update heap_ptr
        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        body.push(OP_I32_CONST, ...this.encodeSignedLEB128(size));
        body.push(OP_I32_ADD);
        body.push(...OP_GLOBAL_SET);

        // If update base exists, copy fields first
        if (expr.base) {
          this.emitExpressionBinary(expr.base, body);
          const basePtrLocal = `base_ptr_${++this.localCounter}`;
          this.allLocals.add(basePtrLocal);
          body.push(OP_LOCAL_SET, 0xfe, basePtrLocal as any);

          for (let i = 0; i < size; i += 4) {
            body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(i));
            body.push(OP_I32_ADD);

            body.push(OP_LOCAL_GET, 0xfe, basePtrLocal as any);
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(i));
            body.push(OP_I32_ADD);
            body.push(...OP_I32_LOAD);

            body.push(...OP_I32_STORE);
          }
        }

        // Initialize fields
        expr.fields.forEach((field) => {
          const offset = this.getStructFieldOffset(structName, field.name);
          body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(offset));
          body.push(OP_I32_ADD);
          this.emitExpressionBinary(field.value, body);
          body.push(...OP_I32_STORE);
        });

        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        break;
      }
      case "ArrayLiteral": {
        const ptrLocal = `array_ptr_${++this.localCounter}`;
        this.allLocals.add(ptrLocal);
        body.push(...OP_GLOBAL_GET);
        body.push(OP_LOCAL_SET, 0xfe, ptrLocal as any);

        // Store length
        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        body.push(
          OP_I32_CONST,
          ...this.encodeSignedLEB128(expr.elements.length),
        );
        body.push(...OP_I32_STORE);

        // Store elements
        expr.elements.forEach((el, i) => {
          body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(4 + i * 4));
          body.push(OP_I32_ADD);
          this.emitExpressionBinary(el, body);
          body.push(...OP_I32_STORE);
        });

        // Update heap_ptr
        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        body.push(
          OP_I32_CONST,
          ...this.encodeSignedLEB128(4 + expr.elements.length * 4),
        );
        body.push(OP_I32_ADD);
        body.push(...OP_GLOBAL_SET);

        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        break;
      }
      case "TupleLiteral": {
        const ptrLocal = `tuple_ptr_${++this.localCounter}`;
        this.allLocals.add(ptrLocal);
        body.push(...OP_GLOBAL_GET);
        body.push(OP_LOCAL_SET, 0xfe, ptrLocal as any);

        // Store elements (no length prefix for tuples, they are fixed size)
        expr.elements.forEach((el, i) => {
          body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(i * 4));
          body.push(OP_I32_ADD);
          this.emitExpressionBinary(el, body);
          body.push(...OP_I32_STORE);
        });

        // Update heap_ptr
        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        body.push(
          OP_I32_CONST,
          ...this.encodeSignedLEB128(expr.elements.length * 4),
        );
        body.push(OP_I32_ADD);
        body.push(...OP_GLOBAL_SET);

        body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
        break;
      }
      case "Literal": {
        if (expr.rawType === "string") {
          const strValue = expr.value as string;
          if (!this.stringConstants.has(strValue)) {
            this.stringConstants.set(strValue, this.stringOffset);
            this.stringOffset += 4 + new TextEncoder().encode(strValue).length;
          }
          const offset = this.stringConstants.get(strValue)!;
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(offset));
        } else if (expr.rawType === "byte") {
          body.push(
            OP_I32_CONST,
            ...this.encodeSignedLEB128(Number(expr.value)),
          );
        } else {
          body.push(
            OP_I32_CONST,
            ...this.encodeSignedLEB128(Number(expr.value)),
          );
        }
        break;
      }
      case "RangeExpression":
        if (expr.start) {
          this.emitExpressionBinary(expr.start, body);
        } else {
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(0));
        }
        if (expr.end) {
          this.emitExpressionBinary(expr.end, body);
        } else {
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(-1));
        }
        break;
      case "MemberAccessExpression": {
        if (expr.member === "len") {
          this.emitExpressionBinary(expr.object, body);
          body.push(...OP_I32_LOAD);
        } else {
          const objectType = this.inferExpressionType(expr.object);
          const baseType = this.getBaseType(objectType);
          if (baseType && this.structDefinitions.has(baseType)) {
            const offset = this.getStructFieldOffset(baseType, expr.member);
            this.emitExpressionBinary(expr.object, body);
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(offset));
            body.push(OP_I32_ADD);
            body.push(...OP_I32_LOAD);
          } else if (objectType && objectType.startsWith("(")) {
            const index = parseInt(expr.member);
            if (isNaN(index)) {
              this.throwError(`Invalid tuple index: ${expr.member}`, expr);
            }
            this.emitExpressionBinary(expr.object, body);
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(index * 4));
            body.push(OP_I32_ADD);
            body.push(...OP_I32_LOAD);
          } else {
            this.throwError(`Unsupported member: ${expr.member}`, expr);
          }
        }
        break;
      }
      case "IndexExpression": {
        this.emitExpressionBinary(expr.object, body);
        if (expr.index.type === "RangeExpression") {
          const range = expr.index;
          const objectType = this.inferExpressionType(expr.object);
          const elementSize =
            this.isArrayLikeType(objectType) &&
            !this.isByteLikeType(objectType) &&
            !this.isStringLikeType(objectType)
              ? 4
              : 1;
          const startLocal = `range_start_${++this.localCounter}`;
          const endLocal = `range_end_${++this.localCounter}`;
          const objLocal = `obj_ptr_${++this.localCounter}`;
          this.allLocals.add(startLocal);
          this.allLocals.add(endLocal);
          this.allLocals.add(objLocal);

          body.push(OP_LOCAL_SET, 0xfe, objLocal as any);
          this.emitExpressionBinary(range, body);
          body.push(OP_LOCAL_SET, 0xfe, endLocal as any);
          body.push(OP_LOCAL_SET, 0xfe, startLocal as any);

          body.push(OP_LOCAL_GET, 0xfe, endLocal as any);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(-1));
          body.push(OP_I32_EQ);
          body.push(OP_IF, 0x40);
          body.push(OP_LOCAL_GET, 0xfe, objLocal as any);
          body.push(...OP_I32_LOAD);
          body.push(OP_LOCAL_SET, 0xfe, endLocal as any);
          body.push(OP_END);

          body.push(...OP_GLOBAL_GET);
          body.push(OP_LOCAL_GET, 0xfe, endLocal as any);
          body.push(OP_LOCAL_GET, 0xfe, startLocal as any);
          body.push(OP_I32_SUB);
          body.push(...OP_I32_STORE);

          body.push(...OP_GLOBAL_GET);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(4));
          body.push(OP_I32_ADD);
          body.push(OP_LOCAL_GET, 0xfe, objLocal as any);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(4));
          body.push(OP_I32_ADD);
          body.push(OP_LOCAL_GET, 0xfe, startLocal as any);
          if (elementSize !== 1) {
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(elementSize));
            body.push(OP_I32_MUL);
          }
          body.push(OP_I32_ADD);
          body.push(OP_LOCAL_GET, 0xfe, endLocal as any);
          body.push(OP_LOCAL_GET, 0xfe, startLocal as any);
          body.push(OP_I32_SUB);
          if (elementSize !== 1) {
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(elementSize));
            body.push(OP_I32_MUL);
          }
          body.push(...OP_MEMORY_COPY);

          body.push(...OP_GLOBAL_GET);
          body.push(...OP_GLOBAL_GET);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(4));
          body.push(OP_I32_ADD);
          body.push(OP_LOCAL_GET, 0xfe, endLocal as any);
          body.push(OP_LOCAL_GET, 0xfe, startLocal as any);
          body.push(OP_I32_SUB);
          if (elementSize !== 1) {
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(elementSize));
            body.push(OP_I32_MUL);
          }
          body.push(OP_I32_ADD);
          body.push(...OP_GLOBAL_SET);
        } else {
          const objectType = this.inferExpressionType(expr.object);
          const isI32Array =
            this.isArrayLikeType(objectType) &&
            !this.isByteLikeType(objectType) &&
            !this.isStringLikeType(objectType);
          this.emitExpressionBinary(expr.index, body);
          body.push(
            OP_CALL,
            ...this.encodeUnsignedLEB128(
              this.functionIndices.get(
                isI32Array ? "get_item_i32" : "get_item",
              )!,
            ),
          );
        }
        break;
      }
      case "Identifier": {
        const info = this.resolveVariable(expr.name);
        if (info) {
          if (info.isBorrowedMut) {
            this.throwError(
              `Cannot use '${expr.name}' while it is mutably borrowed`,
              expr,
            );
          }
          body.push(OP_LOCAL_GET, 0xfe, info.uniqueName as any);
        } else {
          const struct = this.structDefinitions.get(expr.name);
          if (struct && struct.type === "UnitStructDeclaration") {
            body.push(OP_I32_CONST, 0);
          } else {
            this.throwError(`Undefined variable: ${expr.name}`, expr);
          }
        }
        break;
      }
      case "BorrowExpression":
        if (expr.argument.type === "Identifier") {
          const info = this.resolveVariable(expr.argument.name);
          if (!info) {
            this.throwError(
              `Undefined variable: ${expr.argument.name}`,
              expr.argument,
            );
          }
          if (expr.isMutable) {
            if (info.isBorrowedMut || info.borrowCount > 0) {
              this.throwError(
                `Cannot borrow '${expr.argument.name}' as mutable: already borrowed`,
                expr,
              );
            }
            if (!info.isMutable) {
              this.throwError(
                `Cannot borrow '${expr.argument.name}' as mutable: it is not declared as mutable`,
                expr,
              );
            }
            info.isBorrowedMut = true;
            this.scopeStack[this.scopeStack.length - 1].borrows.push({
              info,
              isMut: true,
            });
          } else {
            if (info.isBorrowedMut) {
              this.throwError(
                `Cannot borrow '${expr.argument.name}' as immutable: already borrowed as mutable`,
                expr,
              );
            }
            info.borrowCount++;
            this.scopeStack[this.scopeStack.length - 1].borrows.push({
              info,
              isMut: false,
            });
          }
          body.push(OP_LOCAL_GET, 0xfe, info.uniqueName as any);
        } else if (expr.argument.type === "IndexExpression") {
          this.emitExpressionBinary(expr.argument, body);
        } else {
          this.throwError(
            "Can only borrow identifiers or index expressions",
            expr,
          );
        }
        break;
      case "UnaryExpression":
        if (expr.operator === "-") {
          body.push(OP_I32_CONST, 0);
          this.emitExpressionBinary(expr.argument, body);
          body.push(OP_I32_SUB);
        } else if (expr.operator === "!") {
          this.emitExpressionBinary(expr.argument, body);
          body.push(0x45);
        } else {
          this.throwError(`Unsupported unary operator: ${expr.operator}`, expr);
        }
        break;
      case "BinaryExpression":
        if (expr.operator === "=") {
          if (expr.left.type === "Identifier") {
            const info = this.resolveVariable(expr.left.name);
            if (!info) {
              this.throwError(
                `Undefined variable: ${expr.left.name}`,
                expr.left,
              );
            }
            if (!info.isMutable) {
              this.throwError(
                `Cannot assign to immutable variable: ${expr.left.name}`,
                expr.left,
              );
            }
            this.emitExpressionBinary(expr.right, body);
            body.push(0x22, 0xfe, info.uniqueName as any); // local.tee
          } else if (expr.left.type === "MemberAccessExpression") {
            const memberExpr = expr.left;
            const objectType = this.inferExpressionType(memberExpr.object);
            const baseType = this.getBaseType(objectType);
            if (baseType && this.structDefinitions.has(baseType)) {
              const offset = this.getStructFieldOffset(
                baseType,
                memberExpr.member,
              );
              this.emitExpressionBinary(memberExpr.object, body);
              body.push(OP_I32_CONST, ...this.encodeSignedLEB128(offset));
              body.push(OP_I32_ADD);
              this.emitExpressionBinary(expr.right, body);
              body.push(...OP_I32_STORE);
              // Assignment expression returns the value
              this.emitExpressionBinary(expr.right, body);
            } else if (objectType && objectType.startsWith("(")) {
              const index = parseInt(memberExpr.member);
              if (isNaN(index)) {
                this.throwError(
                  `Invalid tuple index: ${memberExpr.member}`,
                  memberExpr,
                );
              }
              this.emitExpressionBinary(memberExpr.object, body);
              body.push(OP_I32_CONST, ...this.encodeSignedLEB128(index * 4));
              body.push(OP_I32_ADD);
              this.emitExpressionBinary(expr.right, body);
              body.push(...OP_I32_STORE);
              this.emitExpressionBinary(expr.right, body);
            } else {
              this.throwError("Invalid l-value", expr.left);
            }
          } else {
            this.throwError("Invalid l-value", expr.left);
          }
          break;
        }

        if (expr.operator === "&&") {
          this.emitExpressionBinary(expr.left, body);
          body.push(OP_IF, TYPE_I32);
          this.emitExpressionBinary(expr.right, body);
          body.push(OP_ELSE);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(0));
          body.push(OP_END);
          break;
        }

        if (expr.operator === "||") {
          this.emitExpressionBinary(expr.left, body);
          body.push(OP_IF, TYPE_I32);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(1));
          body.push(OP_ELSE);
          this.emitExpressionBinary(expr.right, body);
          body.push(OP_END);
          break;
        }

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
          case "==":
            body.push(OP_I32_EQ);
            break;
          case "!=":
            body.push(OP_I32_NE);
            break;
          case "<":
            body.push(OP_I32_LT_S);
            break;
          case ">":
            body.push(OP_I32_GT_S);
            break;
          case "<=":
            body.push(OP_I32_LE_S);
            break;
          case ">=":
            body.push(OP_I32_GE_S);
            break;
        }
        break;
      case "MacroInvocation":
        if (expr.name === "print" || expr.name === "println") {
          const formatArg = expr.args[0];
          if (
            formatArg &&
            formatArg.type === "Literal" &&
            formatArg.rawType === "string"
          ) {
            const formatStr = formatArg.value as string;
            let argIndex = 1;
            let lastPos = 0;
            const regex = /\{([^}]*)\}/g;
            let match;

            while ((match = regex.exec(formatStr)) !== null) {
              const textBefore = formatStr.substring(lastPos, match.index);
              if (textBefore) {
                this.emitStringPrintBinary(textBefore, body);
              }

              const spec = match[1];
              let varName = "";
              let specifier = "";

              if (spec.startsWith(":")) {
                specifier = spec;
              } else if (spec.includes(":")) {
                const parts = spec.split(":");
                varName = parts[0];
                specifier = ":" + parts[1];
              } else {
                varName = spec;
              }

              if (varName) {
                const info = this.resolveVariable(varName);
                if (!info) {
                  this.throwError(`Undefined variable: ${varName}`, expr);
                }
                const fakeExpr: any = {
                  type: "Identifier",
                  name: varName,
                  token: expr.token,
                };
                this.emitPrintCallForExpression(fakeExpr, body, specifier);
                body.push(OP_DROP);
              } else {
                if (argIndex < expr.args.length) {
                  const arg = expr.args[argIndex++];
                  this.emitPrintCallForExpression(arg, body, specifier);
                  body.push(OP_DROP);
                } else {
                  this.throwError(
                    "Not enough arguments for format string",
                    expr,
                  );
                }
              }
              lastPos = regex.lastIndex;
            }

            const textAfter = formatStr.substring(lastPos);
            if (textAfter) {
              this.emitStringPrintBinary(textAfter, body);
            }

            if (expr.name === "println") {
              this.emitStringPrintBinary("\n", body);
            }

            body.push(OP_I32_CONST, 0);
          } else if (formatArg) {
            this.emitPrintCallForExpression(formatArg, body);
            body.push(OP_DROP);
            if (expr.name === "println") {
              this.emitStringPrintBinary("\n", body);
            }
            body.push(OP_I32_CONST, 0);
          } else {
            body.push(OP_I32_CONST, 0);
          }
        } else if (expr.name === "panic") {
          this.emitExpressionBinary(
            expr.args[0] ?? { type: "Literal", value: 0, rawType: "integer" },
            body,
          );
          body.push(OP_CALL, ...this.encodeUnsignedLEB128(2)); // panic is index 2
          body.push(OP_UNREACHABLE);
        } else if (expr.name === "alloc") {
          const sizeExpr = expr.args[0];
          if (!sizeExpr) {
            this.throwError("alloc! expects exactly one argument", expr);
          }
          body.push(...OP_GLOBAL_GET);
          body.push(...OP_GLOBAL_GET);
          this.emitExpressionBinary(sizeExpr, body);
          body.push(OP_I32_ADD);
          body.push(...OP_GLOBAL_SET);
        } else if (expr.name === "dbg") {
          const arg = expr.args[0];
          if (!arg) {
            this.throwError("dbg! expects an argument", expr);
          }

          const valLocal = `dbg_val_${++this.localCounter}`;
          this.allLocals.add(valLocal);
          this.emitExpressionBinary(arg, body);
          body.push(0x22, 0xfe, valLocal as any); // local.tee
          body.push(OP_DROP); // drop for now while we print

          const line = expr.token?.line || 0;
          this.emitStringPrintBinary(`[line:${line}] `, body);

          const fakeExpr: any = {
            type: "Identifier",
            name: valLocal,
            token: expr.token,
          };
          const currentScope = this.scopeStack[this.scopeStack.length - 1];
          currentScope.vars.set(valLocal, {
            uniqueName: valLocal,
            isMutable: false,
            isBorrowedMut: false,
            borrowCount: 0,
            valueType: this.inferExpressionType(arg),
          });

          this.emitPrintCallForExpression(fakeExpr, body, ":?");
          body.push(OP_DROP);
          this.emitStringPrintBinary("\n", body);
          currentScope.vars.delete(valLocal);

          body.push(OP_LOCAL_GET, 0xfe, valLocal as any);
        }
        break;
      case "CallExpression":
        if (
          expr.callee === "as_bytes" ||
          expr.callee === "iter" ||
          expr.callee === "enumerate"
        ) {
          this.emitExpressionBinary(expr.args[0], body);
          break;
        }
        if (expr.callee === "String::from") {
          this.emitExpressionBinary(expr.args[0], body);
          break;
        }
        if (expr.callee === "len") {
          this.emitExpressionBinary(expr.args[0], body);
          body.push(...OP_I32_LOAD);
          break;
        }
        if (expr.callee === "clear") {
          if (expr.args[0]?.type === "Identifier") {
            const info = this.resolveVariable(expr.args[0].name);
            if (!info) {
              this.throwError(
                `Undefined variable: ${expr.args[0].name}`,
                expr.args[0],
              );
            }
            if (info.isBorrowedMut || info.borrowCount > 0) {
              this.throwError(
                `Cannot use '${expr.args[0].name}' while it is mutably borrowed`,
                expr.args[0],
              );
            }
            if (!info.isMutable) {
              this.throwError(
                `Cannot borrow '${expr.args[0].name}' as mutable: it is not declared as mutable`,
                expr.args[0],
              );
            }
          }
          this.emitExpressionBinary(expr.args[0], body);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(0));
          body.push(...OP_I32_STORE);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(0));
          break;
        }

        const struct = this.structDefinitions.get(expr.callee);
        if (struct && struct.type === "TupleStructDeclaration") {
          const size = this.getStructSize(expr.callee);
          const ptrLocal = `tuple_ptr_${++this.localCounter}`;
          this.allLocals.add(ptrLocal);

          // Allocate memory
          body.push(...OP_GLOBAL_GET);
          body.push(OP_LOCAL_SET, 0xfe, ptrLocal as any);

          // Update heap_ptr
          body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
          body.push(OP_I32_CONST, ...this.encodeSignedLEB128(size));
          body.push(OP_I32_ADD);
          body.push(...OP_GLOBAL_SET);

          // Store args
          expr.args.forEach((arg, i) => {
            body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
            body.push(OP_I32_CONST, ...this.encodeSignedLEB128(i * 4));
            body.push(OP_I32_ADD);
            this.emitExpressionBinary(arg, body);
            body.push(...OP_I32_STORE);
          });

          body.push(OP_LOCAL_GET, 0xfe, ptrLocal as any);
          break;
        }

        const retainBorrow = this.isStringLikeType(
          this.functionReturnTypes.get(expr.callee),
        );

        let callee = expr.callee;
        if (!this.functionIndices.has(callee) && expr.args.length > 0) {
          const type = this.inferExpressionType(expr.args[0]);
          const baseType = this.getBaseType(type);
          if (baseType) {
            const mangled = `${baseType}::${callee}`;
            if (this.functionIndices.has(mangled)) {
              callee = mangled;
            }
          }
        }

        for (const arg of expr.args) {
          this.emitCallArgumentBinary(arg, body, retainBorrow);
        }
        const idx = this.functionIndices.get(callee);
        if (idx === undefined) throw new Error(`Unknown function: ${callee}`);
        body.push(OP_CALL, ...this.encodeUnsignedLEB128(idx));
        break;
    }
  }

  private emitStringPrintBinary(str: string, body: number[]) {
    if (!this.stringConstants.has(str)) {
      this.stringConstants.set(str, this.stringOffset);
      this.stringOffset += 4 + new TextEncoder().encode(str).length;
    }
    const offset = this.stringConstants.get(str)!;
    body.push(OP_I32_CONST, ...this.encodeSignedLEB128(offset));
    body.push(OP_CALL, ...this.encodeUnsignedLEB128(1)); // print_str is index 1
    body.push(OP_DROP);
  }

  private emitForPatternBinary(
    pattern: any,
    iterLocal: string,
    objLocal: string,
    body: number[],
  ) {
    if (pattern.type === "TuplePattern") {
      if (pattern.elements.length === 2) {
        const iPattern = pattern.elements[0];
        if (iPattern.type === "IdentifierPattern") {
          const uniqueName = `${iPattern.name}_${++this.localCounter}`;
          this.allLocals.add(uniqueName);
          this.scopeStack[this.scopeStack.length - 1].vars.set(iPattern.name, {
            uniqueName,
            isMutable: false,
            isBorrowedMut: false,
            borrowCount: 0,
          });
          body.push(OP_LOCAL_GET, 0xfe, iterLocal as any);
          body.push(OP_LOCAL_SET, 0xfe, uniqueName as any);
        }
        const itemPattern = pattern.elements[1];
        this.emitPatternBinary(itemPattern, iterLocal, objLocal, body);
      }
    } else {
      this.emitPatternBinary(pattern, iterLocal, objLocal, body);
    }
  }

  private emitPatternBinary(
    pattern: any,
    iterLocal: string,
    objLocal: string,
    body: number[],
  ) {
    if (pattern.type === "ReferencePattern") {
      this.emitPatternBinary(pattern.pattern, iterLocal, objLocal, body);
    } else if (pattern.type === "IdentifierPattern") {
      const uniqueName = `${pattern.name}_${++this.localCounter}`;
      this.allLocals.add(uniqueName);
      this.scopeStack[this.scopeStack.length - 1].vars.set(pattern.name, {
        uniqueName,
        isMutable: false,
        isBorrowedMut: false,
        borrowCount: 0,
      });
      body.push(OP_LOCAL_GET, 0xfe, objLocal as any);
      body.push(OP_I32_CONST, ...this.encodeSignedLEB128(4));
      body.push(OP_I32_ADD);
      body.push(OP_LOCAL_GET, 0xfe, iterLocal as any);
      body.push(OP_I32_ADD);
      body.push(...OP_I32_LOAD8_U);
      body.push(OP_LOCAL_SET, 0xfe, uniqueName as any);
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
