export class Compiler {
    locals = new Map();
    localIndex = 0;
    compileWAT(program) {
        let wat = `(module\n`;
        for (const node of program.body) {
            if (node.type === "FunctionDef") {
                wat += this.emitFunctionWAT(node);
            }
        }
        wat += `)\n`;
        return wat;
    }
    emitFunctionWAT(node) {
        this.locals.clear();
        this.localIndex = 0;
        // Pre-scan for locals to declare them
        const localDecls = [];
        const scanBody = (nodes) => {
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
        const bodyLines = [];
        for (const stmt of node.body) {
            const stmtWat = this.emitStatementWAT(stmt);
            if (stmtWat) {
                bodyLines.push(...stmtWat.split("\n"));
            }
        }
        const allLines = [...localDecls, ...bodyLines].filter((line) => line.trim().length > 0);
        return (`  (func $${node.name} (result i32)\n` +
            `    ${allLines.join("\n    ")}\n` +
            `  )\n` +
            `  (export "${node.name}" (func $${node.name}))\n`);
    }
    emitStatementWAT(node) {
        switch (node.type) {
            case "Return":
                return this.emitExpressionWAT(node.value) + "\nreturn";
            case "Assignment":
                return (this.emitExpressionWAT(node.value) + `\nlocal.set $${node.target}`);
            case "While":
                return (`block\n` +
                    `  loop\n` +
                    `    ${this.emitExpressionWAT(node.condition)}\n` +
                    `    i32.eqz\n` +
                    `    br_if 1\n` +
                    `    ${node.body.map((s) => this.emitStatementWAT(s)).join("\n")}\n` +
                    `    br 0\n` +
                    `  end\n` +
                    `end`);
            case "CallExpression":
                return (node.args.map((a) => this.emitExpressionWAT(a)).join("\n") +
                    `\ncall $${node.callee}`);
            default:
                return "";
        }
    }
    emitExpressionWAT(node) {
        switch (node.type) {
            case "Literal":
                return `i32.const ${node.value}`;
            case "Identifier":
                return `local.get $${node.name}`;
            case "BinaryExpression":
                return (this.emitExpressionWAT(node.left) +
                    "\n" +
                    this.emitExpressionWAT(node.right) +
                    "\n" +
                    (node.operator === "+" ? "i32.add" : "i32.sub"));
            case "CallExpression":
                return (node.args.map((a) => this.emitExpressionWAT(a)).join("\n") +
                    `\ncall $${node.callee}`);
            default:
                return "";
        }
    }
    // --- WASM Binary Emitter ---
    compileWASM(program) {
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
        const mainFunc = program.body.find((n) => n.type === "FunctionDef");
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
    emitFunctionBinary(node) {
        this.locals.clear();
        this.localIndex = 0;
        // Pre-scan for locals
        const localTypes = [];
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
        const body = [];
        for (const stmt of node.body) {
            body.push(...this.emitStatementBinary(stmt));
        }
        body.push(0x0b); // end
        const fullFunc = [...localVec, ...body];
        return [...this.encodeUnsignedLEB128(fullFunc.length), ...fullFunc];
    }
    emitStatementBinary(node) {
        switch (node.type) {
            case "Return":
                return [...this.emitExpressionBinary(node.value), 0x0f]; // return
            case "Assignment":
                const idx = this.locals.get(node.target);
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
    emitExpressionBinary(node) {
        switch (node.type) {
            case "Literal":
                return [0x41, ...this.encodeSignedLEB128(node.value)]; // i32.const
            case "Identifier":
                const idx = this.locals.get(node.name);
                return [0x20, ...this.encodeUnsignedLEB128(idx)]; // local.get
            case "BinaryExpression":
                return [
                    ...this.emitExpressionBinary(node.left),
                    ...this.emitExpressionBinary(node.right),
                    node.operator === "+" ? 0x6a : 0x6b, // i32.add / i32.sub
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
