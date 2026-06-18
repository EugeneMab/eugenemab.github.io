use std::rc::Rc;
use std::collections::{HashMap, HashSet};
use crate::{ConstVec, ConstMap, ConstSet};

pub struct ListBuilder<T> {
    item: Option<T>,
    prev: Option<Rc<ListBuilder<T>>>,
    size: usize,
}

impl<T: Clone> ListBuilder<T> {
    pub fn new() -> Rc<Self> {
        Rc::new(ListBuilder {
            item: None,
            prev: None,
            size: 0,
        })
    }

    pub fn append(self: &Rc<Self>, item: T) -> Rc<Self> {
        Rc::new(ListBuilder {
            item: Some(item),
            prev: Some(self.clone()),
            size: self.size + 1,
        })
    }

    pub fn build(&self) -> Rc<ConstVec<T>> {
        let mut items = Vec::with_capacity(self.size);
        let mut curr = Some(self);
        while let Some(node) = curr {
            if let Some(ref item) = node.item {
                items.push(item.clone());
            }
            curr = node.prev.as_ref().map(|p| p.as_ref());
        }
        items.reverse();
        ConstVec::from_vec(items)
    }
}

pub struct MapBuilder<K, V> {
    entry: Option<(K, V)>,
    prev: Option<Rc<MapBuilder<K, V>>>,
    size: usize,
}

impl<K: Clone + Eq + std::hash::Hash, V: Clone> MapBuilder<K, V> {
    pub fn new() -> Rc<Self> {
        Rc::new(MapBuilder {
            entry: None,
            prev: None,
            size: 0,
        })
    }

    pub fn insert(self: &Rc<Self>, key: K, value: V) -> Rc<Self> {
        Rc::new(MapBuilder {
            entry: Some((key, value)),
            prev: Some(self.clone()),
            size: self.size + 1,
        })
    }

    pub fn build(&self) -> Rc<ConstMap<K, V>> {
        let mut map = HashMap::with_capacity(self.size);
        let mut curr = Some(self);
        while let Some(node) = curr {
            if let Some((ref k, ref v)) = node.entry {
                map.insert(k.clone(), v.clone());
            }
            curr = node.prev.as_ref().map(|p| p.as_ref());
        }
        ConstMap::from_map(map)
    }
}

pub struct SetBuilder<T> {
    item: Option<T>,
    prev: Option<Rc<SetBuilder<T>>>,
    size: usize,
}

impl<T: Clone + Eq + std::hash::Hash> SetBuilder<T> {
    pub fn new() -> Rc<Self> {
        Rc::new(SetBuilder {
            item: None,
            prev: None,
            size: 0,
        })
    }

    pub fn insert(self: &Rc<Self>, item: T) -> Rc<Self> {
        Rc::new(SetBuilder {
            item: Some(item),
            prev: Some(self.clone()),
            size: self.size + 1,
        })
    }

    pub fn build(&self) -> Rc<ConstSet<T>> {
        let mut set = HashSet::with_capacity(self.size);
        let mut curr = Some(self);
        while let Some(node) = curr {
            if let Some(ref item) = node.item {
                set.insert(item.clone());
            }
            curr = node.prev.as_ref().map(|p| p.as_ref());
        }
        ConstSet::from_set(set)
    }
}
