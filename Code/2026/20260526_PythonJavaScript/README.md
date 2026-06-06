# Python to JavaScript

## Name
- Python to JavaScript

## Introduction
This project is a browser playground for transpiling a Python subset into JavaScript and executing it in the browser. It exposes the intermediate stages of lexing, parsing, code generation, and execution, and includes sample programs that cover core Python syntax, collections, functional helpers, classes, and runtime behavior.

## How to Use
1. In `/tmp/workspace/EugeneMab/eugenemab.github.io/Code/2026/20260526_PythonJavaScript`, install dependencies with `npm ci`.
2. Build the browser assets with `npx tsc -p tsconfig.json`.
3. Start the local server with `npm run serve`.
4. Open `http://127.0.0.1:7957`.
5. Load a sample or write Python in the editor, then select **Compile & Run** to inspect the lexing, AST, generated JavaScript, and execution output.

## Architecture
- `pub/`: static browser assets, including the UI, generated JavaScript bundle, and sample Python programs.
- `src/lexer.ts`: tokenizes the Python subset.
- `src/parser.ts`: converts tokens into the project AST.
- `src/compiler.ts`: transpiles the AST into JavaScript and maps Python operations onto runtime helpers.
- `src/worker.ts`: executes the compile pipeline and hosts the browser-side Python runtime emulation.
- `src/main.ts`: manages the editor UI, sample loading, output tabs, timeouts, and worker communication.
- `src/serve.js`: local development server used by the app and browser-based tests.
