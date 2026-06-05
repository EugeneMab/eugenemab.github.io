import { Runtime } from './runtime.js';

const code = `
// This is a comment
/// Doc comment
fn main() {
    let x = 10;
    let y = 20;
    let z = (x + y) * 2; // 60
    let bit = (1 << 5) | 1; // 33
    print!(z);
    print!(bit);
}
`;

const runtime = new Runtime();
runtime.run(code).catch(console.error);
