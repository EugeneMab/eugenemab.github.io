def main():
    x = [1, 2, 3, 4, 5]
    # List comprehension with filtering
    evens = [i * 2 for i in x if i < 4]
    # evens should be [2, 4, 6]
    return evens[2] # Expected 6
