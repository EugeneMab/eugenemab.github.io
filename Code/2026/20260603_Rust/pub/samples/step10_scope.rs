// Step 10: Scope Detection
fn main() {
    let x = 1;
    {
        let x = 2;
        println!(x); // Should be 2
    }
    println!(x); // Should be 1
    0
}
