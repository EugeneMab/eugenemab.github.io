fn deliver_order() {
    println!(100);
}

mod back_of_house {
    pub fn fix_incorrect_order() {
        cook_order();
        super::deliver_order();
    }

    fn cook_order() {
        println!(10);
    }
}

fn main() {
    back_of_house::fix_incorrect_order();
    0
}
