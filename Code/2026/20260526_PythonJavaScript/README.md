# Python to JavaScript

## Name
- Python to JavaScript

## Introduction
This project is a browser playground for transpiling a Python subset into JavaScript and executing it in the browser. It exposes the intermediate stages of lexing, parsing, code generation, and execution, and includes sample programs that cover core Python syntax, collections, functional helpers, classes, and runtime behavior.

## How to Use
### Linux
1. Go to `git_root_folder/Code/2026/20260526_PythonJavaScript`.
2. Install dependencies with `npm ci`.
3. Build browser assets with `npx tsc -p tsconfig.json`.
4. Start the local server with `npm run serve`.
5. Open `http://127.0.0.1:7957`.
6. Load a sample or write Python in the editor, then select **Compile & Run**.

### Windows
1. Go to `GitRootFolder\Code\2026\20260526_PythonJavaScript`.
2. Install dependencies with `install.cmd` (wrapper around npm).
3. Build browser assets with `build.cmd` (wrapper around node/tsc).
4. Start the local server with `start.cmd` (wrapper around node/npm).
5. Open `http://127.0.0.1:7957`.
6. Load a sample or write Python in the editor, then select **Compile & Run**.

## Architecture
- `pub/`: static browser assets, including the UI, generated JavaScript bundle, and sample Python programs.
- `src/lexer.ts`: tokenizes the Python subset.
- `src/parser.ts`: converts tokens into the project AST.
- `src/compiler.ts`: transpiles the AST into JavaScript and maps Python operations onto runtime helpers.
- `src/worker.ts`: executes the compile pipeline and hosts the browser-side Python runtime emulation.
- `src/main.ts`: manages the editor UI, sample loading, output tabs, timeouts, and worker communication.
- `src/serve.js`: local development server used by the app and browser-based tests.
