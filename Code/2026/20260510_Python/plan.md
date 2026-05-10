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
