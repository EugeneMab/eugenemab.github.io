fn main() {
    let a = [1, 2, 3, 4, 5];

    let slice = &a[1..3];

    // Simple check without assert_eq if not supported
    if slice[0] == 2 {
        println!("{}", slice[0]);
    }
    if slice[1] == 3 {
        println!("{}", slice[1]);
    }
}
