// Book 6-1: Methods on enums example
enum Message {
    Write(&'static str),
}

impl Message {
    fn call(&self) -> i32 {
        match self {
            Message::Write(_) => 0,
        }
    }
}

fn main() { let m = Message::Write("hello"); m.call(); 0 }
