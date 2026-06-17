use std::rc::Rc;
use crate::ConstVec;

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

    pub fn build(&self) -> ConstVec<T> {
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
