// Verification: every Franstant IPA annotation in index.html (Ch. 5 modal
// table, Ch. 6 deterministic rules + worked examples, Ch. 7 summary row,
// Ch. 5 notes' Franstant values) checked against franstant-pronunciation.js.
// Standard-French annotations (the "becomes" left-hand sides, the Ch. 7
// standard column, the notes' standard values) are NOT Franstant claims and
// are excluded. Expected values are normalized: syllable dots and spaces
// removed (the page writes [lə.ɔm] and [ɑ̃.ajɑ̃.fɛ] with dots in places).
// Run: node franstant-pronunciation-check.js
const { pronounce } = require('./franstant-pronunciation.js');
const norm = (s) => s.replace(/[. ]/g, '');
const CASES = [
  // Ch. 5 modal forms
  ['font', 'fɔ̃'], ['faisait', 'fɛzɛ'], ['a fait', 'afɛ'],
  ['avait fait', 'avɛfɛ'], ['eut fait', 'œfɛ'], ['fera', 'fəʁa'],
  ['aura fait', 'oʁafɛ'], ['ferait', 'fəʁɛ'], ['aurait fait', 'oʁɛfɛ'],
  ['fasse', 'fasə'], ['ayons fait', 'ɛjɔ̃fɛ'], ['fisse', 'fisə'],
  ['eussent fait', 'œsɑ̃fɛ'], ['faites', 'fɛtə'], ['ayez fait', 'ɛjefɛ'],
  ['faire', 'fɛʁə'], ['avoir fait', 'avwaʁfɛ'], ['faisant', 'fɛzɑ̃'],
  ['fait', 'fɛ'], ['en faisant', 'ɑ̃fɛzɑ̃'], ['en ayant fait', 'ɑ̃ɛjɑ̃fɛ'],
  ['est fait', 'ɛsfɛ'], ['se', 'sə'],
  // Ch. 5 notes (Franstant values only)
  ['eût fait', 'œfɛ'],
  // Ch. 6 deterministic rules
  ['dix', 'di'], ['paix', 'pɛ'], ['taxi', 'taksi'], ['examen', 'ɛksamɑ̃'],
  ['mer', 'mɛʁ'], ['fer', 'fɛʁ'], ['manger', 'mɑ̃ʒe'], ['parler', 'paʁle'],
  ['merci', 'mɛʁsi'], ['fermer', 'fɛʁme'], ['les', 'lɛ'], ['des', 'dɛ'],
  ['parles', 'paʁlə'], ['tables', 'tablə'], ['espoir', 'ɛspwaʁ'],
  ['peser', 'pəze'], ['premier', 'pʁəmje'], ['papier', 'papje'],
  ['fier', 'fjɛʁ'], ['hier', 'jɛʁ'], ['rose', 'ʁozə'], ['sur', 'syʁ'],
  ['table', 'tablə'], ['parle', 'paʁlə'], ['nez', 'ne'], ['mangez', 'mɑ̃ʒe'],
  ['vent', 'vɑ̃'], ['eussent', 'œsɑ̃'], ['cinq', 'sɛ̃'],
  // Ch. 6 worked examples (Franstant targets)
  ['et', 'ɛ'], ['ville', 'vijə'], ['mille', 'mijə'], ['femme', 'fɛmə'],
  ['oignon', 'waɲɔ̃'], ['second', 'səkɔ̃'], ['six', 'si'],
  // y-split rule line (new examples)
  ['ayez', 'ɛje'], ['crayon', 'kʁɛjɔ̃'],
  // Differences paragraph (Franstant)
  ['le homme', 'ləɔmə'], ['de eau', 'dəo'], ['homme', 'ɔmə'],
  // 2026-10-29 user cases: final -e after qu/gu, o/eu final-syllable rule, xc degemination
  ['langue', 'lɑ̃ɡə'], ['que', 'kə'], ['chaque', 'ʃakə'],
  ['phonétique', 'fɔnetikə'], ['modal', 'mɔdal'], ['seulement', 'sœləmɑ̃'],
  ['exception', 'ɛksɛpsjɔ̃'], ['excellent', 'ɛksɛlɑ̃'],
  // ss merges to one [s] (regression lock; already passed before the fix)
  ['poisson', 'pwasɔ̃'],
  // 2026-10-30 user cases: ai/ei before ill or a final il breaks the pair
  ['soleil', 'sɔlɛj'], ['Marseille', 'maʁsɛjə'], ['travail', 'tʁavaj'],
  ['sommeil', 'sɔmɛj'], ['meilleur', 'mɛjœʁ'], ['pareil', 'paʁɛj'],
  ['soleils', 'sɔlɛj'], ['vieille', 'vjɛjə'], ['vermeil', 'vɛʁmɛj'],
  ['ail', 'aj'],
  // ill regression locks (must not change under the new rule)
  ['fille', 'fijə'], ['bataille', 'batajə'], ['detailler', 'dətaje'],
];
let pass = 0, fail = 0;
for (const [word, expected] of CASES) {
  const got = pronounce(word);
  if (norm(got) === norm(expected)) { pass++; }
  else {
    fail++;
    console.log(`FAIL  ${word}  page=[${expected}]  engine=[${got}]`);
  }
}
console.log(`\n${pass} pass, ${fail} fail, ${CASES.length} total`);
