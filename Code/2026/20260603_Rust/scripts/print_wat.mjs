import fs from 'fs';
import { Lexer } from '../pub/js/lexer.js';
import { Parser } from '../pub/js/parser.js';
import { Emitter } from '../pub/js/emitter.js';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/print_wat.mjs <sample.rs>');
  process.exit(2);
}
const code = fs.readFileSync(path, 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens, code);
const ast = parser.parse();
const emitter = new Emitter(ast, code);
const wat = emitter.emitWAT();
console.log(wat);
