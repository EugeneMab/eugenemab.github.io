// Step 11: Region-Based Memory
fn main() {
    let p1 = alloc!(16);
    {
        let p2 = alloc!(32);
        print!(p2 - p1); // Should be 16
    }
    let p3 = alloc!(16);
    print!(p3 - p1); // Should be 16 (p2 was deallocated)
    0
}
