struct Color(i32, i32, i32);
struct Point(i32, i32, i32);

fn main() {
    let black = Color(1, 2, 3);
    let origin = Point(10, 20, 30);

    print!(black.0);
    print!(black.1);
    print!(black.2);
    print!(origin.0);
    print!(origin.1);
    print!(origin.2);
    0
}
