import { formatError } from "./error.js";
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
const OP_I32_REM_S = 0x6f;
const OP_I32_AND = 0x71;
const OP_I32_OR = 0x72;
const OP_I32_XOR = 0x73;
const OP_I32_SHL = 0x74;
const OP_I32_SHR_S = 0x75;
const OP_UNREACHABLE = 0x00;
export class Emitter {
    program;
    source;
    indent = 0;
    outputWAT = [];
    functionIndices = new Map();
    locals = new Map();
    scopeStack = [];
    allLocals = new Set();
    localCounter = 0;
    constructor(program, source) {
        this.program = program;
        this.source = source;
    }
    throwError(message, node) {
        if (node.token) {
            throw new Error(formatError(this.source, message, node.token));
        }
        throw new Error(message);
    }
    emitWAT() {
        this.outputWAT = [];
        this.emitWATLine("(module");
        this.indent++;
        this.emitWATLine('(import "env" "print" (func $print (param i32) (result i32)))');
        this.emitWATLine('(import "env" "panic" (func $panic (param i32) (result i32)))');
        this.emitWATLine('(memory (export "memory") 1)');
        this.emitWATLine("(global $heap_ptr (mut i32) (i32.const 1024))");
        for (const stmt of this.program.body) {
            if (stmt.type === "FunctionDeclaration") {
                this.emitFunctionWAT(stmt);
            }
        }
        this.indent--;
        this.emitWATLine(")");
        return this.outputWAT.join("\n");
    }
    emitFunctionWAT(fn) {
        this.localCounter = 0;
        this.allLocals.clear();
        this.scopeStack = [
            {
                vars: new Map(),
                borrows: [],
                heapBackupName: "",
            },
        ];
        for (const p of fn.params) {
            this.scopeStack[0].vars.set(p, {
                uniqueName: p,
                isMutable: false,
                isBorrowedMut: false,
                borrowCount: 0,
            });
        }
        const oldOutput = this.outputWAT;
        this.outputWAT = [];
        this.indent = 0;
        this.emitBlockWAT(fn.body);
        const bodyWAT = this.outputWAT;
        this.outputWAT = oldOutput;
        this.indent = 1;
        const params = fn.params.map((p) => `(param $${p} i32)`).join(" ");
        this.emitWATLine(`(func (export "${fn.name}") ${params} (result i32)`);
        this.indent++;
        for (const local of this.allLocals) {
            this.emitWATLine(`(local $${local} i32)`);
        }
        bodyWAT.forEach((line) => {
            this.outputWAT.push("  ".repeat(this.indent) + line.trim());
        });
        this.indent--;
        this.emitWATLine(")");
    }
    emitBlockWAT(block) {
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
                const info = {
                    uniqueName,
                    isMutable: stmt.isMutable,
                    isBorrowedMut: false,
                    borrowCount: 0,
                };
                this.scopeStack[this.scopeStack.length - 1].vars.set(stmt.name, info);
                this.emitWATLine(`local.set $${uniqueName}`);
            }
            else if (stmt.type === "ExpressionStatement") {
                this.emitExpressionWAT(stmt.expression);
                this.emitWATLine("drop");
            }
            else if (stmt.type === "BlockStatement") {
                this.emitBlockWAT(stmt);
                this.emitWATLine("drop");
            }
        }
        if (block.tailExpression) {
            this.emitExpressionWAT(block.tailExpression);
        }
        else {
            this.emitWATLine("i32.const 0");
        }
        // Release borrows
        const scope = this.scopeStack.pop();
        for (const borrow of scope.borrows) {
            if (borrow.isMut) {
                borrow.info.isBorrowedMut = false;
            }
            else {
                borrow.info.borrowCount--;
            }
        }
        this.emitWATLine(`local.get $${heapBackupName}`);
        this.emitWATLine("global.set $heap_ptr");
    }
    resolveVariable(name) {
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            if (this.scopeStack[i].vars.has(name)) {
                return this.scopeStack[i].vars.get(name);
            }
        }
        throw new Error(`Undefined variable: ${name}`);
    }
    emitExpressionWAT(expr) {
        switch (expr.type) {
            case "BlockStatement":
                this.emitBlockWAT(expr);
                break;
            case "Literal":
                this.emitWATLine(`i32.const ${expr.value}`);
                break;
            case "Identifier":
                try {
                    const info = this.resolveVariable(expr.name);
                    if (info.isBorrowedMut) {
                        this.throwError(`Cannot use '${expr.name}' while it is mutably borrowed`, expr);
                    }
                    this.emitWATLine(`local.get $${info.uniqueName}`);
                }
                catch (e) {
                    if (e.message.startsWith("Undefined variable")) {
                        this.throwError(e.message, expr);
                    }
                    throw e;
                }
                break;
            case "BorrowExpression":
                if (expr.argument.type === "Identifier") {
                    try {
                        const info = this.resolveVariable(expr.argument.name);
                        if (expr.isMutable) {
                            if (info.isBorrowedMut || info.borrowCount > 0) {
                                this.throwError(`Cannot borrow '${expr.argument.name}' as mutable: already borrowed`, expr);
                            }
                            if (!info.isMutable) {
                                this.throwError(`Cannot borrow '${expr.argument.name}' as mutable: it is not declared as mutable`, expr);
                            }
                            info.isBorrowedMut = true;
                            this.scopeStack[this.scopeStack.length - 1].borrows.push({
                                info,
                                isMut: true,
                            });
                        }
                        else {
                            if (info.isBorrowedMut) {
                                this.throwError(`Cannot borrow '${expr.argument.name}' as immutable: already borrowed as mutable`, expr);
                            }
                            info.borrowCount++;
                            this.scopeStack[this.scopeStack.length - 1].borrows.push({
                                info,
                                isMut: false,
                            });
                        }
                        this.emitWATLine("i32.const 0"); // Placeholder for pointer
                    }
                    catch (e) {
                        if (e.message.startsWith("Undefined variable")) {
                            this.throwError(e.message, expr);
                        }
                        throw e;
                    }
                }
                else {
                    this.throwError("Can only borrow identifiers", expr);
                }
                break;
            case "UnaryExpression":
                if (expr.operator === "-") {
                    this.emitWATLine("i32.const 0");
                    this.emitExpressionWAT(expr.argument);
                    this.emitWATLine("i32.sub");
                }
                else if (expr.operator === "!") {
                    this.emitExpressionWAT(expr.argument);
                    this.emitWATLine("i32.eqz");
                }
                else {
                    this.throwError(`Unsupported unary operator: ${expr.operator}`, expr);
                }
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
                }
                else if (expr.name === "panic") {
                    this.emitExpressionWAT(expr.args[0] ?? { type: "Literal", value: 0, rawType: "integer" });
                    this.emitWATLine("call $panic");
                    this.emitWATLine("unreachable");
                }
                else if (expr.name === "alloc") {
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
            case "CallExpression":
                for (const arg of expr.args)
                    this.emitExpressionWAT(arg);
                this.emitWATLine(`call $${expr.callee}`);
                break;
        }
    }
    emitWATLine(line) {
        this.outputWAT.push("  ".repeat(this.indent) + line);
    }
    emitWASM() {
        this.functionIndices.clear();
        this.functionIndices.set("print", 0);
        this.functionIndices.set("panic", 1);
        const userFunctions = this.program.body.filter((s) => s.type === "FunctionDeclaration");
        userFunctions.forEach((fn, i) => this.functionIndices.set(fn.name, 2 + i));
        const typeSection = this.encodeSection(SECTION_TYPE, this.encodeVector([
            [TYPE_FUNC, 1, TYPE_I32, 1, TYPE_I32],
            ...userFunctions.map((fn) => [
                TYPE_FUNC,
                fn.params.length,
                ...new Array(fn.params.length).fill(TYPE_I32),
                1,
                TYPE_I32,
            ]),
        ]));
        const importSection = this.encodeSection(SECTION_IMPORT, this.encodeVector([
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
        ]));
        const funcSection = this.encodeSection(SECTION_FUNCTION, this.encodeVector(userFunctions.map((_, i) => [i + 1])));
        const memSection = this.encodeSection(SECTION_MEMORY, this.encodeVector([[0x00, 0x01]]));
        const globalSection = this.encodeSection(0x06, this.encodeVector([
            [
                TYPE_I32,
                0x01,
                OP_I32_CONST,
                ...this.encodeSignedLEB128(1024),
                OP_END,
            ],
        ]));
        const exportSection = this.encodeSection(SECTION_EXPORT, this.encodeVector([
            [...this.encodeString("memory"), 0x02, 0x00],
            ...userFunctions.map((fn) => [
                ...this.encodeString(fn.name),
                0x00,
                this.functionIndices.get(fn.name),
            ]),
        ]));
        const codeSection = this.encodeSection(SECTION_CODE, this.encodeVector(userFunctions.map((fn) => this.emitFunctionBinary(fn))));
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
        ]);
    }
    emitFunctionBinary(fn) {
        this.localCounter = 0;
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
            this.scopeStack[0].vars.set(p, {
                uniqueName: p,
                isMutable: false,
                isBorrowedMut: false,
                borrowCount: 0,
            });
            this.locals.set(p, i);
        });
        const body = [];
        this.emitBlockBinary(fn.body, body);
        body.push(OP_END);
        const localList = Array.from(this.allLocals);
        const localMap = new Map();
        localList.forEach((name, i) => localMap.set(name, fn.params.length + i));
        const finalBody = [];
        for (let i = 0; i < body.length; i++) {
            if (body[i] === 0xfe) {
                const name = body[i + 1];
                const idx = localMap.has(name)
                    ? localMap.get(name)
                    : this.locals.get(name);
                finalBody.push(...this.encodeUnsignedLEB128(idx));
                i++;
            }
            else {
                finalBody.push(body[i]);
            }
        }
        const localDecls = localList.length > 0 ? [[localList.length, TYPE_I32]] : [];
        const localBytes = this.encodeVector(localDecls.map((d) => [...this.encodeUnsignedLEB128(d[0]), d[1]]));
        return [
            ...this.encodeUnsignedLEB128(localBytes.length + finalBody.length),
            ...localBytes,
            ...finalBody,
        ];
    }
    emitBlockBinary(block, body) {
        const heapBackupName = `old_heap_ptr_${++this.localCounter}`;
        this.allLocals.add(heapBackupName);
        body.push(0x23, 0x00);
        body.push(OP_LOCAL_SET, 0xfe, heapBackupName);
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
                const info = {
                    uniqueName,
                    isMutable: stmt.isMutable,
                    isBorrowedMut: false,
                    borrowCount: 0,
                };
                this.scopeStack[this.scopeStack.length - 1].vars.set(stmt.name, info);
                body.push(OP_LOCAL_SET, 0xfe, uniqueName);
            }
            else if (stmt.type === "ExpressionStatement") {
                this.emitExpressionBinary(stmt.expression, body);
                body.push(OP_DROP);
            }
            else if (stmt.type === "BlockStatement") {
                this.emitBlockBinary(stmt, body);
                body.push(OP_DROP);
            }
        }
        if (block.tailExpression) {
            this.emitExpressionBinary(block.tailExpression, body);
        }
        else {
            body.push(OP_I32_CONST, 0);
        }
        // Release borrows
        const scope = this.scopeStack.pop();
        for (const borrow of scope.borrows) {
            if (borrow.isMut) {
                borrow.info.isBorrowedMut = false;
            }
            else {
                borrow.info.borrowCount--;
            }
        }
        body.push(OP_LOCAL_GET, 0xfe, heapBackupName);
        body.push(0x24, 0x00);
    }
    emitExpressionBinary(expr, body) {
        switch (expr.type) {
            case "BlockStatement":
                this.emitBlockBinary(expr, body);
                break;
            case "Literal":
                body.push(OP_I32_CONST, ...this.encodeSignedLEB128(Number(expr.value)));
                break;
            case "Identifier":
                try {
                    const info = this.resolveVariable(expr.name);
                    if (info.isBorrowedMut) {
                        this.throwError(`Cannot use '${expr.name}' while it is mutably borrowed`, expr);
                    }
                    body.push(OP_LOCAL_GET, 0xfe, info.uniqueName);
                }
                catch (e) {
                    if (e.message.startsWith("Undefined variable")) {
                        this.throwError(e.message, expr);
                    }
                    throw e;
                }
                break;
            case "BorrowExpression":
                if (expr.argument.type === "Identifier") {
                    try {
                        const info = this.resolveVariable(expr.argument.name);
                        if (expr.isMutable) {
                            if (info.isBorrowedMut || info.borrowCount > 0) {
                                this.throwError(`Cannot borrow '${expr.argument.name}' as mutable: already borrowed`, expr);
                            }
                            if (!info.isMutable) {
                                this.throwError(`Cannot borrow '${expr.argument.name}' as mutable: it is not declared as mutable`, expr);
                            }
                            info.isBorrowedMut = true;
                            this.scopeStack[this.scopeStack.length - 1].borrows.push({
                                info,
                                isMut: true,
                            });
                        }
                        else {
                            if (info.isBorrowedMut) {
                                this.throwError(`Cannot borrow '${expr.argument.name}' as immutable: already borrowed as mutable`, expr);
                            }
                            info.borrowCount++;
                            this.scopeStack[this.scopeStack.length - 1].borrows.push({
                                info,
                                isMut: false,
                            });
                        }
                        body.push(OP_I32_CONST, 0);
                    }
                    catch (e) {
                        if (e.message.startsWith("Undefined variable")) {
                            this.throwError(e.message, expr);
                        }
                        throw e;
                    }
                }
                else {
                    this.throwError("Can only borrow identifiers", expr);
                }
                break;
            case "UnaryExpression":
                if (expr.operator === "-") {
                    body.push(OP_I32_CONST, 0);
                    this.emitExpressionBinary(expr.argument, body);
                    body.push(OP_I32_SUB);
                }
                else if (expr.operator === "!") {
                    this.emitExpressionBinary(expr.argument, body);
                    body.push(0x45);
                }
                else {
                    this.throwError(`Unsupported unary operator: ${expr.operator}`, expr);
                }
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
                }
                else if (expr.name === "panic") {
                    this.emitExpressionBinary(expr.args[0] ?? { type: "Literal", value: 0, rawType: "integer" }, body);
                    body.push(OP_CALL, ...this.encodeUnsignedLEB128(1));
                    body.push(OP_UNREACHABLE);
                }
                else if (expr.name === "alloc") {
                    const sizeExpr = expr.args[0];
                    if (!sizeExpr) {
                        this.throwError("alloc! expects exactly one argument", expr);
                    }
                    body.push(0x23, 0x00);
                    body.push(0x23, 0x00);
                    this.emitExpressionBinary(sizeExpr, body);
                    body.push(OP_I32_ADD);
                    body.push(0x24, 0x00);
                }
                break;
            case "CallExpression":
                for (const arg of expr.args)
                    this.emitExpressionBinary(arg, body);
                const idx = this.functionIndices.get(expr.callee);
                if (idx === undefined)
                    throw new Error(`Unknown function: ${expr.callee}`);
                body.push(OP_CALL, ...this.encodeUnsignedLEB128(idx));
                break;
        }
    }
    encodeSection(id, content) {
        return [id, ...this.encodeUnsignedLEB128(content.length), ...content];
    }
    encodeVector(items) {
        return [...this.encodeUnsignedLEB128(items.length), ...items.flat()];
    }
    encodeString(s) {
        const bytes = new TextEncoder().encode(s);
        return [...this.encodeUnsignedLEB128(bytes.length), ...Array.from(bytes)];
    }
    encodeUnsignedLEB128(n) {
        const result = [];
        do {
            let byte = n & 0x7f;
            n >>>= 7;
            if (n !== 0)
                byte |= 0x80;
            result.push(byte);
        } while (n !== 0);
        return result;
    }
    encodeSignedLEB128(n) {
        const result = [];
        while (true) {
            const byte = n & 0x7f;
            n >>= 7;
            if ((n === 0 && (byte & 0x40) === 0) ||
                (n === -1 && (byte & 0x40) !== 0)) {
                result.push(byte);
                break;
            }
            result.push(byte | 0x80);
        }
        return result;
    }
}
