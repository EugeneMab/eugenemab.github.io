def main():
    # Implicit line joining within parentheses
    total = (
        1 +
        2 +
        3 +
        4
    )
    print(f"Total from multi-line paren: {total}")

    # Implicit line joining within lists
    fruits = [
        "apple",
        "banana",
        "cherry"
    ]
    print(f"Fruits list: {fruits}")

    # Implicit line joining within dicts
    mapping = {
        "one": 1,
        "two": 2,
        "three": 3
    }
    print(f"Mapping: {mapping}")

    # Explicit line continuation with backslash
    sentence = "This is a very long sentence that " + \
               "we decided to split across lines " + \
               "using a backslash."
    print(sentence)

    # Multi-line function call
    res = max(
        total,
        len(fruits),
        len(mapping)
    )
    print(f"Max value: {res}")

    return res
