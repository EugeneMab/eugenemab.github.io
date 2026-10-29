// Franstant strict pronunciation — v1.
// Implements Ch. 6 of the Franstant spec (strict general rules, no exceptions).
// pronounceWord(word) -> IPA string (no syllable dots, no spaces).
// pronounce(phrase) -> each word pronounced separately, then concatenated.
// Works in Node and in the browser.
//
// Rules implemented:
// - 26 letters; h silent; final consonant pronounced only if c/r/f/l.
// - Terminal rules (take precedence): -ent -> [ɑ̃]; -ier -> [je] (polysyllabic), [jɛʁ] (monosyllabic)
//   / [jɛʁ] (monosyllabic); -er -> [e] (polysyllabic) / [ɛʁ] (monosyllabic);
//   -ez -> [e]; -es -> [ɛ] (monosyllabic) / [ə] (polysyllabic, silent after a vowel); final -e -> [ə] (silent after a vowel).
// - x: silent if final, else [ks]; [ɡz] discarded.
// - s: [z] between two vowels, else [s] (final s silent).
// - c: [s] before e/i/y (including accented é/è/ê/ë), else [k]; g: [ʒ] before e/i/y (including accented), else [ɡ].
// - Vowel quality: e -> [ɛ] in a closed syllable (letter-based: followed by a
//   consonant letter that is followed by a consonant or word-end, or by a
//   pronounced x, or by ill), else [ə]; eu -> [œ] in a non-final syllable or
//   a closed syllable, else [ø] (seulement [sœləmɑ̃], peur [pœʁ], peu [pø]);
//   o -> [ɔ] in a non-final syllable or before a pronounced consonant that
//   closes the syllable, else [o] (modal [mɔdal], phonétique [fɔnetikə],
//   porte [pɔʁtə], rose [ʁozə], mot [mo]).
// - xc before a soft c (e/i/y, accented included) is [ks] in total
//   (exception [ɛksɛpsjɔ̃], excellent [ɛksɛlɑ̃]); xc before a hard c keeps
//   both sounds (exclure [ɛksklyʁə]). Any adjacent [ss] in the output
//   merges to one [s] (degemination).
// - Nasals: vowel + m/n before a consonant or word-end (not doubled) ->
//   [ɑ̃]/[ɛ̃]/[ɔ̃]/[œ̃] (an/en, in/ain/ein, on, un, am/em), m/n silent.
// - Digraphs: eau [o], au [o], ou [u], oi [wa], ai [ɛ], ei [ɛ], ch [ʃ],
//   ph [f], gn [ɲ], qu [k], th [t], gu [ɡ] (or [ɡw] before a/o/u),
//   tion [sjɔ̃], ill [ij] after a consonant / [j] after a vowel,
//   ain/ein [ɛ̃], oin [wɛ̃]; eû is read as eu; où is read as ou; î is read as i.
// - y and i glide to [j] before a vowel.
// - y between two vowels splits into ii first (ayez -> aiiez, crayon -> craiion).
// - No elision, no liaison: words are pronounced independently.
//
// Resolved 2026-10-26 (page and engine now agree, 65/65 checks pass):
// - ai is always [ɛ] (faisait [fɛzɛ], faisant [fɛzɑ̃]).
// - y between two vowels splits into ii (ayez -> aiiez -> [ɛje];
//   crayon -> craiion -> [kʁɛjɔ̃]; ayons -> [ɛjɔ̃], ayant -> [ɛjɑ̃]).
// - Final -e/-es -> [ə] after a consonant, silent after a vowel (fasse [fasə], ville [vijə], vie [vi], année [ane]).
// - No mute-e drop: examen is [ɛksamɑ̃] by rule.
//
// Resolved 2026-10-29 (engine + checker, 65 + 9 checks pass):
// - o / eu are [ɔ] / [œ] in a non-final syllable, [o] / [ø] in a final
//   open syllable; a closed final syllable still gives [ɔ] / [œ]
//   (modal [mɔdal], phonétique [fɔnetikə], seulement [sœləmɑ̃];
//   rose [ʁozə], mot [mo], peu [pø] unchanged).
// - Final -e/-es after qu/gu is [ə], not silent: the u of qu/gu is part
//   of a consonant digraph, not a pronounced vowel
//   (langue [lɑ̃ɡə], que [kə], chaque [ʃakə], phonétique [fɔnetikə]).
// - xc before a soft c is [ks] in total, and any adjacent [ss] in the
//   output merges to one [s] (exception [ɛksɛpsjɔ̃], not [ɛkssɛpsjɔ̃]).
(function (root) {
  const VOWELS = new Set(['a', 'à', 'â', 'e', 'é', 'è', 'ê', 'i', 'î', 'o', 'ô',
    'u', 'û', 'ù', 'y', 'ë', 'ï', 'ü', 'æ', 'œ']);
  const NASAL = { a: 'ɑ̃', e: 'ɑ̃', i: 'ɛ̃', o: 'ɔ̃', u: 'œ̃' };
  const FINAL_SONORANT = new Set(['c', 'r', 'f', 'l']);

  function isVowel(ch) { return VOWELS.has(ch); }
  function isConsLetter(ch) {
    return (ch >= 'a' && ch <= 'z' && !isVowel(ch)) || ch === 'ç';
  }
  // Is the consonant letter at position j pronounced? (used for o-quality)
  // e.g. porte -> [pɔʁtə]: the r is pronounced, so it closes the o -> [ɔ]; mot -> [mo]: the t is silent, so o stays [o].
  function pronouncedCons(w, j) {
    const ch = w[j];
    if (ch === 'h') return false;
    if (j === w.length - 1 && !FINAL_SONORANT.has(ch)) return false;
    return true;
  }
  // Closed-syllable test for e / eu (letter-based, as the page's et/eut show).
  // j = index of the letter following the vowel/digraph. Closed if that
  // letter is a consonant followed by a consonant or word-end, or a
  // pronounced x, or the start of ill.
  // e.g. espoir -> [ɛspwaʁ]: e + s + p is closed -> [ɛ]; peser -> [pəze]: e + s + e is open -> [ə].
  function closedAfter(w, j) {
    const nx = w[j];
    if (!nx) return false;
    if (w.slice(j, j + 3) === 'ill') return true;
    if (nx === 'x' && j + 1 < w.length) return true; // pronounced [ks] closes
    if (!isConsLetter(nx)) return false;
    const after = w[j + 1];
    return !after || isConsLetter(after);
  }
  // Closed-syllable test for o (pronounced-consonant-based, as mot/porte show).
  // e.g. porte -> [pɔʁtə]: pronounced r closes o -> [ɔ]; rose -> [ʁozə]: s + vowel does not close o -> [o].
  function closedPronouncedAfter(w, j) {
    const nx = w[j];
    if (!nx) return false;
    if (nx === 'x' && j + 1 < w.length) return true; // pronounced [ks] closes
    if (!isConsLetter(nx) || !pronouncedCons(w, j)) return false;
    const after = w[j + 1];
    return !after || isConsLetter(after);
  }
  // Is the vowel ending at position j in the word-final syllable? A later
  // vowel letter counts only if it is not the word-final mute -e/-es.
  // e.g. modal -> [mɔdal]: after o, 'dal' has an a -> non-final -> [ɔ];
  // rose -> [ʁozə]: after o, 'se' minus final e is 's' -> final -> [o];
  // seulement -> [sœləmɑ̃]: after eu, 'lement' has vowels -> non-final -> [œ].
  function finalSyllable(w, j) {
    let tail = w.slice(j);
    if (tail.endsWith('es')) tail = tail.slice(0, -2);
    else if (tail.endsWith('e')) tail = tail.slice(0, -1);
    for (const ch of tail) if (isVowel(ch)) return false;
    return true;
  }
  // Is the letter before position i a real pronounced vowel? The u of qu/gu
  // is part of a consonant digraph, so a final -e after qu/gu counts as
  // after a consonant (langue -> [lɑ̃ɡə], que -> [kə], chaque -> [ʃakə]).
  function prevRealVowel(w, i) {
    if (i <= 0 || !isVowel(w[i - 1])) return false;
    if (w[i - 1] === 'u' && (w[i - 2] === 'q' || w[i - 2] === 'g')) return false;
    return true;
  }

  function pronounceWord(raw) {
    // e.g. eût -> eut (eû reads as eu), so eût fait -> [œfɛ]; où -> ou; î reads as i (apparaître -> [apaʁɛtʁə]).
    let w = raw.toLowerCase().replace(/eû/g, 'eu').replace(/où/g, 'ou').replace(/î/g, 'i');
    // Syllable count = number of vowel-letter groups (for -er/-es/-ier rules).
    // e.g. mer has 1 vowel group (mono); manger has 2 (poly). This decides -er/-es/-ier endings.
    let groups = 0, prevVowel = false;
    for (const ch of w) {
      const v = isVowel(ch);
      if (v && !prevVowel) groups++;
      prevVowel = v;
    }
    // y between two vowels splits into ii, then the other rules apply
    // (ayez -> aiiez -> [ɛje]; crayon -> craiion -> [kʁɛjɔ̃]).
    // Each split adds a syllable: payer has 1 vowel group + 1 split = 2 syllables,
    // so final -er -> [e] (payer -> [pɛje]).
    let split = '', splits = 0;
    for (let k = 0; k < w.length; k++) {
      const ch = w[k];
      if (ch === 'y' && k > 0 && k < w.length - 1 && isVowel(w[k - 1]) && isVowel(w[k + 1])) { split += 'ii'; splits++; }
      else split += ch;
    }
    w = split;
    const mono = (groups + splits) <= 1;
    let out = '', i = 0;
    const n = w.length;
    while (i < n) {
      const rest = w.slice(i);
      // --- terminal patterns (rest is exactly the word ending) ---
      // e.g. eussent -> [œsɑ̃]: after eu [œ] + ss [s], the remaining 'ent' -> [ɑ̃].
      if (rest === 'ent') { out += 'ɑ̃'; break; }
      // e.g. fier -> [fjɛʁ] (mono keeps r); premier -> [pʁəmje] (poly drops r).
      if (rest === 'ier') { out += mono ? 'jɛʁ' : 'je'; break; }
      // e.g. mer -> [mɛʁ] (mono keeps r); manger -> [mɑ̃ʒe] (poly drops r).
      if (rest === 'er') { out += mono ? 'ɛʁ' : 'e'; break; }
      // e.g. nez -> [ne]: final -ez is always [e].
      if (rest === 'ez') { out += 'e'; break; }
      // e.g. les -> [lɛ] (mono); parles -> [paʁlə] (poly); années -> [ane] (e silent after a vowel).
      // Final -e/-es after qu/gu is [ə]: the u there is a digraph letter, not a vowel (langue -> [lɑ̃ɡə]).
      if (rest === 'es') { out += !prevRealVowel(w, i) ? (mono ? 'ɛ' : 'ə') : ''; break; }
      // e.g. table -> [tablə]: final -e is [ə] after a consonant, silent after a vowel (vie -> [vi]).
      if (rest === 'e') { out += prevRealVowel(w, i) ? '' : 'ə'; break; }
      // Last letter standing alone: vowels keep their value, c/r/f/l sound, every other
      // final consonant is silent (CaReFuL). e.g. dix -> [di] (x silent), paix -> [pɛ] (x silent),
      // mer -> [mɛʁ] (final r sounds), mot -> [mo] (final t silent).
      if (rest.length === 1) {
        const ch = rest;
        if (ch === 'a' || ch === 'à') out += 'a';
        else if (ch === 'â') out += 'ɑ';
        else if (ch === 'e') out += 'ə';
        else if (ch === 'é') out += 'e';
        else if (ch === 'è' || ch === 'ê' || ch === 'ë') out += 'ɛ';
        else if (ch === 'i' || ch === 'î' || ch === 'ï') out += 'i';
        else if (ch === 'o' || ch === 'ô') out += 'o';
        else if (ch === 'u' || ch === 'û' || ch === 'ù' || ch === 'ü') out += 'y';
        else if (ch === 'y') out += 'i';
        else if (ch === 'æ') out += 'e';
        else if (ch === 'œ') out += 'œ';
        else if (ch === 'c') out += 'k';
        else if (ch === 'r') out += 'ʁ';
        else if (ch === 'f') out += 'f';
        else if (ch === 'l') out += 'l';
        // every other final consonant is silent (CaReFuL rule)
        break;
      }
      // --- 4-letter digraph ---
      // e.g. nation -> [nasjɔ̃]: tion is always [sjɔ̃].
      if (w.slice(i, i + 4) === 'tion') { out += 'sjɔ̃'; i += 4; continue; }
      // --- 3-letter digraphs ---
      const three = w.slice(i, i + 3);
      // e.g. beau -> [bo]: eau is [o].
      if (three === 'eau') { out += 'o'; i += 3; continue; }
      // e.g. fille -> [fijə] (ill after a consonant -> [ij]); feuille -> [fœjə] (ill after a vowel -> [j]).
      if (three === 'ill') {
        out += (i > 0 && isVowel(w[i - 1])) ? 'j' : 'ij';
        i += 3; continue;
      }
      // e.g. pain -> [pɛ̃]: ain/ein is [ɛ̃].
      if (three === 'ain' || three === 'ein') { out += 'ɛ̃'; i += 3; continue; }
      // e.g. loin -> [lwɛ̃]: oin is [wɛ̃].
      if (three === 'oin') { out += 'wɛ̃'; i += 3; continue; }
      // --- 2-letter digraphs ---
      const two = w.slice(i, i + 2);
      // e.g. voir -> [vwaʁ]: oi is [wa].
      if (two === 'oi') { out += 'wa'; i += 2; continue; }
      // e.g. pour -> [puʁ]: ou is [u].
      if (two === 'ou') { out += 'u'; i += 2; continue; }
      // e.g. faire -> [fɛʁə] (ai is [ɛ]); detailler -> [dətaje] (ai before ll stays a + ill [j]).
      if (two === 'ai' && !(w[i + 2] === 'l' && w[i + 3] === 'l')) { out += 'ɛ'; i += 2; continue; }
      // e.g. neige -> [nɛʒə] (ei is [ɛ]).
      if (two === 'ei') { out += 'ɛ'; i += 2; continue; }
      // e.g. auto -> [oto]: au is [o].
      if (two === 'au') { out += 'o'; i += 2; continue; }
      // e.g. peur -> [pœʁ] (closed -> [œ]); peu -> [pø] (final open -> [ø]);
      // seulement -> [sœləmɑ̃] (non-final -> [œ]).
      if (two === 'eu') { out += (closedAfter(w, i + 2) || !finalSyllable(w, i + 2)) ? 'œ' : 'ø'; i += 2; continue; }
      // e.g. cœur -> [kœʁ]: œu is [œ].
      if (two === 'œu') { out += 'œ'; i += 2; continue; }
      // e.g. chat -> [ʃa]: ch is [ʃ].
      if (two === 'ch') { out += 'ʃ'; i += 2; continue; }
      // e.g. photo -> [fɔto] (ph is [f]; o is non-final -> [ɔ]).
      if (two === 'ph') { out += 'f'; i += 2; continue; }
      // e.g. signe -> [siɲə]: gn is [ɲ].
      if (two === 'gn') { out += 'ɲ'; i += 2; continue; }
      // e.g. que -> [kə]: qu is [k].
      if (two === 'qu') { out += 'k'; i += 2; continue; }
      // e.g. thé -> [te]: th is [t].
      if (two === 'th') { out += 't'; i += 2; continue; }
      // e.g. guerre -> [ɡɛʁə] (gu before e -> [ɡ]); guano -> [ɡwano] (gu before a/o/u -> [ɡw]).
      if (two === 'gu') {
        const nx = w[i + 2];
        out += (nx === 'a' || nx === 'o' || nx === 'u') ? 'ɡw' : 'ɡ';
        i += 2; continue;
      }
      // e.g. exception -> [ɛksɛpsjɔ̃] (xc before a soft c is [ks] in total, not [ks] + [s]);
      // exclure -> [ɛksklyʁə] (xc before a hard c keeps both sounds).
      if (two === 'xc') {
        const nx = w[i + 2];
        if (nx === 'e' || nx === 'i' || nx === 'y' || nx === 'é' || nx === 'è' || nx === 'ê' || nx === 'ë') { out += 'ks'; i += 2; continue; }
      }
      // e.g. poisson -> [pwasɔ̃]: ss is always [s].
      if (two === 'ss') { out += 's'; i += 2; continue; }
      // e.g. terre -> [tɛʁə]: a doubled consonant is one sound; accepter -> [aksɛpte] and accès -> [aksɛ] (cc before e/i/y, accented included, -> [ks]).
      const dbl = two[0] === two[1] && isConsLetter(two[0]) && two !== 'ss';
      if (dbl) { // doubled consonant = single sound (mm, nn, ll, pp, rr, tt, ...)
        if (two[0] === 'c') out += (w[i + 2] === 'e' || w[i + 2] === 'i' || w[i + 2] === 'y' || w[i + 2] === 'é' || w[i + 2] === 'è' || w[i + 2] === 'ê' || w[i + 2] === 'ë') ? 'ks' : 'k';
        else out += singleCons(two[0], w, i);
        i += 2; continue;
      }
      // --- single letters ---
      const ch = w[i];
      // Single vowels. e.g. avoir -> [avwaʁ] (a is [a]); hier -> [jɛʁ] (i glides to [j] before a vowel,
      // e in a closed syllable is [ɛ], final r sounds).
      if (ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u') {
        // nasal: vowel + m/n before a consonant or word-end (not doubled)
        const nx = w[i + 1];
        // e.g. dans -> [dɑ̃]: vowel + m/n before a consonant nasalizes, the m/n goes silent.
        if ((nx === 'm' || nx === 'n') && w[i + 2] !== nx) {
          const after = w[i + 2];
          if (!after || isConsLetter(after)) {
            out += NASAL[ch]; i += 2; continue;
          }
        }
        if (ch === 'a') out += 'a';
        else if (ch === 'e') out += closedAfter(w, i + 1) ? 'ɛ' : 'ə';
        else if (ch === 'i') out += (w[i + 1] && isVowel(w[i + 1]) && !(w[i - 1] === 'l' && w[i - 2] === 'l') && !(w[i + 1] === 'e' && (i + 2 === n || (w[i + 2] === 's' && i + 3 === n)))) ? 'j' : 'i'; // i glides before a vowel, except after ll (million -> [mijiɔ̃]) and before a silent final e/es (vie -> [vi]).
        else if (ch === 'o') out += (closedPronouncedAfter(w, i + 1) || !finalSyllable(w, i + 1)) ? 'ɔ' : 'o'; // o is [ɔ] in a non-final syllable or a closed syllable (modal -> [mɔdal], porte -> [pɔʁtə]), else [o] (rose -> [ʁozə], mot -> [mo]).
        else if (ch === 'u') out += 'y';
        i += 1; continue;
      }
      // Accented vowels keep their plain value. e.g. été -> [ete] (é is [e]); mère -> [mɛʁə] (è is [ɛ]); â -> [ɑ].
      if (ch === 'à') { out += 'a'; i++; continue; }
      if (ch === 'â') { out += 'ɑ'; i++; continue; }
      if (ch === 'é') { out += 'e'; i++; continue; }
      if (ch === 'è' || ch === 'ê' || ch === 'ë') { out += 'ɛ'; i++; continue; }
      if (ch === 'î' || ch === 'ï') { out += 'i'; i++; continue; }
      if (ch === 'ô') { out += 'o'; i++; continue; }
      if (ch === 'û' || ch === 'ù' || ch === 'ü') { out += 'y'; i++; continue; }
      if (ch === 'æ') { out += 'e'; i++; continue; }
      if (ch === 'œ') { out += 'œ'; i++; continue; }
      // e.g. yeux -> [jœ] (y before a vowel -> [j]); type -> [tipə] (y elsewhere -> [i]).
      if (ch === 'y') {
        out += (w[i + 1] && isVowel(w[i + 1])) ? 'j' : 'i';
        i++; continue;
      }
      // e.g. homme -> [ɔmə]: h is always silent.
      if (ch === 'h') { i++; continue; } // silent
      // e.g. ça -> [sa] (ç is always [s]).
      if (ch === 'ç') { out += 's'; i++; continue; }
      // e.g. ce -> [sə] (c before e/i/y -> [s], accented é/è/ê/ë included, e.g. cédille -> [sedijə]); car -> [kaʁ] (c elsewhere -> [k]).
      if (ch === 'c') {
        const nx = w[i + 1];
        out += (nx === 'e' || nx === 'i' || nx === 'y' || nx === 'é' || nx === 'è' || nx === 'ê' || nx === 'ë') ? 's' : 'k';
        i++; continue;
      }
      // e.g. gel -> [ʒɛl] (g before e/i/y -> [ʒ], accented included); grand -> [ɡʁɑ̃] (g elsewhere -> [ɡ]).
      if (ch === 'g') {
        const nx = w[i + 1];
        out += (nx === 'e' || nx === 'i' || nx === 'y' || nx === 'é' || nx === 'è' || nx === 'ê' || nx === 'ë') ? 'ʒ' : 'ɡ';
        i++; continue;
      }
      // e.g. rose -> [ʁozə] (s between two vowels -> [z]); sur -> [syʁ] (s elsewhere -> [s]).
      if (ch === 's') {
        const pv = i > 0 && isVowel(w[i - 1]);
        const nx = w[i + 1];
        out += (pv && nx && isVowel(nx)) ? 'z' : 's';
        i++; continue;
      }
      // e.g. taxi -> [taksi]: non-final x is [ks] (final x was already silenced above).
      if (ch === 'x') { out += 'ks'; i++; continue; } // non-final here (final x caught above)
      // e.g. Qatar -> [kataʁ]: q is [k] (qu was already handled above).
      if (ch === 'q') { out += 'k'; i++; continue; }
      out += singleCons(ch, w, i);
      i++;
    }
    // Degemination: any adjacent [ss] in the output merges to one [s]
    // (e.g. an x [ks] followed by an s-sound must not surface as [ss]).
    return out.replace(/ss+/g, 's');

    // Plain consonant values, used for doubled consonants and the fallback. e.g. rouge -> [ʁuʒə].
    function singleCons(ch, w, i) {
      switch (ch) {
        case 'b': return 'b';
        case 'd': return 'd';
        case 'f': return 'f';
        case 'j': return 'ʒ';
        case 'k': return 'k';
        case 'l': return 'l';
        case 'm': return 'm';
        case 'n': return 'n';
        case 'p': return 'p';
        case 'r': return 'ʁ';
        case 't': return 't';
        case 'v': return 'v';
        case 'w': return 'w';
        case 'z': return 'z';
        default: return '';
      }
    }
  }

  function pronounce(phrase) {
    return phrase.trim().split(/\s+/).map(pronounceWord).join('');
  }

  root.franstantPronounce = { pronounceWord, pronounce };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.franstantPronounce;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
