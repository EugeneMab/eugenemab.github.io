export class Compiler {
    locals = new Map();
    localIndex = 0;
    functionMap = new Map();
    tempLocal = 0;
    comprehensionLocals = new Map();
    watLocalCount = 0;
    compileWAT(program) {
        this.functionMap.clear();
        this.functionMap.set("print", 0);
        this.functionMap.set("sleep", 1);
        this.functionMap.set("_get_item", 2);
        this.functionMap.set("_slice", 3);
        const userFunctions = program.body.filter((n) => n.type === "FunctionDef");
        userFunctions.forEach((f, i) => this.functionMap.set(f.name, 4 + i));
        let wat = `(module\n`;
        wat += `  (import "env" "print" (func $print (param i32) (result i32)))\n`;
        wat += `  (import "env" "sleep" (func $sleep (param i32) (result i32)))\n`;
        wat += `  (memory (export "memory") 1)\n`;
        wat += `  (global $heap_ptr (mut i32) (i32.const 1024))\n`;
        wat += this.emitGetItemWAT();
        wat += this.emitSliceWAT();
        for (const node of program.body) {
            if (node.type === "FunctionDef") {
                wat += this.emitFunctionWAT(node);
            }
        }
        wat += `)\n`;
        return wat;
    }
    emitGetItemWAT() {
        return `  (func $_get_item (param $base i32) (param $index i32) (result i32)
    (local $len i32)
    local.get $base
    i32.load
    local.set $len
    local.get $index
    i32.const 0
    i32.lt_s
    if (result i32)
      local.get $len
      local.get $index
      i32.add
    else
      local.get $index
    end
    local.set $index
    local.get $index
    i32.const 0
    i32.lt_s
    local.get $index
    local.get $len
    i32.ge_s
    i32.or
    if
      unreachable
    end
    local.get $base
    local.get $index
    i32.const 4
    i32.mul
    i32.add
    i32.const 4
    i32.add
    i32.load
  )\n`;
    }
    emitSliceWAT() {
        return `  (func $_slice (param $base i32) (param $start i32) (param $stop i32) (param $step i32) (result i32)
    (local $len i32) (local $new_len i32) (local $i i32) (local $new_ptr i32) (local $cur i32)
    local.get $base
    i32.load
    local.set $len
    ;; Step default
    local.get $step
    i32.const 2147483647
    i32.eq
    if
      i32.const 1
      local.set $step
    end
    ;; Start default
    local.get $start
    i32.const 2147483647
    i32.eq
    if
      local.get $step
      i32.const 0
      i32.gt_s
      if
        i32.const 0
        local.set $start
      else
        local.get $len
        i32.const 1
        i32.sub
        local.set $start
      end
    end
    ;; Stop default
    local.get $stop
    i32.const 2147483647
    i32.eq
    if
      local.get $step
      i32.const 0
      i32.gt_s
      if
        local.get $len
        local.set $stop
      else
        i32.const -1
        local.set $stop
      end
    end
    ;; Normalize
    local.get $start
    i32.const 0
    i32.lt_s
    if
      local.get $start
      local.get $len
      i32.add
      local.set $start
    end
    local.get $stop
    i32.const 0
    i32.lt_s
    if
      local.get $stop
      local.get $len
      i32.add
      local.set $stop
    end
    ;; Clamp
    local.get $start
    i32.const 0
    i32.lt_s
    if
      i32.const 0
      local.set $start
    end
    local.get $start
    local.get $len
    i32.gt_s
    if
      local.get $len
      local.set $start
    end
    local.get $stop
    i32.const -1
    i32.lt_s
    if
      i32.const -1
      local.set $stop
    end
    local.get $stop
    local.get $len
    i32.gt_s
    if
      local.get $len
      local.set $stop
    end
    ;; Calculate new_len
    i32.const 0
    local.set $new_len
    local.get $step
    i32.const 0
    i32.gt_s
    if
      local.get $stop
      local.get $start
      i32.gt_s
      if
        local.get $stop
        local.get $start
        i32.sub
        local.get $step
        i32.add
        i32.const 1
        i32.sub
        local.get $step
        i32.div_s
        local.set $new_len
      end
    else
      local.get $start
      local.get $stop
      i32.gt_s
      if
        local.get $start
        local.get $stop
        i32.sub
        i32.const 0
        local.get $step
        i32.sub
        i32.add
        i32.const 1
        i32.sub
        i32.const 0
        local.get $step
        i32.sub
        i32.div_s
        local.set $new_len
      end
    end
    ;; Alloc
    global.get $heap_ptr
    local.set $new_ptr
    global.get $heap_ptr
    local.get $new_len
    i32.const 1
    i32.add
    i32.const 4
    i32.mul
    i32.add
    global.set $heap_ptr
    local.get $new_ptr
    local.get $new_len
    i32.store
    ;; Copy
    i32.const 0
    local.set $i
    local.get $start
    local.set $cur
    block
      loop
        local.get $i
        local.get $new_len
        i32.ge_s
        br_if 1
        local.get $new_ptr
        local.get $i
        i32.const 4
        i32.mul
        i32.add
        i32.const 4
        i32.add
        local.get $base
        local.get $cur
        i32.const 4
        i32.mul
        i32.add
        i32.const 4
        i32.add
        i32.load
        i32.store
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        local.get $cur
        local.get $step
        i32.add
        local.set $cur
        br 0
      end
    end
    local.get $new_ptr
  )\n`;
    }
    emitFunctionWAT(node) {
        this.locals.clear();
        this.comprehensionLocals.clear();
        this.localIndex = 0;
        this.watLocalCount = 0;
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
            if (n.type === "ListComprehension" || n.type === "DictComprehension") {
                if (!this.locals.has(n.item)) {
                    this.locals.set(n.item, this.localIndex++);
                    localDecls.push(`(local $${n.item} i32)`);
                }
                // Add some unnamed locals for WAT if needed, but we'll use a count
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
                case "Return":
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
        // Add generic locals for WAT emission of complex structures
        for (let i = 0; i < 10; i++) {
            localDecls.push(`(local $__tmp${i} i32)`);
        }
        const bodyLines = [];
        for (const stmt of node.body) {
            const stmtWat = this.emitStatementWAT(stmt);
            if (stmtWat)
                bodyLines.push(...stmtWat.split("\n"));
        }
        const allLines = [...localDecls, ...bodyLines].filter((line) => line.trim().length > 0);
        const paramsPart = paramsWAT ? " " + paramsWAT : "";
        const resultPart = allLines.some((l) => l.trim() === "return")
            ? ""
            : "\n    i32.const 0";
        return (`  (func $${node.name}${paramsPart} (result i32)\n` +
            `    ${allLines.join("\n    ")}${resultPart}\n` +
            `  )\n` +
            `  (export "${node.name}" (func $${node.name}))\n`);
    }
    emitStatementWAT(node) {
        switch (node.type) {
            case "Return":
                return this.emitExpressionWAT(node.value) + "\nreturn";
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
                    let wat = `global.get $heap_ptr\nlocal.set $__tmp0\n`;
                    wat += `local.get $__tmp0\ni32.const ${str.length}\ni32.store\n`;
                    for (let i = 0; i < str.length; i++) {
                        wat += `local.get $__tmp0\ni32.const ${(i + 1) * 4}\ni32.add\ni32.const ${str.charCodeAt(i)}\ni32.store\n`;
                    }
                    wat += `global.get $heap_ptr\ni32.const ${(str.length + 1) * 4}\ni32.add\nglobal.set $heap_ptr\n`;
                    wat += `local.get $__tmp0`;
                    return wat;
                }
                return `i32.const ${node.value === true ? 1 : node.value === false ? 0 : node.value}`;
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
                        return (this.emitExpressionWAT(node.left) +
                            `\ni32.const 0\ni32.ne\n` +
                            this.emitExpressionWAT(node.right) +
                            `\ni32.const 0\ni32.ne\ni32.and`);
                    case "or":
                        return (this.emitExpressionWAT(node.left) +
                            `\ni32.const 0\ni32.ne\n` +
                            this.emitExpressionWAT(node.right) +
                            `\ni32.const 0\ni32.ne\ni32.or`);
                }
                return (this.emitExpressionWAT(node.left) +
                    "\n" +
                    this.emitExpressionWAT(node.right) +
                    "\n" +
                    op);
            case "UnaryExpression":
                if (node.operator === "-")
                    return (`i32.const 0\n` +
                        this.emitExpressionWAT(node.argument) +
                        `\ni32.sub`);
                if (node.operator === "not")
                    return this.emitExpressionWAT(node.argument) + `\ni32.eqz`;
                return this.emitExpressionWAT(node.argument);
            case "CallExpression":
                return (node.args.map((a) => this.emitExpressionWAT(a)).join("\n") +
                    `\ncall $${node.callee}`);
            case "List": {
                let wat = `global.get $heap_ptr\nlocal.set $__tmp0\n`;
                const len = node.elements.length;
                wat += `local.get $__tmp0\ni32.const ${len}\ni32.store\n`;
                node.elements.forEach((el, i) => {
                    wat +=
                        `local.get $__tmp0\ni32.const ${(i + 1) * 4}\ni32.add\n` +
                            this.emitExpressionWAT(el) +
                            `\ni32.store\n`;
                });
                wat += `global.get $heap_ptr\ni32.const ${(len + 1) * 4}\ni32.add\nglobal.set $heap_ptr\n`;
                wat += `local.get $__tmp0`;
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
                // Use $__tmp1: iter_ptr, $__tmp2: iter_len, $__tmp3: res_ptr, $__tmp4: count, $__tmp5: i
                let wat = this.emitExpressionWAT(node.iterable) + `\nlocal.set $__tmp1\n`;
                wat += `local.get $__tmp1\ni32.load\nlocal.set $__tmp2\n`;
                wat += `global.get $heap_ptr\nlocal.set $__tmp3\n`;
                wat += `local.get $__tmp3\ni32.const 0\ni32.store\n`;
                wat += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                wat += `i32.const 0\nlocal.set $__tmp4\n`;
                wat += `i32.const 0\nlocal.set $__tmp5\n`;
                let loopBody = `local.get $__tmp5\nlocal.get $__tmp2\ni32.ge_s\nbr_if 1\n`;
                loopBody += `local.get $__tmp1\nlocal.get $__tmp5\ni32.const 4\ni32.mul\ni32.add\ni32.const 4\ni32.add\ni32.load\nlocal.set $${node.item}\n`;
                let action = `global.get $heap_ptr\n` +
                    this.emitExpressionWAT(node.expression) +
                    `\ni32.store\n`;
                action += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                action += `local.get $__tmp4\ni32.const 1\ni32.add\nlocal.set $__tmp4`;
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
                loopBody += `local.get $__tmp5\ni32.const 1\ni32.add\nlocal.set $__tmp5\nbr 0`;
                wat += `block\n  loop\n${this.indent(this.indent(loopBody))}\n  end\nend\n`;
                wat += `local.get $__tmp3\nlocal.get $__tmp4\ni32.store\n`;
                wat += `local.get $__tmp3`;
                return wat;
            }
            case "DictComprehension": {
                let wat = this.emitExpressionWAT(node.iterable) + `\nlocal.set $__tmp1\n`;
                wat += `local.get $__tmp1\ni32.load\nlocal.set $__tmp2\n`;
                wat += `global.get $heap_ptr\nlocal.set $__tmp3\n`;
                wat += `local.get $__tmp3\ni32.const 0\ni32.store\n`;
                wat += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                wat += `i32.const 0\nlocal.set $__tmp4\n`;
                wat += `i32.const 0\nlocal.set $__tmp5\n`;
                let loopBody = `local.get $__tmp5\nlocal.get $__tmp2\ni32.ge_s\nbr_if 1\n`;
                loopBody += `local.get $__tmp1\nlocal.get $__tmp5\ni32.const 4\ni32.mul\ni32.add\ni32.const 4\ni32.add\ni32.load\nlocal.set $${node.item}\n`;
                let action = `global.get $heap_ptr\n` +
                    this.emitExpressionWAT(node.key) +
                    `\ni32.store\n`;
                action += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                action +=
                    `global.get $heap_ptr\n` +
                        this.emitExpressionWAT(node.value) +
                        `\ni32.store\n`;
                action += `global.get $heap_ptr\ni32.const 4\ni32.add\nglobal.set $heap_ptr\n`;
                action += `local.get $__tmp4\ni32.const 1\ni32.add\nlocal.set $__tmp4`;
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
                loopBody += `local.get $__tmp5\ni32.const 1\ni32.add\nlocal.set $__tmp5\nbr 0`;
                wat += `block\n  loop\n${this.indent(this.indent(loopBody))}\n  end\nend\n`;
                wat += `local.get $__tmp3\nlocal.get $__tmp4\ni32.store\n`;
                wat += `local.get $__tmp3`;
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
        this.functionMap.set("_get_item", 2);
        this.functionMap.set("_slice", 3);
        const userFunctions = program.body.filter((n) => n.type === "FunctionDef");
        userFunctions.forEach((f, i) => this.functionMap.set(f.name, 4 + i));
        const types = [];
        types.push([0x60, 1, 0x7f, 1, 0x7f]);
        types.push([0x60, 2, 0x7f, 0x7f, 1, 0x7f]);
        types.push([0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f]);
        const userFuncTypeIndices = [];
        for (const f of userFunctions) {
            const type = [
                0x60,
                ...this.encodeUnsignedLEB128(f.params.length),
                ...new Array(f.params.length).fill(0x7f),
                1,
                0x7f,
            ];
            let idx = types.findIndex((t) => JSON.stringify(t) === JSON.stringify(type));
            if (idx === -1) {
                idx = types.length;
                types.push(type);
            }
            userFuncTypeIndices.push(idx);
        }
        const typeSection = this.createSection(1, [this.encodeVector(types)]);
        const importSection = this.createSection(2, [
            this.encodeVector([
                [...this.encodeString("env"), ...this.encodeString("print"), 0x00, 0],
                [...this.encodeString("env"), ...this.encodeString("sleep"), 0x00, 0],
            ]),
        ]);
        const funcSection = this.createSection(3, [
            this.encodeVector([1, 2, ...userFuncTypeIndices].map((i) => [i])),
        ]);
        const memorySection = this.createSection(5, [
            this.encodeVector([[0x00, 1]]),
        ]);
        const globalSection = this.createSection(6, [
            this.encodeVector([
                [0x7f, 0x01, 0x41, ...this.encodeSignedLEB128(1024), 0x0b],
            ]),
        ]);
        const exports = [];
        userFunctions.forEach((f, i) => exports.push([
            ...this.encodeString(f.name),
            0x00,
            ...this.encodeUnsignedLEB128(4 + i),
        ]));
        exports.push([...this.encodeString("memory"), 0x02, 0]);
        const exportSection = this.createSection(7, [this.encodeVector(exports)]);
        const codes = [
            this.emitGetItemBinary(),
            this.emitSliceBinary(),
            ...userFunctions.map((f) => this.emitFunctionBinary(f)),
        ];
        const codeSection = this.createSection(10, [this.encodeVector(codes)]);
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
    encodeString(s) {
        const bytes = new TextEncoder().encode(s);
        return [...this.encodeUnsignedLEB128(bytes.length), ...Array.from(bytes)];
    }
    emitGetItemBinary() {
        const body = [
            ...this.encodeUnsignedLEB128(1),
            ...this.encodeUnsignedLEB128(1),
            0x7f,
            0x20,
            0,
            0x28,
            2,
            0,
            0x21,
            2,
            0x20,
            1,
            0x41,
            0,
            0x48,
            0x04,
            0x7f,
            0x20,
            2,
            0x20,
            1,
            0x6a,
            0x05,
            0x20,
            1,
            0x0b,
            0x21,
            1,
            0x20,
            1,
            0x41,
            0,
            0x48,
            0x20,
            1,
            0x20,
            2,
            0x4e,
            0x72,
            0x04,
            0x40,
            0x00,
            0x0b,
            0x20,
            0,
            0x20,
            1,
            0x41,
            4,
            0x6c,
            0x6a,
            0x41,
            4,
            0x6a,
            0x28,
            2,
            0,
            0x0b,
        ];
        return [...this.encodeUnsignedLEB128(body.length), ...body];
    }
    emitSliceBinary() {
        const body = [
            ...this.encodeUnsignedLEB128(1),
            ...this.encodeUnsignedLEB128(5),
            0x7f,
            0x20,
            0,
            0x28,
            2,
            0,
            0x21,
            4,
            0x20,
            3,
            0x41,
            ...this.encodeSignedLEB128(0x7fffffff),
            0x46,
            0x04,
            0x40,
            0x41,
            1,
            0x21,
            3,
            0x0b,
            0x20,
            1,
            0x41,
            ...this.encodeSignedLEB128(0x7fffffff),
            0x46,
            0x04,
            0x40,
            0x20,
            3,
            0x41,
            0,
            0x4a,
            0x04,
            0x40,
            0x41,
            0,
            0x21,
            1,
            0x05,
            0x20,
            4,
            0x41,
            1,
            0x6b,
            0x21,
            1,
            0x0b,
            0x0b,
            0x20,
            2,
            0x41,
            ...this.encodeSignedLEB128(0x7fffffff),
            0x46,
            0x04,
            0x40,
            0x20,
            3,
            0x41,
            0,
            0x4a,
            0x04,
            0x40,
            0x20,
            4,
            0x21,
            2,
            0x05,
            0x41,
            ...this.encodeSignedLEB128(-1),
            0x21,
            2,
            0x0b,
            0x0b,
            0x20,
            1,
            0x41,
            0,
            0x48,
            0x04,
            0x40,
            0x20,
            1,
            0x20,
            4,
            0x6a,
            0x21,
            1,
            0x0b,
            0x20,
            2,
            0x41,
            0,
            0x48,
            0x04,
            0x40,
            0x20,
            2,
            0x20,
            4,
            0x6a,
            0x21,
            2,
            0x0b,
            0x20,
            1,
            0x41,
            0,
            0x48,
            0x04,
            0x40,
            0x41,
            0,
            0x21,
            1,
            0x0b,
            0x20,
            1,
            0x20,
            4,
            0x4a,
            0x04,
            0x40,
            0x20,
            4,
            0x21,
            1,
            0x0b,
            0x20,
            2,
            0x41,
            0,
            0x48,
            0x04,
            0x40,
            0x41,
            ...this.encodeSignedLEB128(-1),
            0x21,
            2,
            0x0b,
            0x20,
            2,
            0x20,
            4,
            0x4a,
            0x04,
            0x40,
            0x20,
            4,
            0x21,
            2,
            0x0b,
            0x41,
            0,
            0x21,
            5,
            0x20,
            3,
            0x41,
            0,
            0x4a,
            0x04,
            0x40,
            0x20,
            2,
            0x20,
            1,
            0x4a,
            0x04,
            0x40,
            0x20,
            2,
            0x20,
            1,
            0x6b,
            0x20,
            3,
            0x6a,
            0x41,
            1,
            0x6b,
            0x20,
            3,
            0x6d,
            0x21,
            5,
            0x0b,
            0x05,
            0x20,
            1,
            0x20,
            2,
            0x4a,
            0x04,
            0x40,
            0x20,
            1,
            0x20,
            2,
            0x6b,
            0x41,
            0,
            0x20,
            3,
            0x6b,
            0x6a,
            0x41,
            1,
            0x6b,
            0x41,
            0,
            0x20,
            3,
            0x6b,
            0x6d,
            0x21,
            5,
            0x0b,
            0x0b,
            0x23,
            0,
            0x21,
            7,
            0x23,
            0,
            0x20,
            5,
            0x41,
            1,
            0x6a,
            0x41,
            4,
            0x6c,
            0x6a,
            0x24,
            0,
            0x20,
            7,
            0x20,
            5,
            0x36,
            2,
            0,
            0x41,
            0,
            0x21,
            6,
            0x20,
            1,
            0x21,
            8,
            0x02,
            0x40,
            0x03,
            0x40,
            0x20,
            6,
            0x20,
            5,
            0x4e,
            0x0d,
            1,
            0x20,
            7,
            0x20,
            6,
            0x41,
            4,
            0x6c,
            0x6a,
            0x41,
            4,
            0x6a,
            0x20,
            0,
            0x20,
            8,
            0x41,
            4,
            0x6c,
            0x6a,
            0x41,
            4,
            0x6a,
            0x28,
            2,
            0,
            0x36,
            2,
            0,
            0x20,
            6,
            0x41,
            1,
            0x6a,
            0x21,
            6,
            0x20,
            8,
            0x20,
            3,
            0x6a,
            0x21,
            8,
            0x0c,
            0,
            0x0b,
            0x0b,
            0x20,
            7,
            0x0b,
        ];
        return [...this.encodeUnsignedLEB128(body.length), ...body];
    }
    emitFunctionBinary(node) {
        this.locals.clear();
        this.comprehensionLocals.clear();
        this.localIndex = 0;
        for (const p of node.params)
            this.locals.set(p, this.localIndex++);
        const localTypes = [];
        const scanNode = (n) => {
            if (!n)
                return;
            if (n.type === "Assignment" && !this.locals.has(n.target)) {
                this.locals.set(n.target, this.localIndex++);
                localTypes.push(0x7f);
            }
            if (n.type === "ListComprehension" || n.type === "DictComprehension") {
                if (!this.locals.has(n.item)) {
                    this.locals.set(n.item, this.localIndex++);
                    localTypes.push(0x7f);
                }
                this.comprehensionLocals.set(n, this.localIndex);
                this.localIndex += 5;
                for (let i = 0; i < 5; i++)
                    localTypes.push(0x7f);
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
                    if (n.elseBranch)
                        n.elseBranch.forEach(scanNode);
                    break;
                case "While":
                    scanNode(n.condition);
                    n.body.forEach(scanNode);
                    break;
                case "Return":
                    scanNode(n.value);
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
            }
        };
        node.body.forEach(scanNode);
        this.tempLocal = this.localIndex;
        this.localIndex += 2;
        localTypes.push(0x7f, 0x7f);
        const localDecls = localTypes.length > 0
            ? [
                ...this.encodeUnsignedLEB128(1),
                ...this.encodeUnsignedLEB128(localTypes.length),
                0x7f,
            ]
            : [...this.encodeUnsignedLEB128(0)];
        const body = [];
        for (const stmt of node.body)
            body.push(...this.emitStatementBinary(stmt));
        body.push(0x41, 0, 0x0b);
        const fullFunc = [...localDecls, ...body];
        return [...this.encodeUnsignedLEB128(fullFunc.length), ...fullFunc];
    }
    emitStatementBinary(node) {
        switch (node.type) {
            case "Return":
                return [...this.emitExpressionBinary(node.value), 0x0f];
            case "Assignment":
                return [
                    ...this.emitExpressionBinary(node.value),
                    0x21,
                    ...this.encodeUnsignedLEB128(this.locals.get(node.target)),
                ];
            case "While":
                return [
                    0x02,
                    0x40,
                    0x03,
                    0x40,
                    ...this.emitExpressionBinary(node.condition),
                    0x45,
                    0x0d,
                    1,
                    ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
                    0x0c,
                    0,
                    0x0b,
                    0x0b,
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
                    0x40,
                    ...thenBytes,
                    ...elseBytes,
                    0x0b,
                ];
            default:
                const expr = this.emitExpressionBinary(node);
                return expr.length > 0 ? [...expr, 0x1a] : [];
        }
    }
    emitExpressionBinary(node) {
        switch (node.type) {
            case "Literal":
                if (typeof node.value === "number")
                    return [0x41, ...this.encodeSignedLEB128(node.value)];
                if (typeof node.value === "boolean")
                    return [0x41, node.value ? 1 : 0];
                if (typeof node.value === "string") {
                    const str = node.value;
                    const size = (str.length + 1) * 4;
                    const bytes = [
                        0x23,
                        0,
                        0x21,
                        ...this.encodeUnsignedLEB128(this.tempLocal),
                        0x20,
                        ...this.encodeUnsignedLEB128(this.tempLocal),
                        0x41,
                        ...this.encodeSignedLEB128(str.length),
                        0x36,
                        2,
                        0,
                    ];
                    for (let i = 0; i < str.length; i++)
                        bytes.push(0x20, ...this.encodeUnsignedLEB128(this.tempLocal), 0x41, ...this.encodeSignedLEB128((i + 1) * 4), 0x6a, 0x41, ...this.encodeSignedLEB128(str.charCodeAt(i)), 0x36, 2, 0);
                    bytes.push(0x23, 0, 0x41, ...this.encodeSignedLEB128(size), 0x6a, 0x24, 0, 0x20, ...this.encodeUnsignedLEB128(this.tempLocal));
                    return bytes;
                }
                return [];
            case "List":
                const elementsBytes = [];
                node.elements.forEach((el) => elementsBytes.push(...this.emitExpressionBinary(el)));
                const length = node.elements.length;
                const size = (length + 1) * 4;
                elementsBytes.push(0x23, 0, 0x21, ...this.encodeUnsignedLEB128(this.tempLocal));
                for (let i = length - 1; i >= 0; i--)
                    elementsBytes.push(0x21, ...this.encodeUnsignedLEB128(this.tempLocal + 1), 0x20, ...this.encodeUnsignedLEB128(this.tempLocal), 0x41, ...this.encodeSignedLEB128((i + 1) * 4), 0x6a, 0x20, ...this.encodeUnsignedLEB128(this.tempLocal + 1), 0x36, 2, 0);
                elementsBytes.push(0x20, ...this.encodeUnsignedLEB128(this.tempLocal), 0x41, ...this.encodeSignedLEB128(length), 0x36, 2, 0, 0x23, 0, 0x41, ...this.encodeSignedLEB128(size), 0x6a, 0x24, 0, 0x20, ...this.encodeUnsignedLEB128(this.tempLocal));
                return elementsBytes;
            case "Subscript":
                const base = this.emitExpressionBinary(node.value);
                if (node.index.type === "Slice") {
                    const slice = node.index;
                    const start = slice.start
                        ? this.emitExpressionBinary(slice.start)
                        : [0x41, ...this.encodeSignedLEB128(0x7fffffff)];
                    const stop = slice.stop
                        ? this.emitExpressionBinary(slice.stop)
                        : [0x41, ...this.encodeSignedLEB128(0x7fffffff)];
                    const step = slice.step
                        ? this.emitExpressionBinary(slice.step)
                        : [0x41, ...this.encodeSignedLEB128(0x7fffffff)];
                    return [
                        ...base,
                        ...start,
                        ...stop,
                        ...step,
                        0x10,
                        ...this.encodeUnsignedLEB128(3),
                    ];
                }
                return [
                    ...base,
                    ...this.emitExpressionBinary(node.index),
                    0x10,
                    ...this.encodeUnsignedLEB128(2),
                ];
            case "Identifier":
                return [
                    0x20,
                    ...this.encodeUnsignedLEB128(this.locals.get(node.name)),
                ];
            case "ListComprehension": {
                const itemLocalIdx = this.locals.get(node.item);
                const baseLocalIdx = this.comprehensionLocals.get(node);
                const resLocalIdx = baseLocalIdx;
                const countLocalIdx = baseLocalIdx + 1;
                const iterPtrLocalIdx = baseLocalIdx + 2;
                const iterLenLocalIdx = baseLocalIdx + 3;
                const iLocalIdx = baseLocalIdx + 4;
                return [
                    ...this.emitExpressionBinary(node.iterable),
                    0x21,
                    ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
                    0x28,
                    2,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(iterLenLocalIdx),
                    0x23,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                    0x41,
                    0,
                    0x36,
                    2,
                    0,
                    0x23,
                    0,
                    0x41,
                    4,
                    0x6a,
                    0x24,
                    0,
                    0x41,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    0x41,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x02,
                    0x40,
                    0x03,
                    0x40,
                    0x20,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(iterLenLocalIdx),
                    0x48,
                    0x45,
                    0x0d,
                    1,
                    0x20,
                    ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x41,
                    4,
                    0x6c,
                    0x6a,
                    0x41,
                    4,
                    0x6a,
                    0x28,
                    2,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(itemLocalIdx),
                    ...(node.condition
                        ? [...this.emitExpressionBinary(node.condition), 0x04, 0x40]
                        : []),
                    0x23,
                    0,
                    ...this.emitExpressionBinary(node.expression),
                    0x36,
                    2,
                    0,
                    0x23,
                    0,
                    0x41,
                    4,
                    0x6a,
                    0x24,
                    0,
                    0x20,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    0x41,
                    1,
                    0x6a,
                    0x21,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    ...(node.condition ? [0x0b] : []),
                    0x20,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x41,
                    1,
                    0x6a,
                    0x21,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x0c,
                    0,
                    0x0b,
                    0x0b,
                    0x20,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    0x36,
                    2,
                    0,
                    0x20,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                ];
            }
            case "DictComprehension": {
                const itemLocalIdx = this.locals.get(node.item);
                const baseLocalIdx = this.comprehensionLocals.get(node);
                const resLocalIdx = baseLocalIdx;
                const countLocalIdx = baseLocalIdx + 1;
                const iterPtrLocalIdx = baseLocalIdx + 2;
                const iterLenLocalIdx = baseLocalIdx + 3;
                const iLocalIdx = baseLocalIdx + 4;
                return [
                    ...this.emitExpressionBinary(node.iterable),
                    0x21,
                    ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
                    0x28,
                    2,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(iterLenLocalIdx),
                    0x23,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                    0x41,
                    0,
                    0x36,
                    2,
                    0,
                    0x23,
                    0,
                    0x41,
                    4,
                    0x6a,
                    0x24,
                    0,
                    0x41,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    0x41,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x02,
                    0x40,
                    0x03,
                    0x40,
                    0x20,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(iterLenLocalIdx),
                    0x48,
                    0x45,
                    0x0d,
                    1,
                    0x20,
                    ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x41,
                    4,
                    0x6c,
                    0x6a,
                    0x41,
                    4,
                    0x6a,
                    0x28,
                    2,
                    0,
                    0x21,
                    ...this.encodeUnsignedLEB128(itemLocalIdx),
                    ...(node.condition
                        ? [...this.emitExpressionBinary(node.condition), 0x04, 0x40]
                        : []),
                    0x23,
                    0,
                    ...this.emitExpressionBinary(node.key),
                    0x36,
                    2,
                    0,
                    0x23,
                    0,
                    0x41,
                    4,
                    0x6a,
                    0x24,
                    0,
                    0x23,
                    0,
                    ...this.emitExpressionBinary(node.value),
                    0x36,
                    2,
                    0,
                    0x23,
                    0,
                    0x41,
                    4,
                    0x6a,
                    0x24,
                    0,
                    0x20,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    0x41,
                    1,
                    0x6a,
                    0x21,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    ...(node.condition ? [0x0b] : []),
                    0x20,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x41,
                    1,
                    0x6a,
                    0x21,
                    ...this.encodeUnsignedLEB128(iLocalIdx),
                    0x0c,
                    0,
                    0x0b,
                    0x0b,
                    0x20,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                    0x20,
                    ...this.encodeUnsignedLEB128(countLocalIdx),
                    0x36,
                    2,
                    0,
                    0x20,
                    ...this.encodeUnsignedLEB128(resLocalIdx),
                ];
            }
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
                            0,
                            0x47,
                            ...this.emitExpressionBinary(node.right),
                            0x41,
                            0,
                            0x47,
                            0x71,
                        ];
                    case "or":
                        return [
                            ...this.emitExpressionBinary(node.left),
                            0x41,
                            0,
                            0x47,
                            ...this.emitExpressionBinary(node.right),
                            0x41,
                            0,
                            0x47,
                            0x72,
                        ];
                }
                return [
                    ...this.emitExpressionBinary(node.left),
                    ...this.emitExpressionBinary(node.right),
                    opByte,
                ];
            case "UnaryExpression":
                if (node.operator === "-")
                    return [0x41, 0, ...this.emitExpressionBinary(node.argument), 0x6b];
                if (node.operator === "not")
                    return [...this.emitExpressionBinary(node.argument), 0x45];
                return this.emitExpressionBinary(node.argument);
            case "CallExpression":
                const calleeIdx = this.functionMap.get(node.callee);
                return [
                    ...node.args.map((a) => this.emitExpressionBinary(a)).flat(),
                    0x10,
                    ...this.encodeUnsignedLEB128(calleeIdx),
                ];
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
