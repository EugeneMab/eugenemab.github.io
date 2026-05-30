def main():
    # String Methods
    s = "  Python to JavaScript  "
    stripped = s.strip()
    words = stripped.split()
    joined = "-".join(words)
    upper = joined.upper()
    replaced = upper.replace("PYTHON", "PY", 1)
    
    print(f"Original: '{s}'")
    print(f"Stripped: '{stripped}'")
    print(f"Split: {words}")
    print(f"Joined: '{joined}'")
    print(f"Upper: '{upper}'")
    print(f"Replaced: '{replaced}'")
    print(f"Index of 'JS': {replaced.find('JS')}")

    # List Methods
    l = [5, 2, 8]
    l.append(1)
    l.extend([3, 4])
    print(f"List after append/extend: {l}")
    
    l.insert(1, 10)
    print(f"After insert at 1: {l}")
    
    l.remove(8)
    print(f"After removing 8: {l}")
    
    popped = l.pop(0)
    print(f"Popped index 0: {popped}, Remaining: {l}")
    
    l.sort()
    print(f"Sorted: {l}")
    
    l.reverse()
    print(f"Reversed: {l}")
    
    return len(l)
