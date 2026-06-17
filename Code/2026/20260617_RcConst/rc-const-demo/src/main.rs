use std::rc::Rc;
use rc_const::{ListBuilder, ConstStr, ConstVec, ConstMap};

#[derive(Debug, Clone)]
struct Person {
    name: ConstStr,
    age: i32,
    friends: ConstVec<Rc<Person>>,
}

impl Person {
    fn new(name: &str, age: i32) -> Rc<Self> {
        Rc::new(Person {
            name: ConstStr::new(name),
            age,
            friends: ConstVec::new(),
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
        Rc::new(Person {
            name: self.name.clone(),
            age: self.age,
            friends: self.friends.push(friend),
        })
    }
}

fn main() {
    let mut alice = Person::new("Alice", 30);
    let bob = Person::new("Bob", 25);

    alice = alice.set_age(31);
    alice = alice.add_friend(bob.clone());

    println!("Alice: {:?}", alice);

    // Using ListBuilder to create ConstVec
    let mut builder = ListBuilder::<i32>::new();
    for i in 0..10 {
        builder = builder.append(i);
    }
    let list = builder.build();
    println!("List from builder (ConstVec): {:?}", list);

    // Using ConstMap
    let mut map = ConstMap::<ConstStr, Rc<Person>>::new();
    map = map.insert(alice.name.clone(), alice.clone());
    map = map.insert(bob.name.clone(), bob.clone());

    println!("Map contains Alice: {:?}", map.get(&alice.name));
}
