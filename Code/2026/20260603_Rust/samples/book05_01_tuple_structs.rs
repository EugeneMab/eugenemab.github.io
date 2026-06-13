struct Color(i32, i32, i32);
struct Point(i32, i32, i32);

fn main() {
    let black = Color(1, 2, 3);
    let origin = Point(10, 20, 30);

    println!(black.0);
    println!(black.1);
    println!(black.2);
    println!(origin.0);
    println!(origin.1);
    println!(origin.2);
    0
}
