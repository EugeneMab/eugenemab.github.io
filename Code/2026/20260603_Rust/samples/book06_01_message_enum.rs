// Book 6-1: Listing 6-2 - Message enum with different variant data
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(&'static str),
    ChangeColor(i32, i32, i32),
}

fn main() {
    let m = Message::Write("hello");
    0
}
