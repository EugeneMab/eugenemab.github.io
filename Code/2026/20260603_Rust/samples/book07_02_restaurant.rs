mod front_of_house {
    pub mod hosting {
        pub fn add_to_waitlist() {
            print!(1);
        }

        pub fn seat_at_table() {
            print!(2);
        }
    }

    pub mod serving {
        pub fn take_order() {
            print!(3);
        }

        pub fn serve_order() {
            print!(4);
        }

        pub fn take_payment() {
            print!(5);
        }
    }
}

fn main() {
    front_of_house::hosting::add_to_waitlist();
    front_of_house::serving::take_payment();
    0
}
