def main():
    # Unpacking
    x, y = 1, 2
    a, *b, c = [3, 4, 5, 6]
    print(f"Unpacking: x={x}, y={y}, a={a}, b={b}, c={c}")
    
    # Scoping
    count = 0
    def outer():
        val = 10
        def inner():
            nonlocal val
            val = 20
        inner()
        return val
    
    res_scoping = outer()
    print(f"Scoping: res={res_scoping}")
    
    # Default & Keywords
    def greet(name, msg="Hello"):
        print(f"{msg}, {name}!")
        return f"{msg}, {name}!"
    
    greet("Alice")
    greet(msg="Hi", name="Bob")
    
    return x + y + a + c + res_scoping
