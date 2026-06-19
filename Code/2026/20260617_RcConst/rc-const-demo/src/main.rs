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

    /// Getter for name
    fn get_name(&self) -> Rc<ConstString> {
        self.name.clone()
    }

    /// Getter for age
    fn get_age(&self) -> i32 {
        self.age
    }

    fn set_age(self: &Rc<Self>, age: i32) -> Rc<Self> {
        Rc::new(Person {
            age,
            ..(**self).clone()
        })
    }

    fn add_friend_impl(self: &Rc<Self>, friend: Rc<Person>) -> Rc<Self> {
        Rc::new(Person {
            friends: self.friends.push(friend),
            ..(**self).clone()
        })
    }

    fn add_friend(self: &Rc<Self>, friend: &Rc<Person>) -> Rc<Self> {
        self.add_friend_impl(friend.clone())
    }
}

fn string(s: &str) -> Rc<ConstString> {
    ConstString::new(s)
}

fn list_i32_builder() -> Rc<ListBuilder<i32>> {
    ListBuilder::<i32>::new()
}

fn person(name: Rc<ConstString>, age: i32) -> Rc<Person> {
    Person::new(name, age)
}

fn log(s: Rc<ConstString>) {
    println!("{}", s);
}

struct StringBuilder {
    s: String,
}

impl StringBuilder {
    fn new() -> Self {
        StringBuilder { s: String::new() }
    }

    fn add<T: std::fmt::Display>(mut self, item: T) -> Self {
        use std::fmt::Write;
        write!(&mut self.s, "{}", item).unwrap();
        self
    }

    fn build(self) -> Rc<ConstString> {
        string(&self.s)
    }
}

fn builder() -> StringBuilder {
    StringBuilder::new()
}

fn main() {
    let name_alice = string("Alice");
    let name_bob = string("Bob");

    let mut alice = person(name_alice, 30);
    let mut bob = person(name_bob, 25);

    alice = alice.set_age(31);
    alice = alice.add_friend(&bob); 

    // Explicitly use the fields to avoid dead_code warnings
    println!("Alice's new age: {}", alice.get_age());
    println!("Alice after adding Bob:\n{:#?}", alice);

    bob = bob.add_friend(&alice);

    log(builder().add("\nBob's friend is: ").add(bob.friends.get_item(0).get_name()).build());
    println!("Bob after adding Alice:\n{:#?}", bob);
    
    // Using ConstMap with Rc handles
    let mut map = ConstMap::<Rc<ConstString>, Rc<Person>>::new();
    map = map.insert(alice.name.clone(), alice.clone());
    map = map.insert(bob.name.clone(), bob.clone());

    println!("\nMap contains Alice:\n{:#?}", map.get(&alice.name));
    
    // ListBuilder demonstration
    let mut lb = list_i32_builder();
    for i in 1..=3 {
        lb = lb.append(i);
    }
    println!("\nFinal list: {:#?}", lb.build());
}
