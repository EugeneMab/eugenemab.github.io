# Rust to WASM Compiler Playground

## Introduction
This project is a browser-based Rust-subset compiler playground.
It compiles a focused subset of Rust source code into WebAssembly (WASM), then executes it in the browser.
The toolchain is implemented in TypeScript and is designed for step-by-step language and compiler learning.

## Roadmap
This project follows two parallel roadmaps.

### 1) `rust_step` Driven Roadmap
The implementation roadmap is tracked in [`rust_step.md`](./rust_step.md).

- **Level 0 (Foundations):** environment, lexer, parser, emitter, runtime
- **Level 1 (Basic Features):** math/logic, comments, `print!`
- **Level 2 (Safety):** panic handling, scope detection, region memory, borrow checker (L1)
- **Level 3+ (Planned):** functions/control flow, strings/slices, structs/impl/traits, smart pointers, final safety/runtime hardening

Current implementation status is completed through **Step 12**.

### 2) Tutorial Book Driven Roadmap
Tutorial/book extraction progress is tracked in [`book_progress.md`](./book_progress.md).
The tutorial source book is from the Rust Git repository:

- https://github.com/rust-lang/book

This roadmap maps book examples into runnable samples inside this project, so language-learning content is validated through the compiler pipeline.

## Architecture
The core architecture is a compile-and-run pipeline:

1. **Lexer** (`src/lexer.ts`) tokenizes Rust-like source.
2. **Parser** (`src/parser.ts`) builds an AST.
3. **Emitter** (`src/emitter.ts`) produces WAT/WASM.
4. **Runtime/Worker** (`src/worker.ts`, `src/runtime.ts`) instantiates WASM and executes exported `main`.
5. **UI Layer** (`src/ui.ts`, `pub/index.html`) provides editor, sample loader, phase diagnostics, and execution output tabs.

### Runtime Model
- WebAssembly imports `print`, `print_str`, and `panic` from `env`.
- Linear memory is exported and used for string/data exchange.
- Browser Worker execution isolates compile/run from the UI thread and supports timeout/abort control.

## Details
### Project Layout
- `src/`: compiler + runtime + UI source
- `pub/`: browser assets and compiled JS output target
- `pub/samples/`: step/book-aligned Rust sample programs
- `rust_step.md`: implementation step roadmap
- `book_progress.md`: tutorial extraction/book alignment tracker

### Developer Commands
From this directory:

- `npm run lint` — lint TypeScript sources
- `npm run build` — compile TypeScript to JavaScript
- `npm test` — run unit/integration tests (Vitest)
- `npm run test:ui` — run Playwright UI tests
- `npm run serve` — serve the playground at port `7878`

### What Is Implemented Today
- Core expression parsing and evaluation for integer arithmetic/bitwise operations
- `print!` and `panic!` macro support
- Scope-based lifetime tracking and region-style heap pointer reset per block
- Borrow-check rules (first-level safety checks) for mutable/immutable borrow conflicts
- Multi-pane diagnostics: info timeline, tokens, AST, WAT, WASM bytes, execution output

