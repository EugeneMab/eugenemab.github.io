fn main() {
    let x = 10;
    {
        let y = 20;
        println!("inner y: {y}");
    }
    println!("outer x: {x}");
    0
}
