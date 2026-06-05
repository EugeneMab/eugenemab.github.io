// REM Rust-to-WASM Port (RUST)
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";
self.onmessage = async (e) => {
    const { type, code } = e.data;
    if (type === "compile") {
        let currentPhase = "Init";
        const timestamp = () => new Date().toLocaleTimeString();
        const logPhase = (phase, event, duration) => {
            self.postMessage({
                type: "phase",
                payload: {
                    phase,
                    event,
                    timestamp: timestamp(),
                    duration,
                },
            });
        };
        try {
            logPhase("Lex", "enter");
            currentPhase = "Lex";
            const lexStart = performance.now();
            const lexer = new Lexer(code);
            const tokens = lexer.tokenize();
            logPhase("Lex", "leave", performance.now() - lexStart);
            self.postMessage({ type: "lex", payload: tokens });
            logPhase("Parse", "enter");
            currentPhase = "Parse";
            const parseStart = performance.now();
            const parser = new Parser(tokens, code);
            const ast = parser.parse();
            logPhase("Parse", "leave", performance.now() - parseStart);
            self.postMessage({ type: "ast", payload: ast });
            logPhase("Emit", "enter");
            currentPhase = "Emit";
            const emitStart = performance.now();
            const emitter = new Emitter(ast);
            const wat = emitter.emitWAT();
            const wasm = emitter.emitWASM();
            logPhase("Emit", "leave", performance.now() - emitStart);
            self.postMessage({ type: "wat", payload: wat });
            self.postMessage({ type: "wasm", payload: wasm });
            logPhase("Execute", "enter");
            currentPhase = "Execute";
            const execStart = performance.now();
            const importObject = {
                env: {
                    print: (val) => {
                        self.postMessage({ type: "log", payload: String(val) });
                        return 0;
                    },
                    panic: (code) => {
                        throw new Error(`Panic! Error code: ${code}`);
                    },
                },
            };
            const { instance } = (await WebAssembly.instantiate(wasm, importObject));
            if (instance.exports.main) {
                const result = instance.exports.main();
                logPhase("Execute", "leave", performance.now() - execStart);
                self.postMessage({ type: "result", payload: result });
            }
            else {
                throw new Error("No main function found");
            }
        }
        catch (err) {
            const errorMsg = `Error: ${currentPhase}: ${err.message}`;
            const detailMsg = `${errorMsg}\n\n${err.stack || ""}`;
            self.postMessage({
                type: "error",
                payload: {
                    short: errorMsg.split("\n")[0],
                    detail: detailMsg,
                },
            });
        }
    }
};
