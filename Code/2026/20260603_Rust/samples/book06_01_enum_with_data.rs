// Book 6-1: Enum with data attached to variants
enum IpAddr {
    V4(&'static str),
    V6(&'static str),
}

fn main() {
    let home = IpAddr::V4("127.0.0.1");
    let loopback = IpAddr::V6("::1");
    0
}
