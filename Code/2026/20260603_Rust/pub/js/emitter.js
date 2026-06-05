export class Emitter {
    program;
    indent = 0;
    output = [];
    constructor(program) {
        this.program = program;
    }
    emit() {
        this.output = [];
        this.emitLine('(module');
        this.indent++;
        // Import for print! and panic
        this.emitLine('(import "env" "print" (func $print (param i32)))');
        this.emitLine('(import "env" "panic" (func $panic (param i32)))');
        // Memory
        this.emitLine('(memory (export "memory") 1)');
        for (const stmt of this.program.body) {
            this.emitStatement(stmt);
        }
        this.indent--;
        this.emitLine(')');
        return this.output.join('\n');
    }
    emitStatement(stmt) {
        switch (stmt.type) {
            case 'FunctionDeclaration':
                this.emitFunction(stmt);
                break;
            case 'LetStatement':
                // Global lets or local ones need different handling
                // For now, let's assume they are handled within functions
                break;
            case 'ExpressionStatement':
                this.emitExpression(stmt.expression);
                this.emitLine('drop'); // WASM stack cleanup
                break;
            case 'BlockStatement':
                for (const s of stmt.body) {
                    this.emitStatement(s);
                }
                break;
        }
    }
    emitFunction(fn) {
        const params = fn.params.map(p => `(param $${p} i32)`).join(' ');
        this.emitLine(`(func (export "${fn.name}") ${params}`);
        this.indent++;
        // Emit locals for let statements inside the function
        this.emitLocals(fn.body);
        this.emitBlock(fn.body);
        this.indent--;
        this.emitLine(')');
    }
    emitLocals(block) {
        for (const stmt of block.body) {
            if (stmt.type === 'LetStatement') {
                this.emitLine(`(local $${stmt.name} i32)`);
            }
        }
    }
    emitBlock(block) {
        for (const stmt of block.body) {
            if (stmt.type === 'LetStatement') {
                this.emitExpression(stmt.initializer);
                this.emitLine(`local.set $${stmt.name}`);
            }
            else if (stmt.type === 'ExpressionStatement') {
                this.emitExpression(stmt.expression);
                // Note: if expression returns a value and it's a statement, we drop it
                // But for print! macro it might not return anything
            }
        }
    }
    emitExpression(expr) {
        switch (expr.type) {
            case 'Literal':
                if (expr.rawType === 'integer' || expr.rawType === 'hex') {
                    this.emitLine(`i32.const ${expr.value}`);
                }
                else if (expr.rawType === 'string') {
                    // Strings need memory allocation, handle later
                    this.emitLine('i32.const 0'); // Placeholder
                }
                break;
            case 'Identifier':
                this.emitLine(`local.get $${expr.name}`);
                break;
            case 'BinaryExpression':
                this.emitExpression(expr.left);
                this.emitExpression(expr.right);
                this.emitBinaryOp(expr.operator);
                break;
            case 'MacroInvocation':
                if (expr.name === 'print') {
                    for (const arg of expr.args) {
                        this.emitExpression(arg);
                        this.emitLine('call $print');
                    }
                }
                else if (expr.name === 'panic') {
                    // Push error code if provided, otherwise 0
                    if (expr.args.length > 0) {
                        this.emitExpression(expr.args[0]);
                    }
                    else {
                        this.emitLine('i32.const 0');
                    }
                    this.emitLine('call $panic');
                    this.emitLine('unreachable');
                }
                break;
            case 'CallExpression':
                for (const arg of expr.args) {
                    this.emitExpression(arg);
                }
                this.emitLine(`call $${expr.callee}`);
                break;
        }
    }
    emitBinaryOp(op) {
        switch (op) {
            case '+':
                this.emitLine('i32.add');
                break;
            case '-':
                this.emitLine('i32.sub');
                break;
            case '*':
                this.emitLine('i32.mul');
                break;
            case '/':
                this.emitLine('i32.div_s');
                break;
            case '%':
                this.emitLine('i32.rem_s');
                break;
            case '&':
                this.emitLine('i32.and');
                break;
            case '|':
                this.emitLine('i32.or');
                break;
            case '^':
                this.emitLine('i32.xor');
                break;
            case '<<':
                this.emitLine('i32.shl');
                break;
            case '>>':
                this.emitLine('i32.shr_s');
                break;
        }
    }
    emitLine(line) {
        this.output.push('  '.repeat(this.indent) + line);
    }
}
