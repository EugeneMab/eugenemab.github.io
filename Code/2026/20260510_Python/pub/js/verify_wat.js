import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
import * as fs from "fs";
import * as path from "path";
async function verify() {
    const compiler = new Compiler();
    const samples = ["branching.py", "infinite.py"];
    const sampleDir = path.join(process.cwd(), "pub", "sample");
    for (const sampleFile of samples) {
        console.log(`\n--- WAT for ${sampleFile} ---`);
        const code = fs.readFileSync(path.join(sampleDir, sampleFile), "utf-8");
        const tokens = new Lexer(code).tokenize();
        const ast = new Parser(tokens).parse();
        const wat = compiler.compileWAT(ast);
        console.log(wat);
    }
}
verify();
