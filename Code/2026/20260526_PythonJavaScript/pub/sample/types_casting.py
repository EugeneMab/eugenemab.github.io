def main():
    print("--- Integers & Floats ---")
    i = int("42")
    f = float("3.14")
    print(f"int('42') = {i}")
    print(f"float('3.14') = {f}")
    print(f"int(3.9) = {int(3.9)}")
    
    print("--- Strings ---")
    c = chr(65)
    o = ord("A")
    print(f"chr(65) = {c}")
    print(f"ord('A') = {o}")
    
    # Raw string
    raw = r"C:\path\to\file\n"
    print(f"Raw string: {raw}")
    
    print("--- Booleans & Truthiness ---")
    print(f"bool(1) = {bool(1)}")
    print(f"bool(0) = {bool(0)}")
    print(f"bool([]) = {bool([])}")
    print(f"bool([1]) = {bool([1])}")
    
    if []:
        print("Empty list is truthy (Error!)")
    else:
        print("Empty list is falsy (Correct)")
        
    print("--- Large Numbers ---")
    large = 12345678901234567890
    print(f"Large number: {large}")

    return "Done"
