#[cfg(test)]
mod tests {
    use rc_const::ListBuilder;

    #[test]
    fn test_list_builder() {
        let mut b = ListBuilder::new();
        b = b.append(1);
        b = b.append(2);
        let list = b.build();
        assert_eq!(list, vec![1, 2]);
    }
}
