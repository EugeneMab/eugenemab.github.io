use std::rc::Rc;
use std::collections::{HashMap, HashSet};
use std::hash::Hash;
use std::fmt;

/// A Constant String (meant to be used as Rc<ConstString>)
#[derive(Clone, PartialEq, Eq, Hash)]
pub struct ConstString(String);

impl ConstString {
    pub fn new(s: &str) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstString::new({:?})", s);
        Rc::new(ConstString(s.to_string()))
    }
}

#[cfg(feature = "test-logs")]
impl Drop for ConstString {
    fn drop(&mut self) {
        println!("- [DEBUG] ConstString::drop({:?})", self.0);
    }
}

impl fmt::Display for ConstString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl fmt::Debug for ConstString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Just show the string value, e.g., "Alice" instead of ConstString("Alice")
        write!(f, "{:?}", self.0)
    }
}

/// A Constant Vector (meant to be used as Rc<ConstVec<T>>)
#[derive(Clone)]
pub struct ConstVec<T>(Vec<T>);

impl<T: Clone> ConstVec<T> {
    pub fn new() -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstVec::new()");
        Rc::new(ConstVec(Vec::new()))
    }

    pub fn from_vec(v: Vec<T>) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstVec::from_vec(len={})", v.len());
        Rc::new(ConstVec(v))
    }

    pub fn push(self: &Rc<Self>, item: T) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstVec::push (new len={})", self.0.len() + 1);
        let mut new_vec = self.0.clone();
        new_vec.push(item);
        Rc::new(ConstVec(new_vec))
    }

    pub fn get(&self, index: usize) -> Option<&T> {
        self.0.get(index)
    }

    pub fn get_item(&self, index: usize) -> T {
        self.0.get(index).unwrap().clone()
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }
}

#[cfg(feature = "test-logs")]
impl<T> Drop for ConstVec<T> {
    fn drop(&mut self) {
        println!("- [DEBUG] ConstVec::drop(len={})", self.0.len());
    }
}

impl<T: fmt::Debug> fmt::Debug for ConstVec<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Delegate to Vec's debug implementation for standard look [...]
        self.0.fmt(f)
    }
}

/// A Constant Map (meant to be used as Rc<ConstMap<K, V>>)
#[derive(Clone)]
pub struct ConstMap<K, V>(HashMap<K, V>);

impl<K: Clone + Eq + Hash, V: Clone> ConstMap<K, V> {
    pub fn new() -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstMap::new()");
        Rc::new(ConstMap(HashMap::new()))
    }

    pub fn from_map(m: HashMap<K, V>) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstMap::from_map(size={})", m.len());
        Rc::new(ConstMap(m))
    }

    pub fn insert(self: &Rc<Self>, key: K, value: V) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstMap::insert (new size={})", self.0.len() + 1);
        let mut new_map = self.0.clone();
        new_map.insert(key, value);
        Rc::new(ConstMap(new_map))
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.0.get(key)
    }
}

#[cfg(feature = "test-logs")]
impl<K, V> Drop for ConstMap<K, V> {
    fn drop(&mut self) {
        println!("- [DEBUG] ConstMap::drop(size={})", self.0.len());
    }
}

impl<K: fmt::Debug, V: fmt::Debug> fmt::Debug for ConstMap<K, V> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// A Constant Set (meant to be used as Rc<ConstSet<T>>)
#[derive(Clone)]
pub struct ConstSet<T>(HashSet<T>);

impl<T: Clone + Eq + Hash> ConstSet<T> {
    pub fn new() -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstSet::new()");
        Rc::new(ConstSet(HashSet::new()))
    }

    pub fn from_set(s: HashSet<T>) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstSet::from_set(size={})", s.len());
        Rc::new(ConstSet(s))
    }

    pub fn insert(self: &Rc<Self>, item: T) -> Rc<Self> {
        #[cfg(feature = "test-logs")]
        println!("+ [DEBUG] ConstSet::insert (new size={})", self.0.len() + 1);
        let mut new_set = self.0.clone();
        new_set.insert(item);
        Rc::new(ConstSet(new_set))
    }

    pub fn contains(&self, item: &T) -> bool {
        self.0.contains(item)
    }
}

#[cfg(feature = "test-logs")]
impl<T> Drop for ConstSet<T> {
    fn drop(&mut self) {
        println!("- [DEBUG] ConstSet::drop(size={})", self.0.len());
    }
}

impl<T: fmt::Debug> fmt::Debug for ConstSet<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

pub mod builders;
pub use builders::{ListBuilder, MapBuilder, SetBuilder};

/// Helper to create a new Rc<ConstString>
pub fn string(s: &str) -> Rc<ConstString> {
    ConstString::new(s)
}

/// Helper to create a new ListBuilder<T>
pub fn list_builder<T: Clone>() -> Rc<ListBuilder<T>> {
    ListBuilder::new()
}
