def main():
    # Lambda expressions
    square = lambda x: x * x
    add = lambda x, y=0: x + y
    
    print(f"Square of 5: {square(5)}")
    print(f"Add 10 and 20: {add(10, 20)}")
    print(f"Add 10 with default: {add(10)}")
    
    # Higher-order functions
    numbers = [1, 2, 3, 4, 5]
    
    # map
    squared_numbers = map(lambda x: x * x, numbers)
    print(f"Squared numbers: {squared_numbers}")
    
    # filter
    even_numbers = filter(lambda x: x % 2 == 0, numbers)
    print(f"Even numbers: {even_numbers}")
    
    # reduce
    sum_all = reduce(lambda x, y: x + y, numbers)
    print(f"Sum of all: {sum_all}")
    
    # Combined
    res = reduce(lambda x, y: x + y, map(lambda x: x * 10, filter(lambda x: x > 3, numbers)))
    print(f"Combined result: {res}")
    
    return res
