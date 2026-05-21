// src/compiler.ts
import { ProgramNode, ASTNode, FunctionDefNode, SliceNode } from "./parser.js";

export class Compiler {
  private locals: Map<string, number> = new Map();
  private localIndex: number = 0;
  private functionMap: Map<string, number> = new Map();
  private tempLocals: string[] = [];
  private watLocalCount: number = 0;

  private allocateTempLocal(): string {
    const name = `__tmp${this.tempLocals.length}`;
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

  private emitGetItemWAT(): string {
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

  private emitSliceWAT(): string {
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
        const body = node.body
          .map((s) => this.emitStatementWAT(s))
          .filter((s) => s)
          .join("\n");
        const condition = `${this.emitExpressionWAT(node.condition)}\nbr_if 0`;
        return `loop\n${this.indent(body + "\n" + condition)}\nend`;
      }
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
            wat += this.emitExpressionWAT({
              type: "Literal",
              value: part,
            } as any);
          } else {
            wat += this.emitExpressionWAT(part) + "\ncall $itoa";
          }
          if (i > 0) {
            wat += "\ncall $concat";
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
    types.push([0x60, 1, 0x7f, 1, 0x7f]); // index 0: (i32) -> i32
    types.push([0x60, 2, 0x7f, 0x7f, 1, 0x7f]); // index 1: (i32, i32) -> i32
    types.push([0x60, 3, 0x7f, 0x7f, 0x7f, 1, 0x7f]); // index 2: (i32, i32, i32) -> i32
    types.push([0x60, 4, 0x7f, 0x7f, 0x7f, 0x7f, 1, 0x7f]); // index 3
    const userFuncTypeIndices: number[] = [];
    for (const f of userFunctions) {
      const type = [
        0x60,
        ...this.encodeUnsignedLEB128(f.params.length),
        ...new Array(f.params.length).fill(0x7f),
        1,
        0x7f,
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
    const typeSection = this.createSection(1, [this.encodeVector(types)]);
    const importSection = this.createSection(2, [
      this.encodeVector([
        [...this.encodeString("env"), ...this.encodeString("print"), 0x00, 0],
        [...this.encodeString("env"), ...this.encodeString("sleep"), 0x00, 0],
        [
          ...this.encodeString("env"),
          ...this.encodeString("print_str"),
          0x00,
          0,
        ],
        [...this.encodeString("env"), ...this.encodeString("itoa"), 0x00, 0],
        [...this.encodeString("env"), ...this.encodeString("concat"), 0x00, 1],
        [
          ...this.encodeString("env"),
          ...this.encodeString("_get_item"),
          0x00,
          1,
        ],
        [...this.encodeString("env"), ...this.encodeString("_slice"), 0x00, 3],
      ]),
    ]);
    const funcSection = this.createSection(3, [
      this.encodeVector(userFuncTypeIndices.map((i) => [i])),
    ]);
    const memorySection = this.createSection(5, [
      this.encodeVector([[0x00, 1]]),
    ]);
    const globalSection = this.createSection(6, [
      this.encodeVector([
        [0x7f, 0x01, 0x41, ...this.encodeSignedLEB128(1024), 0x0b],
      ]),
    ]);
    const exports: number[][] = [];
    userFunctions.forEach((f, i) =>
      exports.push([
        ...this.encodeString(f.name),
        0x00,
        ...this.encodeUnsignedLEB128(7 + i),
      ]),
    );
    exports.push([...this.encodeString("memory"), 0x02, 0]);
    exports.push([...this.encodeString("heap_ptr"), 0x03, 0]);
    const exportSection = this.createSection(7, [this.encodeVector(exports)]);
    const codes = [...userFunctions.map((f) => this.emitFunctionBinary(f))];
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

  private emitGetItemBinary(): number[] {
    const body: number[] = [
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

  private emitSliceBinary(): number[] {
    const body: number[] = [
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
        localTypes.push(0x7f);
      }
      if (n.type === "ListComprehension" || n.type === "DictComprehension") {
        if (!this.locals.has(n.item)) {
          this.locals.set(n.item, this.localIndex++);
          localTypes.push(0x7f);
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
            localTypes.push(0x7f);
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
    body.push(0x41, 0, 0x0b);

    // After emission, we know how many tempLocals were allocated
    this.tempLocals.forEach(() => localTypes.push(0x7f));

    const localDecls =
      localTypes.length > 0
        ? [
            ...this.encodeUnsignedLEB128(1),
            ...this.encodeUnsignedLEB128(localTypes.length),
            0x7f,
          ]
        : [...this.encodeUnsignedLEB128(0)];

    const fullFunc = [...localDecls, ...body];
    return [...this.encodeUnsignedLEB128(fullFunc.length), ...fullFunc];
  }

  private emitStatementBinary(node: ASTNode): number[] {
    switch (node.type) {
      case "Return":
        return [...this.emitExpressionBinary(node.value), 0x0f];
      case "Assignment":
        return [
          ...this.emitExpressionBinary(node.value),
          0x21,
          ...this.encodeUnsignedLEB128(this.locals.get(node.target)!),
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
      case "For": {
        if (node.start && node.stop) {
          const iterIdx = this.locals.get(node.iterator)!;
          return [
            ...this.emitExpressionBinary(node.start),
            0x21,
            ...this.encodeUnsignedLEB128(iterIdx),
            0x02,
            0x40, // block
            0x03,
            0x40, // loop
            0x20,
            ...this.encodeUnsignedLEB128(iterIdx),
            ...this.emitExpressionBinary(node.stop),
            0x4e, // i32.ge_s
            0x0d,
            1, // br_if 1
            ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
            0x20,
            ...this.encodeUnsignedLEB128(iterIdx),
            0x41,
            1,
            0x6a, // i32.add
            0x21,
            ...this.encodeUnsignedLEB128(iterIdx),
            0x0c,
            0, // br 0
            0x0b,
            0x0b,
          ];
        } else if (node.iterable) {
          const iterIdx = this.locals.get(node.iterator)!;
          const iterPtr = this.localIndex;
          const iterLen = this.localIndex + 1;
          const idxLocal = this.localIndex + 2;
          return [
            ...this.emitExpressionBinary(node.iterable),
            0x21,
            ...this.encodeUnsignedLEB128(iterPtr),
            0x20,
            ...this.encodeUnsignedLEB128(iterPtr),
            0x2d,
            2,
            0, // i32.load
            0x21,
            ...this.encodeUnsignedLEB128(iterLen),
            0x41,
            0,
            0x21,
            ...this.encodeUnsignedLEB128(idxLocal),
            0x02,
            0x40, // block
            0x03,
            0x40, // loop
            0x20,
            ...this.encodeUnsignedLEB128(idxLocal),
            0x20,
            ...this.encodeUnsignedLEB128(iterLen),
            0x4e, // i32.ge_s
            0x0d,
            1, // br_if 1
            0x20,
            ...this.encodeUnsignedLEB128(iterPtr),
            0x41,
            4,
            0x6a, // add 4
            0x20,
            ...this.encodeUnsignedLEB128(idxLocal),
            0x41,
            4,
            0x6c, // mul 4
            0x6a, // add
            0x2d,
            2,
            0, // load
            0x21,
            ...this.encodeUnsignedLEB128(iterIdx),
            ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
            0x20,
            ...this.encodeUnsignedLEB128(idxLocal),
            0x41,
            1,
            0x6a, // i32.add
            0x21,
            ...this.encodeUnsignedLEB128(idxLocal),
            0x0c,
            0, // br 0
            0x0b,
            0x0b,
          ];
        }
        return [];
      }
      case "DoWhile": {
        return [
          0x03,
          0x40, // loop
          ...node.body.map((s) => this.emitStatementBinary(s)).flat(),
          ...this.emitExpressionBinary(node.condition),
          0x0d,
          0, // br_if 0
          0x0b,
        ];
      }
      default:
        const expr = this.emitExpressionBinary(node);
        return expr.length > 0 ? [...expr, 0x1a] : [];
    }
  }

  private emitExpressionBinary(node: ASTNode): number[] {
    switch (node.type) {
      case "Literal":
        if (typeof node.value === "number")
          return [0x41, ...this.encodeSignedLEB128(node.value)];
        if (typeof node.value === "boolean") return [0x41, node.value ? 1 : 0];
        if (typeof node.value === "string") {
          const str = node.value;
          const size = (str.length + 1) * 4;
          const tmp0 = this.allocateTempLocal();
          const tmp0Idx = this.getTempLocalIndex(tmp0);
          const bytes: number[] = [
            0x23, // global.get 0
            0,
            0x21, // local.set tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
            0x23, // global.get 0
            0,
            0x41, // i32.const size
            ...this.encodeSignedLEB128(size),
            0x6a, // i32.add
            0x24, // global.set 0
            0,
            0x20, // local.get tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
            0x41, // i32.const str.length
            ...this.encodeSignedLEB128(str.length),
            0x36, // i32.store
            2,
            0,
          ];
          for (let i = 0; i < str.length; i++)
            bytes.push(
              0x20, // local.get tmp0
              ...this.encodeUnsignedLEB128(tmp0Idx),
              0x41, // i32.const (i+1)*4
              ...this.encodeSignedLEB128((i + 1) * 4),
              0x6a, // i32.add
              0x41, // i32.const charCode
              ...this.encodeSignedLEB128(str.charCodeAt(i)),
              0x36, // i32.store
              2,
              0,
            );
          bytes.push(
            0x20, // local.get tmp0
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
          0x23, // global.get 0
          0,
          0x21, // local.set tmp0
          ...this.encodeUnsignedLEB128(tmp0Idx),
          0x23, // global.get 0
          0,
          0x41, // i32.const size
          ...this.encodeSignedLEB128(size),
          0x6a, // i32.add
          0x24, // global.set 0
          0,
          0x20, // local.get tmp0
          ...this.encodeUnsignedLEB128(tmp0Idx),
          0x41, // i32.const length
          ...this.encodeSignedLEB128(length),
          0x36, // i32.store
          2,
          0,
        ];
        node.elements.forEach((el, i) => {
          listBytes.push(
            0x20, // local.get tmp0
            ...this.encodeUnsignedLEB128(tmp0Idx),
            0x41, // i32.const (i+1)*4
            ...this.encodeSignedLEB128((i + 1) * 4),
            0x6a, // i32.add
          );
          listBytes.push(...this.emitExpressionBinary(el));
          listBytes.push(
            0x36, // i32.store
            2,
            0,
          );
        });
        listBytes.push(
          0x20, // local.get tmp0
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
            ...this.encodeUnsignedLEB128(this.functionMap.get("_slice")!),
          ];
        }
        return [
          ...base,
          ...this.emitExpressionBinary(node.index),
          0x10,
          ...this.encodeUnsignedLEB128(this.functionMap.get("_get_item")!),
        ];
      case "Identifier":
        return [
          0x20,
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
            ? [...this.emitExpressionBinary(node.condition), 0x04, 0x40]
            : []),
          0x23, // global.get 0
          0,
          0x21, // local.set resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          0x23, // global.get 0
          0,
          0x41, // i32.const 4
          4,
          0x6a, // i32.add
          0x24, // global.set 0
          0,
          0x20, // local.get resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          ...this.emitExpressionBinary(node.expression),
          0x36, // i32.store
          2,
          0,
          0x20,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          0x41,
          1,
          0x6a,
          0x21,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          ...(node.condition ? [0x0b] : []),
        ];

        return [
          ...this.emitExpressionBinary(node.iterable),
          0x21,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          0x20,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          0x28, // i32.load
          2,
          0,
          0x21,
          ...this.encodeUnsignedLEB128(iterLenLocalIdx),
          0x23, // global.get 0
          0,
          0x21,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          0x20,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          0x41,
          0,
          0x36, // i32.store count 0
          2,
          0,
          0x23, // global.get 0
          0,
          0x41,
          4,
          0x6a,
          0x24, // global.set 0
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
          0x4e, // i32.ge_s
          0x0d,
          1, // br_if 1
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
          0x28, // i32.load
          2,
          0,
          0x21,
          ...this.encodeUnsignedLEB128(itemLocalIdx),
          ...actionBytes,
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
          0x36, // store final count
          2,
          0,
          0x20,
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
            ? [...this.emitExpressionBinary(node.condition), 0x04, 0x40]
            : []),
          0x23, // global.get 0
          0,
          0x21, // local.set resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          0x23, // global.get 0
          0,
          0x41, // i32.const 4
          4,
          0x6a, // i32.add
          0x24, // global.set 0
          0,
          0x20, // local.get resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          ...this.emitExpressionBinary(node.key),
          0x36, // i32.store
          2,
          0,
          0x23, // global.get 0
          0,
          0x21, // local.set resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          0x23, // global.get 0
          0,
          0x41, // i32.const 4
          4,
          0x6a, // i32.add
          0x24, // global.set 0
          0,
          0x20, // local.get resItemPtr
          ...this.encodeUnsignedLEB128(resItemPtrIdx),
          ...this.emitExpressionBinary(node.value),
          0x36, // i32.store
          2,
          0,
          0x20,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          0x41,
          1,
          0x6a,
          0x21,
          ...this.encodeUnsignedLEB128(countLocalIdx),
          ...(node.condition ? [0x0b] : []),
        ];

        return [
          ...this.emitExpressionBinary(node.iterable),
          0x21,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          0x20,
          ...this.encodeUnsignedLEB128(iterPtrLocalIdx),
          0x28, // i32.load
          2,
          0,
          0x21,
          ...this.encodeUnsignedLEB128(iterLenLocalIdx),
          0x23, // global.get 0
          0,
          0x21,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          0x20,
          ...this.encodeUnsignedLEB128(resLocalIdx),
          0x41,
          0,
          0x36, // i32.store count 0
          2,
          0,
          0x23, // global.get 0
          0,
          0x41,
          4,
          0x6a,
          0x24, // global.set 0
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
          0x4e, // i32.ge_s
          0x0d,
          1, // br_if 1
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
          0x28, // i32.load
          2,
          0,
          0x21,
          ...this.encodeUnsignedLEB128(itemLocalIdx),
          ...actionBytes,
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
          0x36, // store final count
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
              0x10,
              ...this.encodeUnsignedLEB128(this.functionMap.get("print_str")!),
            ];
          }
        }

        return [...argsBytes, 0x10, ...this.encodeUnsignedLEB128(calleeIdx)];
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
              0x10,
              ...this.encodeUnsignedLEB128(this.functionMap.get("itoa")!),
            );
          }
          if (i > 0) {
            bytes.push(
              0x10,
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
