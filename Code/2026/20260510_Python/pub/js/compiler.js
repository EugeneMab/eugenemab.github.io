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
    locals = new Map();
    localIndex = 0;
    functionMap = new Map();
    generatorIds = [];
    isCompilingGenerator = false;
    localOffsets = new Map();
    tempLocals = [];
    watLocalCount = 0;
    withStack = [];
    allocateTempLocal() {
        let candidateIndex = this.tempLocals.length;
        let name = `__tmp${candidateIndex}`;
        while (this.locals.has(name) || this.tempLocals.includes(name)) {
            candidateIndex++;
            name = `__tmp${candidateIndex}`;
        }
        this.tempLocals.push(name);
        return name;
    }
    getTempLocalIndex(name) {
        const idx = this.tempLocals.indexOf(name);
        if (idx === -1)
            throw new Error(`Unknown temp local: ${name}`);
        return this.localIndex + idx;
    }
    compileWAT(program) {
        this.functionMap.clear();
        this.functionMap.set("print", 0);
        this.functionMap.set("sleep", 1);
        this.functionMap.set("print_str", 2);
        this.functionMap.set("itoa", 3);
        this.functionMap.set("concat", 4);
        this.functionMap.set("_get_item", 5);
        this.functionMap.set("_slice", 6);
        this.functionMap.set("next", 7);
        this.generatorIds = [];
        const userFunctions = program.body.filter((n) => n.type === "FunctionDef");
        let currentId = 8;
        userFunctions.forEach((f) => {
            this.functionMap.set(f.name, currentId);
            if (this.isGenerator(f)) {
                this.generatorIds.push(currentId);
                // Worker ID will be the one after factory
                this.functionMap.set(f.name + "_worker", currentId + 1);
                currentId += 2;
            }
            else {
                currentId += 1;
            }
        });
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
        // Dispatcher for next()
        wat += `  (func $next (param $ptr i32) (result i32)\n`;
        wat += `    (local $id i32)\n`;
        if (this.generatorIds.length > 0) {
            wat += `    local.get $ptr\n    i32.load\n    local.set $id\n`;
            this.generatorIds.forEach((id) => {
                const funcName = Array.from(this.functionMap.entries()).find(([, v]) => v === id)[0];
                wat += `    local.get $id\n    i32.const ${id}\n    i32.eq\n    if\n      local.get $ptr\n      call $${funcName}_worker\n      return\n    end\n`;
            });
        }
        wat += `    i32.const 0\n  )\n`;
        wat += `  (export "next" (func $next))\n`;
        wat += `)\n`;
        return wat;
    }
    isGenerator(node) {
        let found = false;
        const scan = (n) => {
            if (!n || found)
                return;
            if (n.type === "Yield") {
                found = true;
                return;
            }
            switch (n.type) {
                case "If":
                    n.thenBranch.forEach(scan);
                    if (n.elseBranch)
                        n.elseBranch.forEach(scan);
                    break;
                case "While":
                    n.body.forEach(scan);
                    break;
                case "For":
                    n.body.forEach(scan);
                    break;
                case "DoWhile":
                    n.body.forEach(scan);
                    break;
                case "FunctionDef":
                    // Don't recurse into nested functions (if we support them)
                    break;
                default:
                    // Check children if any
                    for (const key in n) {
                        const val = n[key];
                        if (Array.isArray(val))
                            val.forEach(scan);
                        else if (val && typeof val === "object" && val.type)
                            scan(val);
                    }
            }
        };
        node.body.forEach(scan);
        return found;
    }
    emitFunctionWAT(node) {
        const isGen = this.isGenerator(node);
        if (isGen) {
            return this.emitGeneratorWAT(node);
        }
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
        const localDecls = [];
        const scanNode = (n) => {
            if (!n)
                return;
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
                    if (n.elseBranch)
                        n.elseBranch.forEach(scanNode);
                    break;
                case "While":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "For":
                    if (n.iterable)
                        scanNode(n.iterable);
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    n.body.forEach(scanNode);
                    break;
                case "DoWhile":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "Return":
                    scanNode(n.value);
                    break;
                case "Yield":
                    scanNode(n.value);
                    break;
                case "List":
                    n.elements.forEach(scanNode);
                    break;
                case "ListComprehension":
                    scanNode(n.iterable);
                    scanNode(n.expression);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "DictComprehension":
                    scanNode(n.iterable);
                    scanNode(n.key);
                    scanNode(n.value);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "Subscript":
                    scanNode(n.value);
                    scanNode(n.index);
                    break;
                case "Slice":
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    if (n.step)
                        scanNode(n.step);
                    break;
            }
        };
        node.body.forEach(scanNode);
        const bodyLines = [];
        for (const stmt of node.body) {
            const stmtWat = this.emitStatementWAT(stmt);
            if (stmtWat)
                bodyLines.push(...stmtWat.split("\n"));
        }
        // Add generic locals for WAT emission based on usage
        this.tempLocals.forEach((name) => {
            localDecls.push(`(local $${name} i32)`);
        });
        const allLines = [...localDecls, ...bodyLines].filter((line) => line.trim().length > 0);
        const paramsPart = paramsWAT ? " " + paramsWAT : "";
        return (`  (func $${node.name}${paramsPart} (result i32)\n` +
            `    ${allLines.join("\n    ")}\n` +
            `    i32.const 0\n` +
            `  )\n` +
            `  (export "${node.name}" (func $${node.name}))\n`);
    }
    emitGeneratorWAT(node) {
        const funcId = this.functionMap.get(node.name);
        const params = node.params;
        this.locals.clear();
        this.localIndex = 0;
        this.tempLocals = [];
        const scanNode = (n) => {
            if (!n)
                return;
            if (n.type === "Assignment" && !this.locals.has(n.target)) {
                this.locals.set(n.target, this.localIndex++);
            }
            if (n.type === "For" && !this.locals.has(n.iterator)) {
                this.locals.set(n.iterator, this.localIndex++);
            }
            // ... recurse (truncated for brevity in thought, but I'll include it in the replace)
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
                    if (n.elseBranch)
                        n.elseBranch.forEach(scanNode);
                    break;
                case "While":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "For":
                    if (n.iterable)
                        scanNode(n.iterable);
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    n.body.forEach(scanNode);
                    break;
                case "DoWhile":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "Return":
                    scanNode(n.value);
                    break;
                case "Yield":
                    scanNode(n.value);
                    break;
                case "List":
                    n.elements.forEach(scanNode);
                    break;
                case "ListComprehension":
                    scanNode(n.iterable);
                    scanNode(n.expression);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "DictComprehension":
                    scanNode(n.iterable);
                    scanNode(n.key);
                    scanNode(n.value);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "Subscript":
                    scanNode(n.value);
                    scanNode(n.index);
                    break;
                case "Slice":
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    if (n.step)
                        scanNode(n.step);
                    break;
            }
        };
        node.body.forEach(scanNode);
        this.localOffsets.clear();
        params.forEach((p, i) => {
            this.localOffsets.set(p, 8 + i * 4);
        });
        const paramCount = params.length;
        Array.from(this.locals.keys()).forEach((name, i) => {
            if (!this.localOffsets.has(name)) {
                this.localOffsets.set(name, 8 + (paramCount + i) * 4);
            }
        });
        const totalSize = (2 + this.localOffsets.size) * 4;
        let factory = `  (func $${node.name} ${params.map((p) => `(param $${p} i32)`).join(" ")} (result i32)\n`;
        factory += `    (local $ptr i32)\n`;
        factory += `    global.get $heap_ptr\n    local.set $ptr\n`;
        factory += `    global.get $heap_ptr\n    i32.const ${totalSize}\n    i32.add\n    global.set $heap_ptr\n`;
        factory += `    local.get $ptr\n    i32.const ${funcId}\n    i32.store\n`;
        factory += `    local.get $ptr\n    i32.const 4\n    i32.add\n    i32.const 0\n    i32.store\n`;
        params.forEach((p) => {
            factory += `    local.get $ptr\n    i32.const ${this.localOffsets.get(p)}\n    i32.add\n    local.get $${p}\n    i32.store\n`;
        });
        factory += `    local.get $ptr\n  )\n`;
        factory += `  (export "${node.name}" (func $${node.name}))\n`;
        return factory + this.emitGeneratorWorkerWAT(node);
    }
    nodeToStateId = new Map();
    nextStateId = 0;
    stateAfterId = new Map();
    preScanStates(nodes, nextId = null) {
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!this.nodeToStateId.has(node)) {
                this.nodeToStateId.set(node, this.nextStateId++);
            }
        }
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const afterId = i < nodes.length - 1 ? this.nodeToStateId.get(nodes[i + 1]) : nextId;
            this.stateAfterId.set(node, afterId ?? -1);
            switch (node.type) {
                case "If":
                    this.preScanStates(node.thenBranch, afterId);
                    if (node.elseBranch)
                        this.preScanStates(node.elseBranch, afterId);
                    break;
                case "While":
                    this.preScanStates(node.body, this.nodeToStateId.get(node));
                    break;
                case "For":
                    this.preScanStates(node.body, this.nodeToStateId.get(node));
                    break;
                case "DoWhile":
                    this.preScanStates(node.body, this.nodeToStateId.get(node));
                    break;
            }
        }
    }
    emitGeneratorWorkerWAT(node) {
        this.isCompilingGenerator = true;
        this.nextStateId = 0;
        this.nodeToStateId.clear();
        this.stateAfterId.clear();
        this.preScanStates(node.body);
        this.tempLocals = [];
        const flatStatements = [];
        const collect = (nodes) => {
            for (const n of nodes) {
                flatStatements.push(n);
                switch (n.type) {
                    case "If":
                        collect(n.thenBranch);
                        if (n.elseBranch)
                            collect(n.elseBranch);
                        break;
                    case "While":
                        collect(n.body);
                        break;
                    case "For":
                        collect(n.body);
                        break;
                    case "DoWhile":
                        collect(n.body);
                        break;
                }
            }
        };
        collect(node.body);
        const bodyLines = [];
        bodyLines.push("loop $main_loop");
        flatStatements.forEach((stmt) => {
            bodyLines.push(this.indent(this.emitStatementWAT(stmt)));
        });
        bodyLines.push("end");
        const localDecls = [`(local $state i32)`];
        this.tempLocals.forEach((name) => {
            localDecls.push(`(local $${name} i32)`);
        });
        this.isCompilingGenerator = false;
        return (`  (func $${node.name}_worker (param $gen_ptr i32) (result i32)\n` +
            `    ${localDecls.join("\n    ")}\n` +
            `    local.get $gen_ptr\n    i32.const 4\n    i32.add\n    i32.load\n    local.set $state\n` +
            this.indent(this.indent(bodyLines.join("\n"))) +
            "\n" +
            `    local.get $gen_ptr\n    i32.const 4\n    i32.add\n    i32.const -1\n    i32.store\n` +
            `    i32.const 0\n  )\n`);
    }
    emitStatementWAT(node) {
        if (this.isCompilingGenerator) {
            const myId = this.nodeToStateId.get(node);
            const afterId = this.stateAfterId.get(node);
            let wat = `local.get $state\ni32.const ${myId}\ni32.eq\nif\n`;
            let inner;
            switch (node.type) {
                case "Yield":
                    inner =
                        this.emitExpressionWAT(node.value) +
                            `\nlocal.get $gen_ptr\ni32.const 4\ni32.add\ni32.const ${afterId}\ni32.store\nreturn`;
                    break;
                case "Assignment": {
                    const offset = this.localOffsets.get(node.target);
                    inner =
                        `local.get $gen_ptr\ni32.const ${offset}\ni32.add\n` +
                            this.emitExpressionWAT(node.value) +
                            `\ni32.store\ni32.const ${afterId}\nlocal.set $state\nbr $main_loop`;
                    break;
                }
                case "While": {
                    const firstInBodyId = this.nodeToStateId.get(node.body[0]) ?? afterId;
                    inner =
                        this.emitExpressionWAT(node.condition) +
                            `\nif\ni32.const ${firstInBodyId}\nlocal.set $state\nelse\ni32.const ${afterId}\nlocal.set $state\nend\nbr $main_loop`;
                    break;
                }
                case "If": {
                    const thenId = this.nodeToStateId.get(node.thenBranch[0]) ?? afterId;
                    const elseId = node.elseBranch && node.elseBranch.length > 0
                        ? this.nodeToStateId.get(node.elseBranch[0])
                        : afterId;
                    inner =
                        this.emitExpressionWAT(node.condition) +
                            `\nif\ni32.const ${thenId}\nlocal.set $state\nelse\ni32.const ${elseId}\nlocal.set $state\nend\nbr $main_loop`;
                    break;
                }
                case "Pass":
                    inner = `i32.const ${afterId}\nlocal.set $state\nbr $main_loop`;
                    break;
                case "Return":
                    inner = `local.get $gen_ptr\ni32.const 4\ni32.add\ni32.const -1\ni32.store\ni32.const 0\nreturn`;
                    break;
                case "For":
                case "DoWhile":
                    throw new Error(`Generator functions do not yet support ${node.type} loops. Use while loops instead.`);
                default:
                    const expr = this.emitExpressionWAT(node);
                    if (expr) {
                        inner =
                            expr +
                                `\ndrop\ni32.const ${afterId}\nlocal.set $state\nbr $main_loop`;
                    }
                    else {
                        // Unhandled statement type in generator
                        throw new Error(`Unhandled statement type in generator: ${node.type}`);
                    }
            }
            wat += this.indent(inner) + "\nend";
            return wat;
        }
        switch (node.type) {
            case "Return": {
                let wat = "";
                if (this.withStack.length > 0) {
                    const tmp = this.allocateTempLocal();
                    wat += this.emitExpressionWAT(node.value) + `\nlocal.set $${tmp}\n`;
                    for (let i = this.withStack.length - 1; i >= 0; i--) {
                        const mgrName = this.withStack[i];
                        wat +=
                            `local.get $${mgrName}\n` +
                                `i32.const 0\ni32.const 0\ni32.const 0\n` +
                                `call $__exit__\ndrop\n`;
                    }
                    wat += `local.get $${tmp}\n`;
                }
                else {
                    wat += this.emitExpressionWAT(node.value) + "\n";
                }
                return wat + "return";
            }
            case "Assignment":
                return (this.emitExpressionWAT(node.value) + `\nlocal.set $${node.target}`);
            case "While": {
                const loopContent = this.emitExpressionWAT(node.condition) +
                    "\ni32.eqz\nbr_if 1\n" +
                    node.body
                        .map((s) => this.emitStatementWAT(s))
                        .filter((s) => s)
                        .join("\n") +
                    "\nbr 0";
                return `block\n  loop\n${this.indent(this.indent(loopContent))}\n  end\nend`;
            }
            case "If": {
                const thenBranch = this.indent(node.thenBranch
                    .map((s) => this.emitStatementWAT(s))
                    .filter((s) => s)
                    .join("\n"));
                const elseBranch = node.elseBranch
                    ? `else\n${this.indent(node.elseBranch
                        .map((s) => this.emitStatementWAT(s))
                        .filter((s) => s)
                        .join("\n"))}\n`
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
                }
                else if (node.iterable) {
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
                const body = node.body
                    .map((s) => this.emitStatementWAT(s))
                    .filter((s) => s)
                    .join("\n") + "\n";
                const condition = `${this.emitExpressionWAT(node.condition)}\nbr_if 0`;
                return `loop\n${this.indent(body + condition)}\nend`;
            }
            case "With": {
                const withNode = node;
                const mgrLocal = this.allocateTempLocal();
                this.withStack.push(mgrLocal);
                const init = this.emitExpressionWAT(withNode.expression) +
                    `\nlocal.set $${mgrLocal}`;
                const enterCall = `local.get $${mgrLocal}\ncall $__enter__`;
                const targetSet = withNode.target
                    ? `local.set $${withNode.target}`
                    : "drop";
                const body = withNode.body
                    .map((s) => this.emitStatementWAT(s))
                    .filter((s) => s)
                    .join("\n");
                const exitCall = `local.get $${mgrLocal}\ni32.const 0\ni32.const 0\ni32.const 0\ncall $__exit__\ndrop`;
                this.withStack.pop();
                return `${init}\n${enterCall}\n${targetSet}\n${body}\n${exitCall}`;
            }
            case "Pass":
                return "nop";
            default:
                const expr = this.emitExpressionWAT(node);
                return expr ? expr + "\ndrop" : "";
        }
    }
    indent(text) {
        if (!text)
            return "";
        return text
            .split("\n")
            .map((line) => "  " + line)
            .join("\n");
    }
    emitExpressionWAT(node) {
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
                if (this.isCompilingGenerator && this.localOffsets.has(node.name)) {
                    const offset = this.localOffsets.get(node.name);
                    return `local.get $gen_ptr\ni32.const ${offset}\ni32.add\ni32.load`;
                }
                return `local.get $${node.name}`;
            case "BinaryExpression": {
                const leftWAT = this.emitExpressionWAT(node.left);
                const rightWAT = this.emitExpressionWAT(node.right);
                if (node.operator === "+") {
                    const isString = (n) => (n.type === "Literal" && typeof n.value === "string") ||
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
                        return (leftWAT +
                            `\ni32.const 0\ni32.ne\n` +
                            rightWAT +
                            `\ni32.const 0\ni32.ne\ni32.and`);
                    case "or":
                        return (leftWAT +
                            `\ni32.const 0\ni32.ne\n` +
                            rightWAT +
                            `\ni32.const 0\ni32.ne\ni32.or`);
                }
                return leftWAT + "\n" + rightWAT + "\n" + op;
            }
            case "UnaryExpression":
                if (node.operator === "-")
                    return (`i32.const 0\n` +
                        this.emitExpressionWAT(node.argument) +
                        `\ni32.sub`);
                if (node.operator === "not")
                    return this.emitExpressionWAT(node.argument) + `\ni32.eqz`;
                return this.emitExpressionWAT(node.argument);
            case "CallExpression": {
                const argWAT = node.args
                    .map((a) => this.emitExpressionWAT(a))
                    .join("\n");
                if (typeof node.callee === "string") {
                    if (node.callee === "next" && node.args.length === 1) {
                        return this.emitExpressionWAT(node.args[0]) + "\ncall $next";
                    }
                    if (node.callee === "print" && node.args.length === 1) {
                        const arg = node.args[0];
                        if ((arg.type === "Literal" && typeof arg.value === "string") ||
                            arg.type === "FString") {
                            return argWAT + "\ncall $print_str";
                        }
                    }
                    return (argWAT ? argWAT + "\n" : "") + `call $${node.callee}`;
                }
                else {
                    if (node.callee.type === "MemberAccess") {
                        const ma = node.callee;
                        return (this.emitExpressionWAT(ma.object) +
                            "\n" +
                            (argWAT ? argWAT + "\n" : "") +
                            `call $${ma.member}`);
                    }
                    throw new Error(`Dynamic calls on ${node.callee.type} are not yet supported in WAT`);
                }
            }
            case "FString": {
                let wat = "";
                node.parts.forEach((part, i) => {
                    if (typeof part === "string") {
                        wat +=
                            this.emitExpressionWAT({
                                type: "Literal",
                                value: part,
                            }) + "\n";
                    }
                    else {
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
                    const slice = node.index;
                    const start = slice.start
                        ? this.emitExpressionWAT(slice.start)
                        : "i32.const 2147483647";
                    const stop = slice.stop
                        ? this.emitExpressionWAT(slice.stop)
                        : "i32.const 2147483647";
                    const step = slice.step
                        ? this.emitExpressionWAT(slice.step)
                        : "i32.const 2147483647";
                    return (this.emitExpressionWAT(node.value) +
                        "\n" +
                        start +
                        "\n" +
                        stop +
                        "\n" +
                        step +
                        "\ncall $_slice");
                }
                return (this.emitExpressionWAT(node.value) +
                    "\n" +
                    this.emitExpressionWAT(node.index) +
                    "\ncall $_get_item");
            }
            case "ListComprehension": {
                const iterPtr = this.allocateTempLocal();
                const iterLen = this.allocateTempLocal();
                const resPtr = this.allocateTempLocal();
                const count = this.allocateTempLocal();
                const iIdx = this.allocateTempLocal();
                const resItemPtr = this.allocateTempLocal();
                let wat = this.emitExpressionWAT(node.iterable) + `\nlocal.set $${iterPtr}\n`;
                wat += `local.get $${iterPtr}\ni32.load\nlocal.set $${iterLen}\n`;
                wat += `global.get $heap_ptr\nlocal.set $${resPtr}\n`;
                wat += `local.get $${resPtr}\ni32.const 0\ni32.store\n`;
                wat += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                wat += `i32.const 0\nlocal.set $${count}\n`;
                wat += `i32.const 0\nlocal.set $${iIdx}\n`;
                let loopBody = `local.get $${iIdx}\nlocal.get $${iterLen}\ni32.ge_s\nbr_if 1\n`;
                loopBody += `local.get $${iterPtr}\nlocal.get $${iIdx}\ni32.const 4\ni32.mul\ni32.add\ni32.const 4\ni32.add\ni32.load\nlocal.set $${node.item}\n`;
                let action = `global.get $heap_ptr\nlocal.set $${resItemPtr}\n` +
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
                }
                else {
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
                let wat = this.emitExpressionWAT(node.iterable) + `\nlocal.set $${iterPtr}\n`;
                wat += `local.get $${iterPtr}\ni32.load\nlocal.set $${iterLen}\n`;
                wat += `global.get $heap_ptr\nlocal.set $${resPtr}\n`;
                wat += `local.get $${resPtr}\ni32.const 0\ni32.store\n`;
                wat += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                wat += `i32.const 0\nlocal.set $${count}\n`;
                wat += `i32.const 0\nlocal.set $${iIdx}\n`;
                let loopBody = `local.get $${iIdx}\nlocal.get $${iterLen}\ni32.ge_s\nbr_if 1\n`;
                loopBody += `local.get $${iterPtr}\nlocal.get $${iIdx}\ni32.const 4\ni32.mul\ni32.add\ni32.const 4\ni32.add\ni32.load\nlocal.set $${node.item}\n`;
                let action = `global.get $heap_ptr\nlocal.set $${resItemPtr}\n` +
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
                }
                else {
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
    compileWASM(program) {
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
        this.functionMap.set("next", 7);
        this.generatorIds = [];
        const userFunctions = program.body.filter((n) => n.type === "FunctionDef");
        let currentId = 8;
        userFunctions.forEach((f) => {
            this.functionMap.set(f.name, currentId);
            if (this.isGenerator(f)) {
                this.generatorIds.push(currentId);
                this.functionMap.set(f.name + "_worker", currentId + 1);
                currentId += 2;
            }
            else {
                currentId += 1;
            }
        });
        const types = [];
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
        const userFuncTypeIndices = [];
        for (const f of userFunctions) {
            const type = [
                TYPE_FUNC,
                ...this.encodeUnsignedLEB128(f.params.length),
                ...new Array(f.params.length).fill(TYPE_I32),
                1,
                TYPE_I32,
            ];
            let idx = types.findIndex((t) => JSON.stringify(t) === JSON.stringify(type));
            if (idx === -1) {
                idx = types.length;
                types.push(type);
            }
            userFuncTypeIndices.push(idx);
            if (this.isGenerator(f)) {
                // Worker type is always (i32) -> i32 (index 0)
                userFuncTypeIndices.push(0);
            }
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
            this.encodeVector([[0], ...userFuncTypeIndices.map((i) => [i])]),
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
        const exports = [];
        userFunctions.forEach((f) => exports.push([
            ...this.encodeString(f.name),
            EXT_KIND_FUNC,
            ...this.encodeUnsignedLEB128(this.functionMap.get(f.name)),
        ]));
        exports.push([
            ...this.encodeString("next"),
            EXT_KIND_FUNC,
            ...this.encodeUnsignedLEB128(7),
        ]);
        exports.push([...this.encodeString("memory"), EXT_KIND_MEMORY, 0]);
        exports.push([...this.encodeString("heap_ptr"), EXT_KIND_GLOBAL, 0]);
        const exportSection = this.createSection(SECTION_EXPORT, [
            this.encodeVector(exports),
        ]);
        // Dispatcher for next()
        const nextDispatcher = this.emitNextDispatcherBinary();
        const codes = [
            nextDispatcher,
            ...userFunctions.flatMap((f) => {
                if (this.isGenerator(f)) {
                    return [
                        this.emitGeneratorFactoryBinary(f),
                        this.emitGeneratorWorkerBinary(f),
                    ];
                }
                return [this.emitFunctionBinary(f)];
            }),
        ];
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
    createSection(id, content) {
        const bytes = content.flat();
        return [id, ...this.encodeUnsignedLEB128(bytes.length), ...bytes];
    }
    encodeVector(items) {
        const flatItems = items.flat();
        return [...this.encodeUnsignedLEB128(items.length), ...flatItems];
    }
    emitNextDispatcherBinary() {
        const locals = [[1, TYPE_I32]]; // (local $id i32)
        const bytes = [];
        if (this.generatorIds.length > 0) {
            bytes.push(OP_LOCAL_GET, 0, OP_I32_LOAD, 2, 0, OP_LOCAL_SET, 1);
            this.generatorIds.forEach((id) => {
                bytes.push(OP_LOCAL_GET, 1, OP_I32_CONST, ...this.encodeSignedLEB128(id), OP_I32_EQ, OP_IF, TYPE_EMPTY, OP_LOCAL_GET, 0, OP_CALL, ...this.encodeUnsignedLEB128(id + 1), OP_RETURN, OP_END);
            });
        }
        bytes.push(OP_I32_CONST, 0, OP_END);
        const localPart = this.encodeVector(locals);
        return [
            ...this.encodeUnsignedLEB128(localPart.length + bytes.length),
            ...localPart,
            ...bytes,
        ];
    }
    encodeString(s) {
        const bytes = new TextEncoder().encode(s);
        return [...this.encodeUnsignedLEB128(bytes.length), ...Array.from(bytes)];
    }
    emitGeneratorFactoryBinary(node) {
        const funcId = this.functionMap.get(node.name);
        const params = node.params;
        this.locals.clear();
        this.localIndex = 0;
        this.tempLocals = [];
        const scanNode = (n) => {
            if (!n)
                return;
            if (n.type === "Assignment" && !this.locals.has(n.target))
                this.locals.set(n.target, this.localIndex++);
            if (n.type === "For" && !this.locals.has(n.iterator))
                this.locals.set(n.iterator, this.localIndex++);
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
                    if (n.elseBranch)
                        n.elseBranch.forEach(scanNode);
                    break;
                case "While":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "For":
                    if (n.iterable)
                        scanNode(n.iterable);
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    n.body.forEach(scanNode);
                    break;
                case "DoWhile":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "Return":
                    scanNode(n.value);
                    break;
                case "Yield":
                    scanNode(n.value);
                    break;
                case "List":
                    n.elements.forEach(scanNode);
                    break;
                case "ListComprehension":
                    scanNode(n.iterable);
                    scanNode(n.expression);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "DictComprehension":
                    scanNode(n.iterable);
                    scanNode(n.key);
                    scanNode(n.value);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "Subscript":
                    scanNode(n.value);
                    scanNode(n.index);
                    break;
                case "Slice":
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    if (n.step)
                        scanNode(n.step);
                    break;
            }
        };
        node.body.forEach(scanNode);
        this.localOffsets.clear();
        params.forEach((p, i) => this.localOffsets.set(p, 8 + i * 4));
        const paramCount = params.length;
        Array.from(this.locals.keys()).forEach((name, i) => {
            if (!this.localOffsets.has(name))
                this.localOffsets.set(name, 8 + (paramCount + i) * 4);
        });
        const totalSize = (2 + this.localOffsets.size) * 4;
        const locals = [[1, TYPE_I32]]; // (local $ptr i32)
        const ptrIdx = params.length;
        const bytes = [
            OP_GLOBAL_GET,
            0,
            OP_LOCAL_SET,
            ...this.encodeUnsignedLEB128(ptrIdx),
            OP_GLOBAL_GET,
            0,
            OP_I32_CONST,
            ...this.encodeSignedLEB128(totalSize),
            OP_I32_ADD,
            OP_GLOBAL_SET,
            0,
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(ptrIdx),
            OP_I32_CONST,
            ...this.encodeSignedLEB128(funcId),
            OP_I32_STORE,
            2,
            0,
            OP_LOCAL_GET,
            ...this.encodeUnsignedLEB128(ptrIdx),
            OP_I32_CONST,
            4,
            OP_I32_ADD,
            OP_I32_CONST,
            0,
            OP_I32_STORE,
            2,
            0,
        ];
        params.forEach((p, i) => {
            bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(ptrIdx), OP_I32_CONST, ...this.encodeSignedLEB128(this.localOffsets.get(p)), OP_I32_ADD, OP_LOCAL_GET, ...this.encodeUnsignedLEB128(i), OP_I32_STORE, 2, 0);
        });
        bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(ptrIdx), OP_END);
        const localPart = this.encodeVector(locals);
        return [
            ...this.encodeUnsignedLEB128(localPart.length + bytes.length),
            ...localPart,
            ...bytes,
        ];
    }
    emitGeneratorWorkerBinary(node) {
        this.isCompilingGenerator = true;
        this.nextStateId = 0;
        this.nodeToStateId.clear();
        this.stateAfterId.clear();
        this.preScanStates(node.body);
        this.tempLocals = ["gen_ptr", "state"];
        this.localIndex = 0; // gen_ptr is 0, state is 1
        const flatStatements = [];
        const collect = (nodes) => {
            for (const n of nodes) {
                flatStatements.push(n);
                switch (n.type) {
                    case "If":
                        collect(n.thenBranch);
                        if (n.elseBranch)
                            collect(n.elseBranch);
                        break;
                    case "While":
                        collect(n.body);
                        break;
                    case "For":
                        collect(n.body);
                        break;
                    case "DoWhile":
                        collect(n.body);
                        break;
                }
            }
        };
        collect(node.body);
        const bodyBytes = [
            OP_LOCAL_GET,
            0, // gen_ptr
            OP_I32_CONST,
            4,
            OP_I32_ADD,
            OP_I32_LOAD,
            2,
            0,
            OP_LOCAL_SET,
            1, // state
            OP_LOOP,
            TYPE_EMPTY,
        ];
        flatStatements.forEach((stmt) => {
            bodyBytes.push(...this.emitStatementBinary(stmt));
        });
        bodyBytes.push(OP_END); // loop
        bodyBytes.push(OP_LOCAL_GET, 0, OP_I32_CONST, 4, OP_I32_ADD, OP_I32_CONST, ...this.encodeSignedLEB128(-1), OP_I32_STORE, 2, 0, OP_I32_CONST, 0, OP_END);
        const localDecls = [];
        if (this.tempLocals.length > 1) {
            // Local 0 is state, Local 1+ are temps.
            // Total locals = tempLocals.length - 1 (skipping gen_ptr which is param 0)
            localDecls.push([
                ...this.encodeUnsignedLEB128(this.tempLocals.length - 1),
                TYPE_I32,
            ]);
        }
        this.isCompilingGenerator = false;
        const localPart = this.encodeVector(localDecls);
        return [
            ...this.encodeUnsignedLEB128(localPart.length + bodyBytes.length),
            ...localPart,
            ...bodyBytes,
        ];
    }
    emitFunctionBinary(node) {
        this.locals.clear();
        this.localIndex = 0;
        this.tempLocals = [];
        this.withStack = [];
        for (const p of node.params)
            this.locals.set(p, this.localIndex++);
        const localTypes = [];
        const scanNode = (n) => {
            if (!n)
                return;
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
                    if (typeof n.callee !== "string")
                        scanNode(n.callee);
                    n.args.forEach(scanNode);
                    break;
                case "If":
                    scanNode(n.condition);
                    n.thenBranch.forEach(scanNode);
                    if (n.elseBranch)
                        n.elseBranch.forEach(scanNode);
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
                    if (n.iterable)
                        scanNode(n.iterable);
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
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
                        if (typeof p !== "string")
                            scanNode(p);
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
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "DictComprehension":
                    scanNode(n.iterable);
                    scanNode(n.key);
                    scanNode(n.value);
                    if (n.condition)
                        scanNode(n.condition);
                    break;
                case "Subscript":
                    scanNode(n.value);
                    scanNode(n.index);
                    break;
                case "Slice":
                    if (n.start)
                        scanNode(n.start);
                    if (n.stop)
                        scanNode(n.stop);
                    if (n.step)
                        scanNode(n.step);
                    break;
                case "With":
                    if (n.target && !this.locals.has(n.target)) {
                        this.locals.set(n.target, this.localIndex++);
                        localTypes.push(TYPE_I32);
                    }
                    scanNode(n.expression);
                    n.body.forEach(scanNode);
                    break;
                case "MemberAccess":
                    scanNode(n.object);
                    break;
            }
        };
        node.body.forEach(scanNode);
        const body = [];
        for (const stmt of node.body)
            body.push(...this.emitStatementBinary(stmt));
        body.push(OP_I32_CONST, 0, OP_END);
        // After emission, we know how many tempLocals were allocated
        this.tempLocals.forEach(() => localTypes.push(TYPE_I32));
        const localDecls = localTypes.length > 0
            ? [
                ...this.encodeUnsignedLEB128(1),
                ...this.encodeUnsignedLEB128(localTypes.length),
                TYPE_I32,
            ]
            : [...this.encodeUnsignedLEB128(0)];
        const fullFunc = [...localDecls, ...body];
        return [...this.encodeUnsignedLEB128(fullFunc.length), ...fullFunc];
    }
    emitStatementBinary(node) {
        if (this.isCompilingGenerator) {
            const myId = this.nodeToStateId.get(node);
            const afterId = this.stateAfterId.get(node);
            const genPtrIdx = 0; // parameter
            const stateIdx = 1; // local
            const bytes = [
                OP_LOCAL_GET,
                ...this.encodeUnsignedLEB128(stateIdx),
                OP_I32_CONST,
                ...this.encodeSignedLEB128(myId),
                OP_I32_EQ,
                OP_IF,
                TYPE_EMPTY,
            ];
            switch (node.type) {
                case "Yield":
                    const tmp = this.allocateTempLocal();
                    const tmpIdx = this.getTempLocalIndex(tmp);
                    bytes.push(...this.emitExpressionBinary(node.value), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(tmpIdx), OP_LOCAL_GET, ...this.encodeUnsignedLEB128(genPtrIdx), OP_I32_CONST, 4, OP_I32_ADD, OP_I32_CONST, ...this.encodeSignedLEB128(afterId), OP_I32_STORE, 2, 0, OP_LOCAL_GET, ...this.encodeUnsignedLEB128(tmpIdx), OP_RETURN);
                    break;
                case "Assignment":
                    const offset = this.localOffsets.get(node.target);
                    bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(genPtrIdx), OP_I32_CONST, ...this.encodeSignedLEB128(offset), OP_I32_ADD, ...this.emitExpressionBinary(node.value), OP_I32_STORE, 2, 0, OP_I32_CONST, ...this.encodeSignedLEB128(afterId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_BR, 1);
                    break;
                case "While": {
                    const firstInBodyId = this.nodeToStateId.get(node.body[0]) ?? afterId;
                    bytes.push(...this.emitExpressionBinary(node.condition), OP_IF, TYPE_EMPTY, OP_I32_CONST, ...this.encodeSignedLEB128(firstInBodyId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_ELSE, OP_I32_CONST, ...this.encodeSignedLEB128(afterId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_END, OP_BR, 1);
                    break;
                }
                case "If": {
                    const thenId = this.nodeToStateId.get(node.thenBranch[0]) ?? afterId;
                    const elseId = node.elseBranch && node.elseBranch.length > 0
                        ? this.nodeToStateId.get(node.elseBranch[0])
                        : afterId;
                    bytes.push(...this.emitExpressionBinary(node.condition), OP_IF, TYPE_EMPTY, OP_I32_CONST, ...this.encodeSignedLEB128(thenId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_ELSE, OP_I32_CONST, ...this.encodeSignedLEB128(elseId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_END, OP_BR, 1);
                    break;
                }
                case "Pass":
                    bytes.push(OP_I32_CONST, ...this.encodeSignedLEB128(afterId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_BR, 1);
                    break;
                case "Return":
                    bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(genPtrIdx), OP_I32_CONST, 4, OP_I32_ADD, OP_I32_CONST, ...this.encodeSignedLEB128(-1), OP_I32_STORE, 2, 0, OP_I32_CONST, 0, OP_RETURN);
                    break;
                case "For":
                case "DoWhile":
                    throw new Error(`Generator functions do not yet support ${node.type} loops. Use while loops instead.`);
                default:
                    const expr = this.emitExpressionBinary(node);
                    if (expr.length > 0) {
                        bytes.push(...expr, OP_DROP, OP_I32_CONST, ...this.encodeSignedLEB128(afterId), OP_LOCAL_SET, ...this.encodeUnsignedLEB128(stateIdx), OP_BR, 1);
                    }
                    else {
                        throw new Error(`Unhandled statement type in generator: ${node.type}`);
                    }
            }
            bytes.push(OP_END);
            return bytes;
        }
        switch (node.type) {
            case "Return": {
                const bytes = [...this.emitExpressionBinary(node.value)];
                if (this.withStack.length > 0) {
                    const tmp = this.allocateTempLocal();
                    const tmpIdx = this.getTempLocalIndex(tmp);
                    bytes.push(OP_LOCAL_SET, ...this.encodeUnsignedLEB128(tmpIdx));
                    for (let i = this.withStack.length - 1; i >= 0; i--) {
                        const exitIdx = this.functionMap.get("__exit__");
                        if (exitIdx !== undefined) {
                            const mgrIdx = this.getTempLocalIndex(this.withStack[i]);
                            bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(mgrIdx), OP_I32_CONST, 0, OP_I32_CONST, 0, OP_I32_CONST, 0, OP_CALL, ...this.encodeUnsignedLEB128(exitIdx), OP_DROP);
                        }
                    }
                    bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(tmpIdx));
                }
                bytes.push(OP_RETURN);
                return bytes;
            }
            case "With": {
                const withNode = node;
                const mgrLocal = this.allocateTempLocal();
                const mgrIdx = this.getTempLocalIndex(mgrLocal);
                this.withStack.push(mgrLocal);
                const bytes = [
                    ...this.emitExpressionBinary(withNode.expression),
                    OP_LOCAL_SET,
                    ...this.encodeUnsignedLEB128(mgrIdx),
                ];
                // Call __enter__
                const enterIdx = this.functionMap.get("__enter__");
                if (enterIdx === undefined)
                    throw new Error("Context manager requires __enter__ function");
                bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(mgrIdx), OP_CALL, ...this.encodeUnsignedLEB128(enterIdx));
                if (withNode.target) {
                    bytes.push(OP_LOCAL_SET, ...this.encodeUnsignedLEB128(this.locals.get(withNode.target)));
                }
                else {
                    bytes.push(OP_DROP);
                }
                // Body
                bytes.push(...withNode.body.flatMap((s) => this.emitStatementBinary(s)));
                // Call __exit__
                const exitIdx = this.functionMap.get("__exit__");
                if (exitIdx === undefined)
                    throw new Error("Context manager requires __exit__ function");
                bytes.push(OP_LOCAL_GET, ...this.encodeUnsignedLEB128(mgrIdx), OP_I32_CONST, 0, OP_I32_CONST, 0, OP_I32_CONST, 0, OP_CALL, ...this.encodeUnsignedLEB128(exitIdx), OP_DROP);
                this.withStack.pop();
                return bytes;
            }
            case "Assignment":
                return [
                    ...this.emitExpressionBinary(node.value),
                    OP_LOCAL_SET,
                    ...this.encodeUnsignedLEB128(this.locals.get(node.target)),
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
                    const iterIdx = this.locals.get(node.iterator);
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
                }
                else if (node.iterable) {
                    const iterIdx = this.locals.get(node.iterator);
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
    emitExpressionBinary(node) {
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
                    const bytes = [
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
                        bytes.push(OP_LOCAL_GET, // local.get tmp0
                        ...this.encodeUnsignedLEB128(tmp0Idx), OP_I32_CONST, // i32.const (i+1)*4
                        ...this.encodeSignedLEB128((i + 1) * 4), OP_I32_ADD, // i32.add
                        OP_I32_CONST, // i32.const charCode
                        ...this.encodeSignedLEB128(str.charCodeAt(i)), OP_I32_STORE, // i32.store
                        2, 0);
                    bytes.push(OP_LOCAL_GET, // local.get tmp0
                    ...this.encodeUnsignedLEB128(tmp0Idx));
                    return bytes;
                }
                return [];
            case "List": {
                const length = node.elements.length;
                const size = (length + 1) * 4;
                const tmp0 = this.allocateTempLocal();
                const tmp0Idx = this.getTempLocalIndex(tmp0);
                const listBytes = [
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
                    listBytes.push(OP_LOCAL_GET, // local.get tmp0
                    ...this.encodeUnsignedLEB128(tmp0Idx), OP_I32_CONST, // i32.const (i+1)*4
                    ...this.encodeSignedLEB128((i + 1) * 4), OP_I32_ADD);
                    listBytes.push(...this.emitExpressionBinary(el));
                    listBytes.push(OP_I32_STORE, // i32.store
                    2, 0);
                });
                listBytes.push(OP_LOCAL_GET, // local.get tmp0
                ...this.encodeUnsignedLEB128(tmp0Idx));
                return listBytes;
            }
            case "Subscript":
                const base = this.emitExpressionBinary(node.value);
                if (node.index.type === "Slice") {
                    const slice = node.index;
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
                        ...this.encodeUnsignedLEB128(this.functionMap.get("_slice")),
                    ];
                }
                return [
                    ...base,
                    ...this.emitExpressionBinary(node.index),
                    OP_CALL,
                    ...this.encodeUnsignedLEB128(this.functionMap.get("_get_item")),
                ];
            case "Identifier":
                if (this.isCompilingGenerator && this.localOffsets.has(node.name)) {
                    const offset = this.localOffsets.get(node.name);
                    return [
                        OP_LOCAL_GET,
                        0, // gen_ptr is param 0
                        OP_I32_CONST,
                        ...this.encodeSignedLEB128(offset),
                        OP_I32_ADD,
                        OP_I32_LOAD,
                        2,
                        0,
                    ];
                }
                return [
                    OP_LOCAL_GET,
                    ...this.encodeUnsignedLEB128(this.locals.get(node.name)),
                ];
            case "ListComprehension": {
                const itemLocalIdx = this.locals.get(node.item);
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
                const itemLocalIdx = this.locals.get(node.item);
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
                    const isString = (n) => (n.type === "Literal" && typeof n.value === "string") ||
                        n.type === "FString";
                    if (isString(node.left) || isString(node.right)) {
                        return [
                            ...this.emitExpressionBinary(node.left),
                            ...this.emitExpressionBinary(node.right),
                            OP_CALL,
                            ...this.encodeUnsignedLEB128(this.functionMap.get("concat")),
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
                const argsBytes = node.args
                    .map((a) => this.emitExpressionBinary(a))
                    .flat();
                if (typeof node.callee === "string") {
                    const calleeIdx = this.functionMap.get(node.callee);
                    if (node.callee === "next" && node.args.length === 1) {
                        return [
                            ...this.emitExpressionBinary(node.args[0]),
                            OP_CALL,
                            7, // next dispatcher is at 7
                        ];
                    }
                    if (calleeIdx === undefined) {
                        throw new Error(`Undefined function: ${node.callee}`);
                    }
                    if (node.callee === "print" && node.args.length === 1) {
                        const arg = node.args[0];
                        if ((arg.type === "Literal" && typeof arg.value === "string") ||
                            arg.type === "FString") {
                            return [
                                ...argsBytes,
                                OP_CALL,
                                ...this.encodeUnsignedLEB128(this.functionMap.get("print_str")),
                            ];
                        }
                    }
                    return [
                        ...argsBytes,
                        OP_CALL,
                        ...this.encodeUnsignedLEB128(calleeIdx),
                    ];
                }
                else {
                    if (node.callee.type === "MemberAccess") {
                        const ma = node.callee;
                        const funcIdx = this.functionMap.get(ma.member);
                        if (funcIdx === undefined) {
                            throw new Error(`Undefined method/function: ${ma.member}`);
                        }
                        return [
                            ...this.emitExpressionBinary(ma.object),
                            ...argsBytes,
                            OP_CALL,
                            ...this.encodeUnsignedLEB128(funcIdx),
                        ];
                    }
                    throw new Error(`Dynamic calls on ${node.callee.type} are not yet supported`);
                }
            }
            case "MemberAccess":
                throw new Error("Member access without call is not yet supported");
            case "FString": {
                const bytes = [];
                node.parts.forEach((part, i) => {
                    if (typeof part === "string") {
                        bytes.push(...this.emitExpressionBinary({
                            type: "Literal",
                            value: part,
                        }));
                    }
                    else {
                        bytes.push(...this.emitExpressionBinary(part), OP_CALL, ...this.encodeUnsignedLEB128(this.functionMap.get("itoa")));
                    }
                    if (i > 0) {
                        bytes.push(OP_CALL, ...this.encodeUnsignedLEB128(this.functionMap.get("concat")));
                    }
                });
                return bytes;
            }
            default:
                return [];
        }
    }
    encodeUnsignedLEB128(n) {
        const buffer = [];
        do {
            let byte = n & 0x7f;
            n >>>= 7;
            if (n !== 0)
                byte |= 0x80;
            buffer.push(byte);
        } while (n !== 0);
        return buffer;
    }
    encodeSignedLEB128(n) {
        const buffer = [];
        while (true) {
            const byte = n & 0x7f;
            n >>= 7;
            if ((n === 0 && (byte & 0x40) === 0) ||
                (n === -1 && (byte & 0x40) !== 0)) {
                buffer.push(byte);
                break;
            }
            else {
                buffer.push(byte | 0x80);
            }
        }
        return buffer;
    }
}
