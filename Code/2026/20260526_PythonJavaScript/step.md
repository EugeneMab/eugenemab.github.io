# Implementation Roadmap (Python-to-JavaScript)

## 🌟 Level 0: Foundations (Transpiler Basics)
- [x] **Step 1: Infrastructure & UI Update**
- [x] **Step 2: Lexer (Python Subset)**
- [x] **Step 3: Parser (AST)**
- [x] **Step 4: Emitter (JavaScript Generation)**
- [x] **Step 5: Execution & Integration**

## 🌟 Level 1: Pythonic Thinking
- [x] **Step 6: Control Flow & Booleans**
- [x] **Step 7: Parameters & Scoping**
- [x] **Step 8: Slicing & Advanced Indexing**
- [x] **Step 9: Comprehensions**
- [x] **Step 10: Iterators & Generators**
- [x] **Step 11: Context Managers**

## 🌟 Level 2: Consolidating the Data Model
- [x] **Step 12: Atomic Types & Casting**
    - [x] **Integers vs Floats:** Proper `int()`/`float()` distinction and truncation.
    - [x] **Strings:** Implement `chr()`, `ord()`, and raw strings (`r"..."`).
    - [x] **Booleans:** Strict `bool()` casting and truthiness evaluation (`_is_truthy` helper).
    - [x] **Large Numbers:** `BigInt` for arbitrary precision `long` semantics.
- [x] **Step 13: Core Collection Types**
    - [x] **Tuples:** Implement immutable `tuple` (using `Object.freeze` or specialized class).
    - [x] **Sets:** Implement `set` and `frozenset` using JS `Set`.
    - [x] **Bytes:** `bytes` and `bytearray` parity using `Uint8Array`.
- [x] **Step 14: Foundational Operators**
    - [x] **Arithmetic:** Floor division (`//`), Modulo (`%`), Exponentiation (`**`).
    - [x] **Bitwise:** `&`, `|`, `^`, `~`, `<<`, `>>`.
    - [x] **Membership:** `in` and `not in` for all collection types.

## 🌟 Level 3: Consolidating the Runtime
- [ ] **Step 15: Global Built-in Functions**
    - [ ] **Aggregation:** `min()`, `max()`, `sum()`, `any()`, `all()`.
    - [ ] **Iteration Helpers:** `enumerate()`, `zip()`, `reversed()`, `sorted()`.
    - [ ] **Type Checkers:** `type()`, `isinstance()`, `callable()`.
- [ ] **Step 16: Advanced Scoping & Assignment**
    - [ ] **Scope Control:** `global` and `nonlocal` keywords for explicit variable binding.
    - [ ] **Unpacking:** Multiple assignment (`x, y = 1, 2`) and star unpacking (`x, *y = [1, 2, 3]`).
    - [ ] **Default Args:** Support default values and keyword arguments in function calls.
- [ ] **Step 17: String & List API Parity**
    - [ ] **Strings:** `split`, `join`, `strip`, `replace`, `find`, `upper`, `lower`.
    - [ ] **Lists:** `append`, `extend`, `insert`, `remove`, `pop`, `sort`, `reverse`.

## 🌟 Level 4: Architecture & Abstractions
- [ ] **Step 18: Functional Programming**
    - [ ] `lambda` expressions (anonymous functions).
    - [ ] Higher-order functions: `map()`, `filter()`, `reduce()`.
- [ ] **Step 19: Object Model (Classes)**
    - [ ] Map Python `class` to JavaScript `class`.
    - [ ] `__init__`, `self` binding, method dispatch, and single inheritance.
- [ ] **Step 20: Basic System & IO**
    - [ ] Basic `try...except...finally` block.
    - [ ] Virtual `io` (e.g., `open()` to a memory-backed file registry).
