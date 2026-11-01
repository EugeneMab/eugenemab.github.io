// espanstanto-pronunciation-check.js
// Checker for the Espanstanto pronunciation engine, v2 (2026-11-01).
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
  // c / z distinct sounds, g / j, accents
  ['cena', '[ˈθe.na]'],
  ['cocina', '[koˈθi.na]'],
  ['zapato', '[zaˈpa.to]'],
  ['azul', '[aˈzul]'],
  ['gente', '[ˈxen.te]'],
  ['gato', '[ˈɡa.to]'],
  ['gitano', '[xiˈta.no]'],
  ['gorra', '[ˈɡo.ra]'],
  ['jamón', '[xaˈmon]'],
  ['lápiz', '[ˈla.piz]'],
  // ll / ñ / ch
  ['llave', '[ˈʒa.ve]'],
  ['pollo', '[ˈpo.ʒo]'],
  ['niño', '[ˈni.ɲo]'],
  ['mañana', '[maˈɲa.na]'],
  ['mucho', '[ˈmu.tʃo]'],
  ['noche', '[ˈno.tʃe]'],
  ['chico', '[ˈtʃi.ko]'],
  // qu / gu / gü
  ['queso', '[ˈke.so]'],
  ['quizás', '[kiˈzas]'],
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
  ['xilófono', '[ðiˈlo.fo.no]'],
  ['xenofobia', '[ðe.noˈfo.bja]'],
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
  ['huevo', '[ˈwe.vo]'],
  ['hielo', '[ˈje.lo]'],
  ['ciudad', '[θjuˈdad]'],
  ['cuidado', '[kwiˈda.do]'],
  ['día', '[ˈdi.a]'],
  ['país', '[paˈis]'],
  ['baúl', '[baˈul]'],
  ['río', '[ˈri.o]'],
  ['oír', '[oˈiɾ]'],
  ['prohibir', '[pɾojˈbiɾ]'],
  ['canción', '[kanˈθjon]'],
  ['avión', '[aˈvjon]'],
  ['papel', '[paˈpel]'],
  ['joven', '[ˈxo.ven]'],
  ['árbol', '[ˈaɾ.bol]'],
  ['vaca', '[ˈva.ka]'],
  ['bueno', '[ˈbwe.no]'],
  ['puerta', '[ˈpweɾ.ta]'],
  ['tierra', '[ˈtje.ra]'],
  ['váis', '[vajs]'],
  ['Israel', '[is.raˈel]'],
  ['alrededor', '[al.re.deˈdoɾ]'],
  // Espanstanto words
  ['haciendo', '[aˈθjen.do]'],
  ['hiciera', '[iˈθje.ɾa]'],
  ['está', '[esˈta]'],
  // Onset clusters (r is the tap [ɾ] in clusters; tl splits by default)
  ['prado', '[ˈpɾa.do]'],
  ['libro', '[ˈli.bɾo]'],
  ['actriz', '[akˈtɾiz]'],
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
  ['convoy', '[konˈvoj]'], // n stays literal: no nasal assimilation in v1
  ['carey', '[kaˈɾej]'],
  // 2026-11-01 JS audit: word-final y after a vowel is a coda glide
  ['muy', '[muj]'],
  ['cuy', '[kuj]'],
  // 2026-11-01 v2: distinct sounds for c/z/ll/v/initial-x
  ['cero', '[ˈθe.ɾo]'],
  ['zumo', '[ˈzu.mo]'],
  ['calle', '[ˈka.ʒe]'],
  ['llevar', '[ʒeˈvaɾ]'],
  ['cerveza', '[θeɾˈve.za]'],
  ['vida', '[ˈvi.da]'],
  ['xenón', '[ðeˈnon]'],
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
