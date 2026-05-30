def main():
    t = (1, 2, 3)
    s = {x for x in t}
    s2 = {1, 2, 3}
    d = {"a": 1, "b": 2}
    b = b"hello"
    print(t)
    print(s)
    print(s2)
    print(d)
    print(b)
    return len(t) + len(s) + len(d) + len(b) + len(s2)
