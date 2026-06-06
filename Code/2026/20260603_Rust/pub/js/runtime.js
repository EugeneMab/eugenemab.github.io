import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";
import { default as wabtInit } from "wabt";
export class Runtime {
    async run(code) {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens, code);
        const program = parser.parse();
        const emitter = new Emitter(program, code);
        const wat = emitter.emitWAT();
        const wabt = await wabtInit();
        const module = wabt.parseWat("test.wat", wat);
        const { buffer } = module.toBinary({});
        const importObject = {
            env: {
                print: (val) => {
                    console.log(val);
                    return 0;
                },
                print_str: (ptr) => {
                    const mem = new Uint8Array(instance.exports.memory.buffer);
                    const view = new DataView(mem.buffer);
                    if (!Number.isInteger(ptr) || ptr < 0 || ptr + 4 > mem.length) {
                        throw new Error(`Invalid string pointer: ${ptr}`);
                    }
                    const len = view.getUint32(ptr, true);
                    const start = ptr + 4;
                    if (len > mem.length - start) {
                        throw new Error(`Invalid string length ${len} at pointer ${ptr} for memory size ${mem.length}`);
                    }
                    const str = new TextDecoder().decode(mem.subarray(start, start + len));
                    console.log(str);
                    return 0;
                },
                panic: (code) => {
                    throw new Error(`Panic! Error code: ${code}`);
                },
                memory: new WebAssembly.Memory({ initial: 1 }),
            },
        };
        const wasmModule = await WebAssembly.instantiate(buffer, importObject);
        const instance = wasmModule.instance;
        // Call main if exists
        if (instance.exports.main) {
            instance.exports.main();
        }
    }
}
