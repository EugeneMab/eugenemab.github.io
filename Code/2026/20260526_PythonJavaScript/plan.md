# Python-to-WASM Compiler Plan

## Goal
Build a pure client-side compiler that converts a subset of Python into WebAssembly (WASM). The compiler will visualize each stage: Lexing, Parsing (AST), WAT generation, and WASM binary execution.

## Architecture
- **Language:** TypeScript (Source), JavaScript (Distribution).
- **Pipeline:** Python Source -> Lexer (Tokens) -> Parser (AST) -> Emitter (WAT & WASM) -> Browser WASM Runtime.
- **UI:** Split-pane HTML interface with tabbed outputs.

## Requirements
- Separated `src` and `pub`.
- Transpiled JS located in `pub/js`.
- Automated build and check scripts.
- Support for Python indentation (INDENT/DEDENT).
- Human-readable WAT output.
- Advanced arithmetic (Parentheses, Unary operators).
- Comprehensive math library (sqrt, pow, trigonometric functions).
- Error handling (Exception trapping for division by zero).
- Functional programming (Lambdas and Closures).

## Roadmap Structure
The implementation follows a 7-level escalating roadmap, from absolute foundations to advanced runtime internals, ensuring the compiler remains robust as complexity grows. See `step.md` for the detailed execution steps.

## Technical Limitations & Emulation
Emulating Python (a dynamic, GC-collected, interpreted language) on WASM (a static, manually managed, binary format) presents several challenges:

### 1. Type Emulation
- **Challenge:** WASM only supports `i32`, `i64`, `f32`, `f64`. Python is dynamically typed.
- **Solution:** Use **Boxed Values** (or Tagged Unions). Every "Python Object" in WASM memory is a pointer to a struct containing a `TypeTag` (e.g., 0=int, 1=str, 2=list) and a pointer to the actual data.

### 2. Memory & Garbage Collection
- **Challenge:** WASM lacks a built-in Garbage Collector (though WASM GC is in development, browser support varies).
- **Solution:** Implement a simple **Linear Allocator** (Bump Allocator) for now. For long-running apps, a basic Reference Counting or Mark-and-Sweep collector will be needed in the WASM linear memory.

### 3. Concurrency & Blocking
- **Challenge:** WASM execution is synchronous. Python `time.sleep()` or `input()` would freeze the browser UI.
- **Solution:** Execute the WASM module in a **Web Worker**. Use `Atomics.wait` on a `SharedArrayBuffer` to pause the worker thread without blocking the main UI thread.

### 4. System & Standard Library
- **Challenge:** Python's `os`, `sys`, and `print` rely on OS system calls.
- **Solution:** Create a **JS/TS Bridge**. Map Python built-ins to TypeScript functions passed in the `importObject`. 
    - `print(x)` -> `postMessage({type: 'log', payload: x})`
    - `math.sqrt(x)` -> `Math.sqrt(x)` in JS.
    - `DOM manipulation` -> Pass callbacks to WASM that trigger DOM updates in the main thread.

