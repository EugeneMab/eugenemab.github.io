mod front_of_house {
    pub mod hosting {
        pub fn add_to_waitlist() {
            println!(1);
        }
    }
}

use crate::front_of_house::hosting;

mod customer {
    pub fn eat_at_restaurant() {
        // This should fail because 'hosting' is not brought into scope inside the 'customer' module
        hosting::add_to_waitlist();
    }
}

fn main() {
    customer::eat_at_restaurant();
    0
}
