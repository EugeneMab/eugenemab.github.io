fn main() {
    let mut i = 0;
    loop {
        i = i + 1;
        if i == 5 {
            break;
        }
        if i == 2 {
            continue;
        }
        println!(i);
    }
    println!("done");
    0
}
