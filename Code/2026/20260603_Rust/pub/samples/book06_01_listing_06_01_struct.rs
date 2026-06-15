// Book 6-1: Listing 6-1 - Struct storing kind and address
enum IpAddrKind {
    V4,
    V6,
}

struct IpAddr {
    kind: IpAddrKind,
    address: &'static str,
}

fn main() {
    let home = IpAddr { kind: IpAddrKind::V4, address: "127.0.0.1" };
    let loopback = IpAddr { kind: IpAddrKind::V6, address: "::1" };
    0
}
