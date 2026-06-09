// REM Rust-to-WASM Port (RUST)
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Emitter } from "./emitter.js";

self.onmessage = async (e) => {
  const { type, code } = e.data;
  if (type === "compile") {
    let currentPhase = "Init";
    const timestamp = () => new Date().toLocaleTimeString();

    const logPhase = (
      phase: string,
      event: "enter" | "leave",
      duration?: number,
    ) => {
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
      const emitter = new Emitter(ast, code);
      const wat = emitter.emitWAT();
      const wasm = emitter.emitWASM();
      logPhase("Emit", "leave", performance.now() - emitStart);

      self.postMessage({ type: "wat", payload: wat });
      self.postMessage({ type: "wasm", payload: wasm });

      logPhase("Execute", "enter");
      currentPhase = "Execute";
      const execStart = performance.now();
      const INDEX_OUT_OF_BOUNDS_PANIC_CODE = 101;
      const runtimeState: { instance: any } = { instance: null };
      const getMemoryView = () => {
        if (!(runtimeState.instance?.exports as any)?.memory) {
          throw new Error("WASM memory is not initialized");
        }
        return new DataView(
          ((runtimeState.instance.exports as any).memory as WebAssembly.Memory).buffer,
        );
      };
      const validateIndex = (ptr: number, idx: number) => {
        const view = getMemoryView();
        if (!Number.isInteger(ptr) || ptr < 0 || ptr + 4 > view.byteLength) {
          throw new Error(`Invalid collection pointer: ${ptr}`);
        }
        const len = view.getUint32(ptr, true);
        if (idx < 0 || idx >= len) {
          throw new Error(`Panic! Error code: ${INDEX_OUT_OF_BOUNDS_PANIC_CODE}`);
        }
        return view;
      };
      const importObject = {
        env: {
          print: (val: number) => {
            self.postMessage({ type: "log", payload: String(val) });
            return 0;
          },
          print_str: (ptr: number) => {
            const mem = new Uint8Array((instance.exports.memory as any).buffer);
            const view = new DataView(mem.buffer);
            if (!Number.isInteger(ptr) || ptr < 0 || ptr + 4 > mem.length) {
              throw new Error(`Invalid string pointer: ${ptr}`);
            }
            const len = view.getUint32(ptr, true);
            const start = ptr + 4;
            if (len > mem.length - start) {
              throw new Error(
                `Invalid string length ${len} at pointer ${ptr} for memory size ${mem.length}`,
              );
            }
            const str = new TextDecoder().decode(
              mem.subarray(start, start + len),
            );
            self.postMessage({ type: "log", payload: str });
            return 0;
          },
          panic: (code: number) => {
            throw new Error(`Panic! Error code: ${code}`);
          },
          get_item: (ptr: number, idx: number) => {
            const view = validateIndex(ptr, idx);
            const addr = ptr + 4 + idx;
            if (addr < 0 || addr >= view.byteLength) {
              throw new Error(`Invalid byte address: ${addr}`);
            }
            return view.getUint8(addr);
          },
          get_item_i32: (ptr: number, idx: number) => {
            const view = validateIndex(ptr, idx);
            const addr = ptr + 4 + idx * 4;
            if (addr < 0 || addr + 4 > view.byteLength) {
              throw new Error(`Invalid i32 address: ${addr}`);
            }
            return view.getInt32(addr, true);
          },
          set_item: (ptr: number, idx: number, val: number) => {
            const view = validateIndex(ptr, idx);
            const addr = ptr + 4 + idx;
            if (addr < 0 || addr >= view.byteLength) {
              throw new Error(`Invalid byte address: ${addr}`);
            }
            view.setUint8(addr, val & 0xff);
            return 0;
          },
          set_item_i32: (ptr: number, idx: number, val: number) => {
            const view = validateIndex(ptr, idx);
            const addr = ptr + 4 + idx * 4;
            if (addr < 0 || addr + 4 > view.byteLength) {
              throw new Error(`Invalid i32 address: ${addr}`);
            }
            view.setInt32(addr, val | 0, true);
            return 0;
          },
        },
      };

      const { instance: inst } = (await WebAssembly.instantiate(
        wasm,
        importObject,
      )) as any;
      runtimeState.instance = inst;
      const instance = runtimeState.instance;
      if ((instance.exports as any).main) {
        const result = (instance.exports as any).main();
        logPhase("Execute", "leave", performance.now() - execStart);
        self.postMessage({ type: "result", payload: result });
      } else {
        throw new Error("No main function found");
      }
    } catch (err: any) {
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
