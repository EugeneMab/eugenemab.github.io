# RC-Const: Reference-Counting Constant Objects in Rust

## Introduction
RC-Const is a specialized coding style and supporting classes for Rust that prioritizes immutability and simplified memory management, similar to Garbage-Collected (GC) languages like C#, JavaScript, or Go, while maintaining Rust's performance and safety.

### Core Principles
1. **Immutability by Default**: Objects cannot be modified after construction. Any 'change' results in the creation of a new object.
2. **Restricted Types**: Only primitive types (e.g., i32, bool, f64) and reference-counted immutable objects (Rc<T>) are allowed in the public API of RC-Const objects.
3. **Cycle-Free Design**: Since objects are immutable, an object can only reference previously created objects. This naturally prevents reference cycles, eliminating the need for a Garbage Collector.
4. **No Explicit Borrows**: By avoiding '&' references in general logic and relying on Rc and Copy types, we bypass many of the complexities of the Rust borrow checker for application-level logic.

### Pros and Cons
- **Pros**:
    - Simplified lifecycle management (GC-like experience).
    - No reference cycles (no memory leaks from cycles).
    - Functional style (easier to reason about state).
- **Cons**:
    - Performance overhead for frequent 'mutations' (allocations).
    - Memory usage due to many small allocations.
    - Deviation from standard Rust idioms (e.g., list = list.append(3)).

---

## Project Structure
The project is organized as a Cargo workspace:

```text
C:\D\Code\Code\2026\20260617_RcConst\
├── .gitignore
├── Cargo.toml (Workspace)
├── README.md (This plan)
├── build.cmd (Shortcut to compile)
├── test.cmd (Shortcut to run tests)
├── run.cmd (Shortcut to run demo)
├── rc-const/ (Support Library)
│   ├── src/
│   │   ├── lib.rs (Core traits and macros)
│   │   └── builders.rs (ListBuilder, MapBuilder, SetBuilder)
├── rc-const-demo/ (Demo Project)
│   └── src/main.rs
└── rc-const-test/ (Unit and Integration Tests)
    └── src/lib.rs
```

### Environment Setup
- **Rust/Cargo**: Installed in C:\Users\jianh\.cargo\bin.
- **MinGW**: C:\D\mingw\bin\gcc.exe (Used for linking if needed).
- **Environment Variables**:
    - **PATH**: Should include C:\Users\jianh\.cargo\bin and C:\D\mingw\bin.

---

## Supporting Library (rc-const)
The library provides the backbone for this coding style:
- **Builders Pattern**: To mitigate the cost of appending to collections.
    - **ListBuilder<T>**: Uses a linked-list of nodes internally for O(1) append, then converts to a contiguous array on build().
    - **MapBuilder<K, V>**: Fluent builder for `ConstMap`.
    - **SetBuilder<T>**: Fluent builder for `ConstSet`.
- **Macros**: To simplify the creation of 'wither' methods (e.g., set_x).

---

## Implementation Plan
1. **Phase 1: Scaffolding**: Create the folder structure and workspace configuration.
2. **Phase 2: Support Library**: Implement ListBuilder and basic RcConst traits.
3. **Phase 3: Demo Implementation**: Create a small application (e.g., a simple tree-based calculator or document model) using the RC-Const style.
4. **Phase 4: Validation**: Write tests in rc-const-test to ensure no cycles are created and the Builder pattern works efficiently.

## Development Shortcuts
- build.cmd: cargo build --workspace
- test.cmd: cargo test --workspace
- run.cmd: cargo run --package rc-const-demo
