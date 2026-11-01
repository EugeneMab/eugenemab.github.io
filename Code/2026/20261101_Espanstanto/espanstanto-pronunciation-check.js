// espanstanto-pronunciation-check.js
// Checker for the Espanstanto pronunciation engine, v1 (2026-11-01).
// Run: node espanstanto-pronunciation-check.js
const { ipa } = require('./espanstanto-pronunciation.js');

const cases = [
  // Simple vowels, silent h, monosyllables
  ['casa', '[ˈka.sa]'],
  ['mesa', '[ˈme.sa]'],
  ['piso', '[ˈpi.so]'],
  ['solo', '[ˈso.lo]'],
  ['luna', '[ˈlu.na]'],
  ['hola', '[ˈo.la]'],
  ['ahora', '[aˈo.ɾa]'],
  ['sol', '[sol]'],
  ['pan', '[pan]'],
  ['y', '[i]'],
  // c / z seseo, g / j, accents
  ['cena', '[ˈse.na]'],
  ['cocina', '[koˈsi.na]'],
  ['zapato', '[saˈpa.to]'],
  ['azul', '[aˈsul]'],
  ['gente', '[ˈxen.te]'],
  ['gato', '[ˈɡa.to]'],
  ['gitano', '[xiˈta.no]'],
  ['gorra', '[ˈɡo.ra]'],
  ['jamón', '[xaˈmon]'],
  ['lápiz', '[ˈla.pis]'],
  // ll / ñ / ch
  ['llave', '[ˈʝa.be]'],
  ['pollo', '[ˈpo.ʝo]'],
  ['niño', '[ˈni.ɲo]'],
  ['mañana', '[maˈɲa.na]'],
  ['mucho', '[ˈmu.tʃo]'],
  ['noche', '[ˈno.tʃe]'],
  ['chico', '[ˈtʃi.ko]'],
  // qu / gu / gü
  ['queso', '[ˈke.so]'],
  ['quizás', '[kiˈsas]'],
  ['guerra', '[ˈɡe.ra]'],
  ['pingüino', '[pinˈɡwi.no]'],
  ['agüero', '[aˈɡwe.ɾo]'],
  // r / rr
  ['perro', '[ˈpe.ro]'],
  ['pero', '[ˈpe.ɾo]'],
  ['rosa', '[ˈro.sa]'],
  ['honra', '[ˈon.ra]'],
  ['carro', '[ˈka.ro]'],
  ['comer', '[koˈmeɾ]'],
  // x
  ['examen', '[ekˈsa.men]'],
  ['taxi', '[ˈtak.si]'],
  ['xilófono', '[siˈlo.fo.no]'],
  ['xenofobia', '[se.noˈfo.bja]'],
  // y
  ['hoy', '[oj]'],
  ['ley', '[lej]'],
  ['soy', '[soj]'],
  ['yo', '[ʝo]'],
  ['ya', '[ʝa]'],
  ['ayuda', '[aˈʝu.da]'],
  ['buey', '[bwej]'],
  // Diphthongs, triphthongs, hiatus, stress
  ['aire', '[ˈaj.ɾe]'],
  ['causa', '[ˈkaw.sa]'],
  ['huevo', '[ˈwe.bo]'],
  ['hielo', '[ˈje.lo]'],
  ['ciudad', '[sjuˈdad]'],
  ['cuidado', '[kwiˈda.do]'],
  ['día', '[ˈdi.a]'],
  ['país', '[paˈis]'],
  ['baúl', '[baˈul]'],
  ['río', '[ˈri.o]'],
  ['oír', '[oˈiɾ]'],
  ['prohibir', '[pɾojˈbiɾ]'],
  ['canción', '[kanˈsjon]'],
  ['avión', '[aˈbjon]'],
  ['papel', '[paˈpel]'],
  ['joven', '[ˈxo.ben]'],
  ['árbol', '[ˈaɾ.bol]'],
  ['vaca', '[ˈba.ka]'],
  ['bueno', '[ˈbwe.no]'],
  ['puerta', '[ˈpweɾ.ta]'],
  ['tierra', '[ˈtje.ra]'],
  ['váis', '[bajs]'],
  ['Israel', '[is.raˈel]'],
  ['alrededor', '[al.re.deˈdoɾ]'],
  // Espanstanto words
  ['haciendo', '[aˈsjen.do]'],
  ['hiciera', '[iˈsje.ɾa]'],
  ['está', '[esˈta]'],
  // Onset clusters (r is the tap [ɾ] in clusters; tl splits by default)
  ['prado', '[ˈpɾa.do]'],
  ['libro', '[ˈli.bɾo]'],
  ['actriz', '[akˈtɾis]'],
  ['subrayar', '[su.bɾaˈʝaɾ]'],
  ['plato', '[ˈpla.to]'],
  ['grande', '[ˈɡɾan.de]'],
  ['flor', '[floɾ]'],
  ['clase', '[ˈkla.se]'],
  ['atlas', '[ˈat.las]'],
  ['atleta', '[atˈle.ta]'],
  // 2026-11-01 JS audit: word-final y counts as a consonant for stress
  ['Paraguay', '[pa.ɾaˈɡwaj]'],
  ['Uruguay', '[u.ɾuˈɡwaj]'],
  ['mamey', '[maˈmej]'],
  ['convoy', '[konˈboj]'], // n stays literal: no nasal assimilation in v1
  ['carey', '[kaˈɾej]'],
  // 2026-11-01 JS audit reverted: weak+weak glides first (muy [mwi], cuy [kwi])
  ['muy', '[mwi]'],
  ['cuy', '[kwi]'],
];

let pass = 0;
let fail = 0;
for (const [word, expected] of cases) {
  const got = ipa(word);
  if (got === expected) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL ${word}: got ${got}, want ${expected}`);
  }
}
console.log(`${pass}/${pass + fail} pass`);
process.exit(fail ? 1 : 0);
