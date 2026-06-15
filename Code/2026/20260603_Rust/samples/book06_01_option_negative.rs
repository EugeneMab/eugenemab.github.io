// Book 6-1: Negative example - using Option directly (should not compile)
fn main() {
    let x: i8 = 5;
    let y: Option<i8> = Some(5);
    // This is intentionally invalid in Rust: adding Option to i8
    let _z = x + y;
}
