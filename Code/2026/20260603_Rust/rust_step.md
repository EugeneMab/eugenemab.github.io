# Implementation Roadmap (Rust-to-WASM Compiler)

## 🌟 Level 0: Foundations (Infrastructure)
- [x] **Step 1: Environment Setup**
    - [x] Create `package.json`, `tsconfig.json`.
    - [x] Implement `build.cmd` (TS to JS transpilation).
    - [x] Implement `check.cmd` (Vitest/Testing harness).
    - [x] Implement `start.cmd` & `kill.cmd` (Local dev server/runner).
- [x] **Step 2: Lexer (Rust Subset)**
    - [x] Keywords: `fn`, `let`, `mut`, `if`, `else`, `loop`, `struct`, `impl`, `panic`.
    - [x] Literals: Integers, Hex (`0x...`), Strings (`"..."`).
    - [x] Symbols and Operators.
- [x] **Step 3: Parser (AST)**
    - [x] Expressions (Binary, Unary, Grouping).
    - [x] Statements (Let, Expression, Block).
    - [x] Macro invocation parsing (specifically for `print!`).
- [x] **Step 4: Emitter (WAT Generation)**
    - [x] Convert AST to WebAssembly Text format (WAT).
    - [x] Support basic i32/f64 operations.
- [x] **Step 5: Runtime & Execution**
    - [x] WASM instantiation in JavaScript/TypeScript.
    - [x] Memory buffer initialization and management.

## 🌟 Level 1: Basic Language Features
- [x] **Step 6: Math & Logic**
    - [x] Full arithmetic support (`+`, `-`, `*`, `/`, `%`).
    - [x] Bitwise operators (`&`, `|`, `^`, `<<`, `>>`).
- [x] **Step 7: Comments & Metadata**
    - [x] Support `//` and `///`.
- [x] **Step 8: The `print!` Macro**
    - [x] Mapping `print!` to JS `console.log`.
    - [x] **Validation:** Ensure illegal format strings are caught.

## 🌟 Level 2: Memory Safety, Regions & Exceptions
- [x] **Step 9: Panic & Exception Handling (Safety Foundation)**
    - [x] `panic!` macro implementation.
    - [x] WASM Trap integration for immediate safety halts.
    - [x] `Result<T, E>` pattern support for graceful errors.
    - [x] **Sample (Illegal):** `panic!("Fatal error");` should halt execution immediately.
- [x] **Step 10: Scope Detection**
    - [x] Track variable lifetimes based on block scopes `{}`.
    - [x] Implement "Drop" semantics (automatic cleanup at end of scope).
    - [x] **Sample (Illegal):** Accessing a variable outside its defined `{}` scope.
- [x] **Step 11: Region-Based Memory**
    - [x] Allocate memory in regions/arenas.
    - [x] Fast deallocation of entire regions when scope exits.
    - [x] **Sample (Illegal):** Attempting to access memory from a dropped region.
- [x] **Step 12: Borrow Checker (Level 1)**
    - [x] Prevent multiple mutable references.
    - [x] Prevent use-after-free in the compiler stage.
    - [x] **Sample (Illegal):**
      ```rust
      let mut x = 5;
      let y = &mut x;
      let z = &mut x; // ERROR: Second mutable borrow
      ```

## 🌟 Level 3: Functions & Control Flow
- [ ] **Step 13: Function Definitions**
    - [ ] Argument passing (WASM locals).
    - [ ] Return values & `?` operator for error propagation.
- [ ] **Step 14: Advanced Control Flow**
    - [ ] `if / else` expressions.
    - [ ] `loop`, `while`, and `break`.

## 🌟 Level 4: Complex Data Types
- [ ] **Step 15: Strings & Slices**
    - [ ] String storage in linear memory.
    - [ ] Pointer + Length representation for slices (`&str`).
    - [ ] **Sample (Illegal):** Out-of-bounds slice access.
- [ ] **Step 16: Hex & Numeric Literals**
    - [ ] Support for various bit-widths (`i32`, `i64`, `u8`, etc.).

## 🌟 Level 5: Object Model (Structural)
- [ ] **Step 17: Structs**
    - [ ] Memory layout for multi-field structs.
    - [ ] Field access and offsets.
    - [ ] **Sample (Illegal):** Uninitialized field access.
- [ ] **Step 18: Methods & `impl`**
    - [ ] Static methods and instance methods (`self`).
- [ ] **Step 19: Classes / Traits**
    - [ ] Basic dynamic dispatch (vtable in WASM memory).

## 🌟 Level 6: Smart Pointers (Memory Management)
- [ ] **Step 20: Reference Counting (Rc)**
    - [ ] Implementation of `Rc<T>` with increment/decrement on clone/drop.
    - [ ] **Sample (Illegal):** Manual drop of an `Rc` managed pointer.
- [ ] **Step 21: Weak Pointers**
    - [ ] Handling cyclic dependencies with `Weak<T>`.
    - [ ] Upgrade logic (Weak to Rc).

## 🌟 Level 7: Final Validation & Stress Testing
- [ ] **Step 22: Comprehensive Safety Audit**
    - [ ] Move semantics (preventing use-after-move).
    - [ ] Null pointer dereference simulation traps.
    - [ ] Stack overflow protection (recursion depth limits).
- [ ] **Step 23: Production Ready Runtime**
    - [ ] Optimizing WAT emission.
    - [ ] Finalizing JS/WASM interop bridge.
