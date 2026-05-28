# Implementation Roadmap (Python-to-JavaScript)

## 🌟 Level 0: Foundations (Transpiler Basics)
- [x] **Step 1: Infrastructure & UI Update**
    - [x] Update title to "Python-to-JavaScript".
    - [x] Change ports to 7957 (main) and 17957 (test).
    - [x] Update `index.html` with JS (Code) tab.
- [x] **Step 2: Lexer (Python Subset)**
    - [x] Implement `src/lexer.ts`.
    - [x] Handle keywords, identifiers, literals, and operators.
    - [x] Support single-line comments (`#`).
    - [x] Implement indentation tracking (INDENT/DEDENT).
- [x] **Step 3: Parser (AST)**
    - [x] Implement `src/parser.ts` with Recursive Descent.
    - [x] Support parentheses `()` to override operator precedence.
    - [x] Support unary operators.
    - [x] Support Function definitions, Assignments, and Arithmetic.
- [x] **Step 4: Emitter (JavaScript Generation)**
    - [x] Generate human-readable JavaScript code.
    - [x] All functions are `async` to support non-blocking `sleep`.
    - [x] Use `await` for all function calls.
- [x] **Step 5: Execution & Integration**
    - [x] Execute generated JS in a Web Worker using Blob URLs and dynamic `import()`.
    - [x] Provide a runtime bridge (print, sleep, range, etc.).

## 🌟 Level 1: Pythonic Thinking
- [x] **Step 6: Control Flow & Booleans**
    - [x] Implement `if`, `elif`, `else` statements.
    - [x] Add boolean literals (`True`, `False`) and logic (`and`, `or`, `not`).
    - [x] Implement comparison operators.
- [x] **Step 7: Parameters & Scoping**
    - [x] Support function parameters and multiple arguments.
    - [x] Support local variable scoping in JS.
- [x] **Step 8: Slicing & Advanced Indexing**
    - [x] Support `list[start:stop:step]` using runtime helper.
- [x] **Step 9: Comprehensions**
    - [x] Implement List and Dict comprehensions using `async` IIFEs.
- [x] **Step 10: Iterators & Generators**
    - [x] Implement `yield` using JavaScript `async function*`.
    - [x] Support `next()` and iteration using `for await`.
- [x] **Step 11: Context Managers**
    - [x] Implement `with` statement using inline functions and `try...finally`.

## 🌟 Level 2: Object Model & Modern Features
- [ ] **Step 12: Classes & Objects**
    - [ ] Map Python `class` to JavaScript `class`.
- [ ] **Step 13: Standard Library Expansion**
    - [ ] Add more built-in functions and modules.
