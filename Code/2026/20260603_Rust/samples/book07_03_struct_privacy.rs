mod back_of_house {
    pub struct Breakfast {
        pub toast: i32,
        seasonal_fruit: i32,
    }

    impl Breakfast {
        pub fn summer(toast: i32) -> Breakfast {
            Breakfast {
                toast,
                seasonal_fruit: 50,
            }
        }
    }
}

pub fn eat_at_restaurant() {
    // Order a breakfast in the summer with Rye toast (represented by 1)
    let mut meal = back_of_house::Breakfast::summer(1);
    // Change our mind about what bread we'd like
    meal.toast = 2;
    println!(meal.toast);

    // The next line won't compile if we enforce privacy, but for now we just check it runs
    // meal.seasonal_fruit = 60;
}

fn main() {
    eat_at_restaurant();
    0
}
