// Book 3-3: Functions
fn another_function(x: i32) {
    print!("The value of x is: ");
    print!(x);
}

fn plus_one(x: i32) -> i32 {
    x + 1
}

fn main() {
    another_function(5);
    let x = plus_one(4);
    print!(x);
    0
}
