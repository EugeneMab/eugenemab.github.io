# Implementation Steps

## Step 1: Infrastructure & UI Update
- [x] Update `tsconfig.json` to output to `pub/js`.
- [x] Update `index.html` to load `js/main.js`.
- [x] Verify `build.cmd` works with the new structure.

## Step 2: Lexer (Python Subset)
- [x] Implement `src/lexer.ts`.
- [x] Handle keywords, identifiers, literals, and operators.
- [x] **New:** Support for single-line comments (`#`).
- [x] **Crucial:** Implement indentation tracking to emit `INDENT` and `DEDENT` tokens.
- [x] **Granular Testing:**
    - [x] `test_keywords`: Verify `def`, `return`, `while`, etc.
    - [x] `test_indentation`: Check mixed spaces/tabs and nested blocks.
    - [x] `test_comments`: Ensure `#` and trailing text are ignored.
    - [x] `test_literals`: Validate integers and future float/string placeholders.

## Step 3: Parser (AST)
- [x] Implement `src/parser.ts` with Recursive Descent.
- [x] **New:** Support for parentheses `()` to override operator precedence.
- [x] **New:** Support for unary operators (e.g., negative numbers like `-5` or `1 + -5`).
- [x] Support Function definitions (`def`), Assignments, and Arithmetic.
- [x] **Granular Testing:**
    - [x] `test_precedence`: Verify `1 + 2 * 3` vs `(1 + 2) * 3`.
    - [x] `test_unary`: Validate `-x`, `5 + -3`, and `--5`.
    - [x] `test_nesting`: Ensure deep AST structures for complex expressions.

## Step 4: Emitter (WAT & WASM)
- [x] Generate human-readable `.wat` and binary `.wasm`.
- [x] Encode LEB128 and Section headers.
- [x] **Granular Testing:**
    - [x] `test_leb128`: Verify encoding of large integers.
    - [x] `test_sections`: Validate Type, Import, Function, and Export sections.
    - [x] `test_opcodes`: Check mapping of AST nodes to WASM opcodes.

## Step 5: Execution & Integration
- [x] Connect `main.ts` to `WebAssembly.instantiate`.
- [x] **Granular Testing:**
    - [x] `test_runtime_return`: Verify `main()` returns expected values.
    - [x] `test_error_ui`: Confirm line/col highlighting for syntax errors.

## Step 6: Control Flow & Booleans
- [ ] Implement `if`, `elif`, `else` statements.
- [ ] Add boolean literals (`True`, `False`) and logic (`and`, `or`, `not`).
- [ ] Implement comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`).
- [ ] **Granular Testing:**
    - [ ] `test_if_else`: Basic branching.
    - [ ] `test_elif_chain`: Multiple condition branches.
    - [ ] `test_boolean_logic`: Complex `and/or/not` combinations.

## Step 7: Parameters & Scoping
- [ ] Support function parameters and multiple arguments.
- [ ] Implement local variable scoping.
- [ ] **Granular Testing:**
    - [ ] `test_params`: Passing 1, 2, and 5+ arguments.
    - [ ] `test_recursion`: Fibonacci and Factorial implementations.
    - [ ] `test_shadowing`: Local variables shadowing globals.

## Step 8: Memory Management & Lists
- [ ] Implement a Linear Memory Allocator.
- [ ] Add support for `list` creation, indexing, and `len()`.
- [ ] **Granular Testing:**
    - [ ] `test_list_init`: `[1, 2, 3]` allocation.
    - [ ] `test_list_indexing`: Reading and writing to list indices.
    - [ ] `test_out_of_bounds`: Basic checks for index errors.

## Step 9: Built-ins & Math
- [ ] Emulate `range()`, `abs()`, and `print()`.
- [ ] **New:** Implement `math` functions: `sqrt`, `pow`, `sin`, `cos`.
- [ ] **Granular Testing:**
    - [ ] `test_math_pow`: Verify `pow(x, y)`.
    - [ ] `test_math_trig`: Validate `sin` and `cos` results.
    - [ ] `test_range_iterator`: Correct loop counts.

## Step 10: Objects & Classes
- [ ] Implement `class`, `self`, and `__init__`.
- [ ] **Granular Testing:**
    - [ ] `test_class_instantiation`: Property storage in memory.
    - [ ] `test_method_calls`: Correct `self` pointer passing.

## Step 11: Exceptions & Runtime
- [ ] **New:** Detect and handle runtime errors like `1 / 0`.
- [ ] **New:** Basic `try...except` block support.
- [ ] **Granular Testing:**
    - [ ] `test_division_by_zero`: Ensure execution halts with error.
    - [ ] `test_try_except`: Proper catch and recovery flow.

## Step 12: Advanced Functions
- [ ] **New:** Implement Lambda functions and Closures.
- [ ] **Granular Testing:**
    - [ ] `test_lambda`: Inline function execution.
    - [ ] `test_closure`: Inner functions capturing local scope.
