fn main() {
    let x = 10;
    {
        let y = 20;
        print!("inner y: ");
        print!(y);
    }
    print!("outer x: ");
    print!(x);
    0
}
