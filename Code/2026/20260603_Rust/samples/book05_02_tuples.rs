fn main() {
    let rect1 = (30, 50);

    print!(
        "The area of the rectangle is {} square pixels.",
        area(rect1)
    );
    0
}

fn area(dimensions: (u32, u32)) -> u32 {
    dimensions.0 * dimensions.1
}
