fn show_slice(s: &str) {
    println!("{}", s);
}

fn main() {
    let my_string = String::from("hello world");

    show_slice(&my_string[0..6]);
    show_slice(&my_string[..]);
    show_slice(&my_string);

    let my_string_literal = "hello world";

    show_slice(&my_string_literal[0..6]);
    show_slice(&my_string_literal[..]);
    show_slice(my_string_literal);
}
