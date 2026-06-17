use std::rc::Rc;
use rc_const::ListBuilder;

#[derive(Debug, Clone)]
struct Person {
    name: String,
    age: i32,
    friends: Rc<Vec<Rc<Person>>>,
}

impl Person {
    fn new(name: &str, age: i32) -> Rc<Self> {
        Rc::new(Person {
            name: name.to_string(),
            age,
            friends: Rc::new(Vec::new()),
        })
    }

    fn set_age(self: &Rc<Self>, age: i32) -> Rc<Self> {
        Rc::new(Person {
            name: self.name.clone(),
            age,
            friends: self.friends.clone(),
        })
    }

    fn add_friend(self: &Rc<Self>, friend: Rc<Person>) -> Rc<Self> {
        let mut new_friends = (*self.friends).clone();
        new_friends.push(friend);
        Rc::new(Person {
            name: self.name.clone(),
            age: self.age,
            friends: Rc::new(new_friends),
        })
    }
}

fn main() {
    let mut alice = Person::new("Alice", 30);
    let bob = Person::new("Bob", 25);

    alice = alice.set_age(31);
    alice = alice.add_friend(bob.clone());

    println!("Alice: {:?}", alice);

    let mut builder = ListBuilder::<i32>::new();
    for i in 0..10 {
        builder = builder.append(i);
    }
    let list = builder.build();
    println!("List from builder: {:?}", list);
}
