def __enter__(mgr):
    print("--- Enter Context ---")
    print(mgr)
    return mgr * 2

def __exit__(mgr, type, value, tb):
    print("--- Exit Context ---")
    print(mgr)

def main():
    print("Starting test...")
    
    with 10 as val:
        print("Inside with block")
        print(val)
        if val > 15:
            print("Early return!")
            return val
    
    print("After with block")
    return 0

main()
