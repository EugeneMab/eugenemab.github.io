# Python to WASM Compiler

## Name
- Python to WASM Compiler

## Introduction
This project is a browser playground for compiling a Python subset into WebAssembly. It shows the full pipeline from source code to tokens, AST, WAT, WASM bytes, and execution results, with sample programs for language features such as branching, slicing, comprehensions, generators, and context managers.

## How to Use
1. In `/tmp/workspace/EugeneMab/eugenemab.github.io/Code/2026/20260510_Python`, install dependencies with `npm ci`.
2. Build the browser assets with `npx tsc -p tsconfig.json`.
3. Start the local server with `npm run serve`.
4. Open `http://127.0.0.1:7984`.
5. Load a sample or write Python in the editor, then select **Compile & Run** to inspect the lexing, AST, WAT, WASM, and execution tabs.

## Architecture
- `pub/`: static browser assets, including `index.html`, styles, generated JavaScript, and sample Python files.
- `src/lexer.ts`: tokenizes the Python subset, including indentation-sensitive syntax.
- `src/parser.ts`: builds the AST from the token stream.
- `src/compiler.ts`: emits WAT and binary WASM for the supported Python subset.
- `src/worker.ts`: runs lexing, parsing, compilation, and WebAssembly execution in a Web Worker.
- `src/main.ts`: drives the browser UI, sample loading, tabs, status updates, and worker lifecycle.
- `src/serve.js`: serves the project locally for browser-based use and UI tests.
