import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Emitter } from './emitter.js';
import { default as wabtInit } from 'wabt';
export class Runtime {
    async run(code) {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const program = parser.parse();
        const emitter = new Emitter(program);
        const wat = emitter.emit();
        const wabt = await wabtInit();
        const module = wabt.parseWat('test.wat', wat);
        const { buffer } = module.toBinary({});
        const importObject = {
            env: {
                print: (val) => {
                    console.log(val);
                },
                memory: new WebAssembly.Memory({ initial: 1 })
            }
        };
        const wasmModule = await WebAssembly.instantiate(buffer, importObject);
        const instance = wasmModule.instance;
        // Call main if exists
        if (instance.exports.main) {
            instance.exports.main();
        }
    }
}
