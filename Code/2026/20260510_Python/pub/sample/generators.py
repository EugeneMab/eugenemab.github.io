def fib():
    a = 0
    b = 1
    while True:
        yield a
        t = a + b
        a = b
        b = t

def main():
    g = fib()
    print(next(g))
    print(next(g))
    print(next(g))
    print(next(g))
    print(next(g))
    return next(g)
