fn main() {
    let mut x = 5;
    {
        let borrow = &mut x;
        print!("borrowed mutably");
    }
    x = 6;
    print!("x after borrow: ");
    print!(x);
    0
}
