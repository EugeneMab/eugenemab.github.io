// Step 12: Borrow Checker
fn main() {
    let mut x = 5;
    let y = &mut x;
    // let z = &mut x; // ERROR: Second mutable borrow
    // println!(x);    // ERROR: Cannot use x while mutably borrowed
    0
}
