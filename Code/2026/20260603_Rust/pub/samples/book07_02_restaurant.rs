mod front_of_house {
    pub mod hosting {
        pub fn add_to_waitlist() {
            println!(1);
        }

        pub fn seat_at_table() {
            println!(2);
        }
    }

    pub mod serving {
        pub fn take_order() {
            println!(3);
        }

        pub fn serve_order() {
            println!(4);
        }

        pub fn take_payment() {
            println!(5);
        }
    }
}

fn main() {
    front_of_house::hosting::add_to_waitlist();
    front_of_house::serving::take_payment();
    0
}
