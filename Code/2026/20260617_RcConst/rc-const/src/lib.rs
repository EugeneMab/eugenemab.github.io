use std::rc::Rc;
use std::collections::{HashMap, HashSet};
use std::hash::Hash;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ConstStr(Rc<str>);

impl ConstStr {
    pub fn new(s: &str) -> Self {
        ConstStr(Rc::from(s))
    }
}

impl std::fmt::Display for ConstStr {
    fn fmt(&self, f: &mut std::fmt::Formatter<"_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone)]
pub struct ConstVec<T>(Rc<Vec<T>>);

impl<T: Clone> ConstVec<T> {
    pub fn new() -> Self {
        ConstVec(Rc::new(Vec::new()))
    }

    pub fn from_vec(v: Vec<T>) -> Self {
        ConstVec(Rc::new(v))
    }

    pub fn push(&self, item: T) -> Self {
        let mut new_vec = (*self.0).clone();
        new_vec.push(item);
        ConstVec(Rc::new(new_vec))
    }

    pub fn get(&self, index: usize) -> Option<&T> {
        self.0.get(index)
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }
}

#[derive(Debug, Clone)]
pub struct ConstMap<K, V>(Rc<HashMap<K, V>>);

impl<K: Clone + Eq + Hash, V: Clone> ConstMap<K, V> {
    pub fn new() -> Self {
        ConstMap(Rc::new(HashMap::new()))
    }

    pub fn insert(&self, key: K, value: V) -> Self {
        let mut new_map = (*self.0).clone();
        new_map.insert(key, value);
        ConstMap(Rc::new(new_map))
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.0.get(key)
    }
}

#[derive(Debug, Clone)]
pub struct ConstSet<T>(Rc<HashSet<T>>);

impl<T: Clone + Eq + Hash> ConstSet<T> {
    pub fn new() -> Self {
        ConstSet(Rc::new(HashSet::new()))
    }

    pub fn insert(&self, item: T) -> Self {
        let mut new_set = (*self.0).clone();
        new_set.insert(item);
        ConstSet(Rc::new(new_set))
    }

    pub fn contains(&self, item: &T) -> bool {
        self.0.contains(item)
    }
}

pub mod builders;
pub use builders::ListBuilder;
