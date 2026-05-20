// src/worker.ts
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
self.onmessage = async (e) => {
    const { type, code } = e.data;
    if (type === "compile") {
        try {
            // 1. Lexing
            const lexer = new Lexer(code);
            const tokens = lexer.tokenize();
            self.postMessage({
                type: "lex",
                payload: tokens
                    .map((t) => `${t.type} ${t.line} ${t.col} "${t.value}"`)
                    .join("\n"),
            });
            // 2. Parsing
            const parser = new Parser(tokens);
            const ast = parser.parse();
            self.postMessage({ type: "ast", payload: JSON.stringify(ast, null, 2) });
            // 3. Compiling
            const compiler = new Compiler();
            const wat = compiler.compileWAT(ast);
            self.postMessage({ type: "wat", payload: wat });
            const wasm = compiler.compileWASM(ast);
            self.postMessage({
                type: "wasm",
                payload: Array.from(wasm)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join(" "),
            });
            // 4. Execution
            // We provide print, sleep, etc. to the WASM instance
            let instance;
            const importObject = {
                env: {
                    print: (val) => {
                        self.postMessage({ type: "log", payload: val });
                    },
                    print_str: (ptr) => {
                        const view = new Int32Array(instance.exports.memory.buffer);
                        const len = view[ptr / 4];
                        let str = "";
                        for (let i = 0; i < len; i++) {
                            str += String.fromCharCode(view[ptr / 4 + 1 + i]);
                        }
                        self.postMessage({ type: "log", payload: str });
                        return 0;
                    },
                    itoa: (val) => {
                        const s = String(val);
                        const ptr = instance.exports.heap_ptr.value;
                        const view = new Int32Array(instance.exports.memory.buffer);
                        view[ptr / 4] = s.length;
                        for (let i = 0; i < s.length; i++) {
                            view[ptr / 4 + 1 + i] = s.charCodeAt(i);
                        }
                        instance.exports.heap_ptr.value += (s.length + 1) * 4;
                        return ptr;
                    },
                    concat: (ptr1, ptr2) => {
                        const view = new Int32Array(instance.exports.memory.buffer);
                        const len1 = view[ptr1 / 4];
                        const len2 = view[ptr2 / 4];
                        const ptr = instance.exports.heap_ptr.value;
                        view[ptr / 4] = len1 + len2;
                        for (let i = 0; i < len1; i++) {
                            view[ptr / 4 + 1 + i] = view[ptr1 / 4 + 1 + i];
                        }
                        for (let i = 0; i < len2; i++) {
                            view[ptr / 4 + 1 + len1 + i] = view[ptr2 / 4 + 1 + i];
                        }
                        instance.exports.heap_ptr.value += (len1 + len2 + 1) * 4;
                        return ptr;
                    },
                    sleep: (ms) => {
                        if (typeof SharedArrayBuffer !== "undefined") {
                            const shared = new Int32Array(new SharedArrayBuffer(4));
                            Atomics.wait(shared, 0, 0, ms);
                        }
                        else {
                            // Fallback to busy-wait if SharedArrayBuffer is not available
                            const start = Date.now();
                            while (Date.now() - start < ms) {
                                // Spinning...
                            }
                        }
                    },
                },
            };
            const { instance: inst } = (await WebAssembly.instantiate(wasm, importObject));
            instance = inst;
            // If the code is an infinite loop, this will never return
            // unless the worker is terminated.
            const result = instance.exports.main();
            self.postMessage({ type: "result", payload: `Result: ${result}` });
        }
        catch (err) {
            self.postMessage({ type: "error", payload: err.message || String(err) });
        }
    }
};
