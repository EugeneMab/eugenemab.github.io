// Book 6-1: Defining an Enum
enum IpAddrKind {
    V4,
    V6,
}

fn route(_ip_kind: IpAddrKind) {}

fn main() {
    let four = IpAddrKind::V4;
    let six = IpAddrKind::V6;
    route(IpAddrKind::V4);
    route(IpAddrKind::V6);
    0
}
