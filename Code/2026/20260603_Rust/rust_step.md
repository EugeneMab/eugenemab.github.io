# Implementation Roadmap (Rust-to-WASM Compiler)

## 🌟 Level 0: Foundations (Infrastructure)
- [ ] **Step 1: Environment Setup**
    - [ ] Create `package.json`, `tsconfig.json`.
    - [ ] Implement `build.cmd` (TS to JS transpilation).
    - [ ] Implement `check.cmd` (Vitest/Testing harness).
    - [ ] Implement `start.cmd` & `kill.cmd` (Local dev server/runner).
- [ ] **Step 2: Lexer (Rust Subset)**
    - [ ] Keywords: `fn`, `let`, `mut`, `if`, `else`, `loop`, `struct`, `impl`, `panic`.
    - [ ] Literals: Integers, Hex (`0x...`), Strings (`"..."`).
    - [ ] Symbols and Operators.
- [ ] **Step 3: Parser (AST)**
    - [ ] Expressions (Binary, Unary, Grouping).
    - [ ] Statements (Let, Expression, Block).
    - [ ] Macro invocation parsing (specifically for `print!`).
- [ ] **Step 4: Emitter (WAT Generation)**
    - [ ] Convert AST to WebAssembly Text format (WAT).
    - [ ] Support basic i32/f64 operations.
- [ ] **Step 5: Runtime & Execution**
    - [ ] WASM instantiation in JavaScript/TypeScript.
    - [ ] Memory buffer initialization and management.

## 🌟 Level 1: Basic Language Features
- [ ] **Step 6: Math & Logic**
    - [ ] Full arithmetic support (`+`, `-`, `*`, `/`, `%`).
    - [ ] Bitwise operators (`&`, `|`, `^`, `<<`, `>>`).
- [ ] **Step 7: Comments & Metadata**
    - [ ] Support `//` and `///`.
- [ ] **Step 8: The `print!` Macro**
    - [ ] Mapping `print!` to JS `console.log`.
    - [ ] **Validation:** Ensure illegal format strings are caught.

## 🌟 Level 2: Memory Safety, Regions & Exceptions
- [ ] **Step 9: Panic & Exception Handling (Safety Foundation)**
    - [ ] `panic!` macro implementation.
    - [ ] WASM Trap integration for immediate safety halts.
    - [ ] `Result<T, E>` pattern support for graceful errors.
    - [ ] **Sample (Illegal):** `panic!("Fatal error");` should halt execution immediately.
- [ ] **Step 10: Scope Detection**
    - [ ] Track variable lifetimes based on block scopes `{}`.
    - [ ] Implement "Drop" semantics (automatic cleanup at end of scope).
    - [ ] **Sample (Illegal):** Accessing a variable outside its defined `{}` scope.
- [ ] **Step 11: Region-Based Memory**
    - [ ] Allocate memory in regions/arenas.
    - [ ] Fast deallocation of entire regions when scope exits.
    - [ ] **Sample (Illegal):** Attempting to access memory from a dropped region.
- [ ] **Step 12: Borrow Checker (Level 1)**
    - [ ] Prevent multiple mutable references.
    - [ ] Prevent use-after-free in the compiler stage.
    - [ ] **Sample (Illegal):**
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
