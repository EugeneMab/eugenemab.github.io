fn main() {
    let mut x = 5;
    {
        let borrow = &mut x;
        println!("borrowed mutably");
    }
    x = 6;
    println!("x after borrow: {x}");
    0
}
