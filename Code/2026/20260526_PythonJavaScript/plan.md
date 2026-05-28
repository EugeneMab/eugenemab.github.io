# Python-to-JavaScript Compiler Plan

## Goal
Build a pure client-side compiler that converts a subset of Python into JavaScript. The compiler will visualize each stage: Lexing, Parsing (AST), and JavaScript code generation.

## Architecture
- **Language:** TypeScript (Source), JavaScript (Distribution).
- **Pipeline:** Python Source -> Lexer (Tokens) -> Parser (AST) -> Emitter (JavaScript) -> Browser Runtime.
- **UI:** Split-pane HTML interface with tabbed outputs.

## Requirements
- Separated `src` and `pub`.
- Transpiled JS located in `pub/js`.
- Automated build and check scripts.
- Support for Python indentation (INDENT/DEDENT).
- Human-readable JavaScript output.
- Support for `async/await` to emulate `sleep`.
- Support for `yield` using JavaScript generators.
- Context managers using inline functions for `__enter__`/`__exit__`.

## Roadmap Structure
The implementation follows a multi-level roadmap, from foundations to advanced runtime features. See `step.md` for the detailed execution steps.

## Technical Implementation
Transpiling Python to JavaScript allows us to leverage JS's dynamic nature and built-in features:

### 1. Scoping & Variables
- **Strategy:** Map Python variables to JavaScript variables. Use `async function` for all Python functions to support non-blocking `sleep`.

### 2. Concurrency & Blocking
- **Strategy:** Emulate `time.sleep()` using `await new Promise(resolve => setTimeout(resolve, ms))`. This requires the entire call stack to be `async`.

### 3. Iterators & Generators
- **Strategy:** Map Python `yield` to JavaScript `yield`. Generators are transpiled to `async function*`.

### 4. Context Managers
- **Strategy:** Use inline functions and `try...finally` blocks to ensure `__exit__` is called, emulating the `with` statement.
