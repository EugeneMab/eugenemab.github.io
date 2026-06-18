#[cfg(test)]
mod tests {
    use rc_const::{ListBuilder, ConstString, ConstMap};

    #[test]
    fn test_const_string() {
        let s = ConstString::new("hello");
        assert_eq!(format!("{}", s), "hello");
        // Test improved debug output
        assert_eq!(format!("{:?}", s), "\"hello\"");
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
        // Test improved debug output (no ConstVec prefix)
        assert_eq!(format!("{:?}", list), "[1, 2]");
    }

    #[test]
    fn test_const_map() {
        let mut m = ConstMap::new();
        let k = ConstString::new("key");
        m = m.insert(k.clone(), 42);
        assert_eq!(m.get(&k), Some(&42));
    }
}
