#[cfg(test)]
mod tests {
    use rc_const::{ListBuilder, ConstString, ConstMap};

    #[test]
    fn test_const_string() {
        println!();
        let s = ConstString::new("hello");
        assert_eq!(format!("{}", s), "hello");
        // Test improved debug output
        assert_eq!(format!("{:?}", s), "\"hello\"");
    }

    #[test]
    fn test_list_builder_const_vec() {
        println!();
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
        println!();
        let mut m = ConstMap::new();
        let k = ConstString::new("key");
        m = m.insert(k.clone(), 42);
        assert_eq!(m.get(&k), Some(&42));
    }

    #[test]
    fn test_memory_lifecycle() {
        println!("\n--- Starting Lifecycle Test ---");
        {
            let s1 = ConstString::new("Outer");
            println!("Created s1: {}", s1);
            {
                let s2 = ConstString::new("Inner");
                println!("Created s2: {}", s2);
                let list = ListBuilder::new()
                    .append(s1.clone())
                    .append(s2.clone())
                    .build();
                println!("Created list with {} items", list.len());
            }
            println!("Exited inner scope, s2 and list should be dropped");
        }
        println!("Exited outer scope, s1 should be dropped");
        println!("--- Ending Lifecycle Test ---\n");
    }

    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::rc::Rc;

    static DROP_COUNT: AtomicUsize = AtomicUsize::new(0);

    struct LeakDetector;
    impl Drop for LeakDetector {
        fn drop(&mut self) {
            DROP_COUNT.fetch_add(1, Ordering::SeqCst);
        }
    }

    #[test]
    fn test_no_leaks_programmatic() {
        println!();
        DROP_COUNT.store(0, Ordering::SeqCst);
        {
            let detector = Rc::new(LeakDetector);
            let _list = ListBuilder::new()
                .append(detector.clone())
                .append(detector.clone())
                .build();
        }
        // After scope, detector and list (holding clones) should be dropped.
        // The original detector and its 2 clones in builder and 2 clones in list
        // all point to the same inner LeakDetector.
        assert_eq!(DROP_COUNT.load(Ordering::SeqCst), 1);
    }
}
