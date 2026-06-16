mod back_of_house {
    pub enum Appetizer {
        Soup,
        Salad,
    }
}

pub fn eat_at_restaurant() {
    let order1 = back_of_house::Appetizer::Soup;
    let order2 = back_of_house::Appetizer::Salad;
    
    // We can't print enums yet easily without match, but let's check they work
    match order1 {
        back_of_house::Appetizer::Soup => { print!(1); }
        back_of_house::Appetizer::Salad => { print!(2); }
    }
}

fn main() {
    eat_at_restaurant();
    0
}
