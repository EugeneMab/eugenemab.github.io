#[cfg(test)]
mod tests {
    use rc_const::{ListBuilder, ConstStr, ConstVec, ConstMap};
    use std::rc::Rc;

    #[test]
    fn test_const_str() {
        let s = ConstStr::new("hello");
        assert_eq!(format!("{}", s), "hello");
    }

    #[test]
    fn test_list_builder_const_vec() {
        let mut b = ListBuilder::new();
        b = b.append(1);
        b = b.append(2);
        let list = b.build();
        assert_eq!(list.len(), 2);
        assert_eq!(list.get(0), Some(&1));
        assert_eq!(list.get(1), Some(&2));
    }

    #[test]
    fn test_const_map() {
        let mut m = ConstMap::new();
        let k = ConstStr::new("key");
        m = m.insert(k.clone(), 42);
        assert_eq!(m.get(&k), Some(&42));
    }
}
