def main():
    # Arithmetic
    a = 10 // 3
    b = 10 % 3
    c = 2 ** 3
    
    # Bitwise
    d = 5 & 3
    e = 5 | 3
    f = 5 ^ 3
    g = ~5
    h = 1 << 3
    i = 16 >> 2
    
    # Membership
    l = [1, 2, 3]
    j = 1 in l
    k = 4 not in l
    
    print(f"Arithmetic: {a}, {b}, {c}")
    print(f"Bitwise: {d}, {e}, {f}, {g}, {h}, {i}")
    print(f"Membership: {j}, {k}")
    
    return a + b + c + d + e + f + g + h + i
