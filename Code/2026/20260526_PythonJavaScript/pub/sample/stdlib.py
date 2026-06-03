def main():
    # Numeric helpers
    print(f"bin(255): {bin(255)}")
    print(f"oct(255): {oct(255)}")
    print(f"round(3.14159, 2): {round(3.14159, 2)}")
    q, r = divmod(10, 3)
    print(f"divmod(10, 3): q={q}, r={r}")

    # String methods
    s = "Python Transpiler"
    print(f"s.startswith('Py'): {s.startswith('Py')}")
    print(f"s.endswith('er'): {s.endswith('er')}")
    print(f"s.count('n'): {s.count('n')}")
    print(f"'123'.isdigit(): {'123'.isdigit()}")
    print(f"'ABC'.islower(): {'ABC'.islower()}")
    
    # Advanced formatting
    fmt = "Hello, {}! Welcome to {}."
    print(fmt.format("World", "Step 22"))
    print("Value: {:.2f}".format(123.456))

    # List and Dict methods
    d = {"a": 1, "b": 2}
    print(f"d.get('a'): {d.get('a')}")
    print(f"d.get('c', 0): {d.get('c', 0)}")
    print(f"d.keys(): {list(d.keys())}")
    print(f"d.values(): {list(d.values())}")
    print(f"d.items(): {list(d.items())}")
    
    items = [1, 2, 2, 3]
    print(f"items.count(2): {items.count(2)}")
    
    d.update({"c": 3})
    print(f"Updated d: {d}")
    
    d_copy = d.copy()
    d_copy.clear()
    print(f"Cleared copy: {d_copy}")
    print(f"Original d: {d}")

    return "Done"
