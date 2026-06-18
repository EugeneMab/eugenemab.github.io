use std::rc::Rc;
use rc_const::{ListBuilder, ConstString, ConstVec, ConstMap};

#[derive(Debug, Clone)]
struct Person {
    name: Rc<ConstString>,
    age: i32,
    friends: Rc<ConstVec<Rc<Person>>>,
}

impl Person {
    fn new(name: Rc<ConstString>, age: i32) -> Rc<Self> {
        Rc::new(Person {
            name,
            age,
            friends: ConstVec::new(),
        })
    }

    fn set_age(self: &Rc<Self>, age: i32) -> Rc<Self> {
        Rc::new(Person {
            age,
            ..(**self).clone()
        })
    }

    fn add_friend(self: &Rc<Self>, friend: Rc<Person>) -> Rc<Self> {
        Rc::new(Person {
            friends: self.friends.push(friend),
            ..(**self).clone()
        })
    }
}

fn main() {
    let name_alice = ConstString::new("Alice");
    let name_bob = ConstString::new("Bob");

    let mut alice = Person::new(name_alice, 30);
    let mut bob = Person::new(name_bob, 25);

    alice = alice.set_age(31);
    alice = alice.add_friend(bob.clone()); 

    // Use {:#?} for pretty-printing with indentation and EOL
    println!("Alice after adding Bob:\n{:#?}", alice);

    bob = bob.add_friend(alice.clone());

    println!("\nBob after adding Alice:\n{:#?}", bob);
    
    // Using ConstMap with Rc handles
    let mut map = ConstMap::<Rc<ConstString>, Rc<Person>>::new();
    map = map.insert(alice.name.clone(), alice.clone());
    map = map.insert(bob.name.clone(), bob.clone());

    println!("\nMap contains Alice:\n{:#?}", map.get(&alice.name));
    
    // ListBuilder demonstration
    let mut lb = ListBuilder::<i32>::new();
    for i in 1..=3 {
        lb = lb.append(i);
    }
    println!("\nFinal list: {:#?}", lb.build());
}
