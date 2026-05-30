def main():
    # Aggregation
    numbers = [1, 2, 3, 4, 5]
    s = sum(numbers)
    m1 = min(numbers)
    m2 = max(numbers)
    b1 = any([0, False, 1])
    b2 = all([1, True, "abc"])
    
    print(f"Aggregation: sum={s}, min={m1}, max={m2}, any={b1}, all={b2}")
    
    # Iteration Helpers
    names = ["Alice", "Bob"]
    print("Enumerate:")
    for i, name in enumerate(names):
        print(f"  {i}: {name}")
    
    ages = [25, 30]
    print("Zip:")
    for name, age in zip(names, ages):
        print(f"  {name} is {age}")
        
    print(f"Reversed: {reversed(numbers)}")
    print(f"Sorted: {sorted([3, 1, 4, 2])}")
    
    # Type Checkers
    print(f"Type of 1: {type(1)}")
    print(f"Is 1 a number? {isinstance(1, 'number')}")
    print(f"Is main callable? {callable(main)}")
    
    return s
