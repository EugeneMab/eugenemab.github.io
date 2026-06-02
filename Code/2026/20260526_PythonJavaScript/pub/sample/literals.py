def main():
    # If-expressions (Ternary)
    x = 10
    msg = "greater than 5" if x > 5 else "less or equal"
    print(f"If-expression result: {msg}")
    
    # Hex numbers and conversion
    h1 = 0xFF
    h2 = 0x10
    print(f"Hex values: {h1}, {h2}")
    print(f"h1 as hex string: {hex(h1)}")
    
    large_hex = "deadbeef"
    converted = int(large_hex, 16)
    print(f"Large hex '{large_hex}' to int: {converted}")
    print(f"Verify back to hex: {hex(converted)}")
    
    # Multi-line strings
    multiline = """
    This is a multi-line string.
    It spans multiple lines.
    "Quotes" and 'single quotes' are fine.
    """
    print(f"Multi-line string length: {len(multiline)}")
    print("Multi-line content:")
    print(multiline)
    
    # Comments and Docstrings
    """
    This is a docstring-style multi-line string used as a comment.
    In Python, this is technically a statement, but often serves as documentation.
    """
    # This is a single line comment
    
    return converted
