// Franstant strict pronunciation — v1.
// Implements Ch. 6 of the Franstant spec (strict general rules, no exceptions).
// pronounceWord(word) -> IPA string (no syllable dots, no spaces).
// pronounce(phrase) -> each word pronounced separately, then concatenated.
// Works in Node and in the browser.
//
// Rules implemented:
// - 26 letters; h silent; final consonant pronounced only if c/r/f/l.
// - Terminal rules (take precedence): -ent -> [ɑ̃]; -ier -> [je] (polysyllabic)
//   / [jɛ] (monosyllabic); -er -> [e] (polysyllabic) / [ɛʁ] (monosyllabic);
//   -ez -> [e]; -es -> [ɛ] (monosyllabic) / [ə] (polysyllabic); final -e -> [ə].
// - x: silent if final, else [ks]; [ɡz] discarded.
// - s: [z] between two vowels, else [s] (final s silent).
// - c: [s] before e/i/y, else [k]; g: [ʒ] before e/i/y, else [ɡ].
// - Vowel quality: e -> [ɛ] in a closed syllable (letter-based: followed by a
//   consonant letter that is followed by a consonant or word-end, or by a
//   pronounced x, or by ill), else [ə]; eu -> [œ]/[ø] by the same test;
//   o -> [ɔ] only before a pronounced consonant that closes the syllable,
//   else [o] (mot [mo], porte [pɔʁ], rose [ʁoz]).
// - Nasals: vowel + m/n before a consonant or word-end (not doubled) ->
//   [ɑ̃]/[ɛ̃]/[ɔ̃]/[œ̃] (an/en, in/ain/ein, on, un, am/em), m/n silent.
// - Digraphs: eau [o], au [o], ou [u], oi [wa], ai [ɛ], ei [ɛ], ch [ʃ],
//   ph [f], gn [ɲ], qu [k], th [t], gu [ɡ] (or [ɡw] before a/o/u),
//   tion [sjɔ̃], ill [ij] after a consonant / [j] after a vowel,
//   ain/ein [ɛ̃], oin [wɛ̃]; eû is read as eu; où is read as ou.
// - y and i glide to [j] before a vowel.
// - y between two vowels splits into ii first (ayez -> aiiez, crayon -> craiion).
// - No elision, no liaison: words are pronounced independently.
//
// Resolved 2026-10-26 (page and engine now agree, 65/65 checks pass):
// - ai is always [ɛ] (faisait [fɛzɛ], faisant [fɛzɑ̃]).
// - y between two vowels splits into ii (ayez -> aiiez -> [ɛje];
//   crayon -> craiion -> [kʁɛjɔ̃]; ayons -> [ɛjɔ̃], ayant -> [ɛjɑ̃]).
// - Final -e/-es -> [ə] is kept uniformly (fasse [fasə], ville [vijə], ...).
// - No mute-e drop: examen is [ɛksamɑ̃] by rule.
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
  function closedPronouncedAfter(w, j) {
    const nx = w[j];
    if (!nx) return false;
    if (nx === 'x' && j + 1 < w.length) return true; // pronounced [ks] closes
    if (!isConsLetter(nx) || !pronouncedCons(w, j)) return false;
    const after = w[j + 1];
    return !after || isConsLetter(after);
  }

  function pronounceWord(raw) {
    let w = raw.toLowerCase().replace(/eû/g, 'eu').replace(/où/g, 'ou');
    // Syllable count = number of vowel-letter groups (for -er/-es/-ier rules).
    let groups = 0, prevVowel = false;
    for (const ch of w) {
      const v = isVowel(ch);
      if (v && !prevVowel) groups++;
      prevVowel = v;
    }
    const mono = groups <= 1;
    // y between two vowels splits into ii, then the other rules apply
    // (ayez -> aiiez -> [ɛje]; crayon -> craiion -> [kʁɛjɔ̃]).
    // The syllable count above stays on the original spelling (payer is 2 syllables).
    let split = '';
    for (let k = 0; k < w.length; k++) {
      const ch = w[k];
      if (ch === 'y' && k > 0 && k < w.length - 1 && isVowel(w[k - 1]) && isVowel(w[k + 1])) split += 'ii';
      else split += ch;
    }
    w = split;
    let out = '', i = 0;
    const n = w.length;
    while (i < n) {
      const rest = w.slice(i);
      // --- terminal patterns (rest is exactly the word ending) ---
      if (rest === 'ent') { out += 'ɑ̃'; break; }
      if (rest === 'ier') { out += mono ? 'jɛ' : 'je'; break; }
      if (rest === 'er') { out += mono ? 'ɛʁ' : 'e'; break; }
      if (rest === 'ez') { out += 'e'; break; }
      if (rest === 'es') { out += mono ? 'ɛ' : 'ə'; break; }
      if (rest === 'e') { out += 'ə'; break; }
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
      if (w.slice(i, i + 4) === 'tion') { out += 'sjɔ̃'; i += 4; continue; }
      // --- 3-letter digraphs ---
      const three = w.slice(i, i + 3);
      if (three === 'eau') { out += 'o'; i += 3; continue; }
      if (three === 'ill') {
        out += (i > 0 && isVowel(w[i - 1])) ? 'j' : 'ij';
        i += 3; continue;
      }
      if (three === 'ain' || three === 'ein') { out += 'ɛ̃'; i += 3; continue; }
      if (three === 'oin') { out += 'wɛ̃'; i += 3; continue; }
      // --- 2-letter digraphs ---
      const two = w.slice(i, i + 2);
      if (two === 'oi') { out += 'wa'; i += 2; continue; }
      if (two === 'ou') { out += 'u'; i += 2; continue; }
      if (two === 'ai' || two === 'ei') { out += 'ɛ'; i += 2; continue; }
      if (two === 'au') { out += 'o'; i += 2; continue; }
      if (two === 'eu') { out += closedAfter(w, i + 2) ? 'œ' : 'ø'; i += 2; continue; }
      if (two === 'œu') { out += 'œ'; i += 2; continue; }
      if (two === 'ch') { out += 'ʃ'; i += 2; continue; }
      if (two === 'ph') { out += 'f'; i += 2; continue; }
      if (two === 'gn') { out += 'ɲ'; i += 2; continue; }
      if (two === 'qu') { out += 'k'; i += 2; continue; }
      if (two === 'th') { out += 't'; i += 2; continue; }
      if (two === 'gu') {
        const nx = w[i + 2];
        out += (nx === 'a' || nx === 'o' || nx === 'u') ? 'ɡw' : 'ɡ';
        i += 2; continue;
      }
      if (two === 'ss') { out += 's'; i += 2; continue; }
      const dbl = two[0] === two[1] && isConsLetter(two[0]) && two !== 'ss';
      if (dbl) { // doubled consonant = single sound (mm, nn, ll, pp, rr, tt, ...)
        if (two[0] === 'c') out += (w[i + 2] === 'e' || w[i + 2] === 'i' || w[i + 2] === 'y') ? 'ks' : 'k';
        else out += singleCons(two[0], w, i);
        i += 2; continue;
      }
      // --- single letters ---
      const ch = w[i];
      if (ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u') {
        // nasal: vowel + m/n before a consonant or word-end (not doubled)
        const nx = w[i + 1];
        if ((nx === 'm' || nx === 'n') && w[i + 2] !== nx) {
          const after = w[i + 2];
          if (!after || isConsLetter(after)) {
            out += NASAL[ch]; i += 2; continue;
          }
        }
        if (ch === 'a') out += 'a';
        else if (ch === 'e') out += closedAfter(w, i + 1) ? 'ɛ' : 'ə';
        else if (ch === 'i') out += (w[i + 1] && isVowel(w[i + 1])) ? 'j' : 'i';
        else if (ch === 'o') out += closedPronouncedAfter(w, i + 1) ? 'ɔ' : 'o';
        else if (ch === 'u') out += 'y';
        i += 1; continue;
      }
      if (ch === 'à') { out += 'a'; i++; continue; }
      if (ch === 'â') { out += 'ɑ'; i++; continue; }
      if (ch === 'é') { out += 'e'; i++; continue; }
      if (ch === 'è' || ch === 'ê' || ch === 'ë') { out += 'ɛ'; i++; continue; }
      if (ch === 'î' || ch === 'ï') { out += 'i'; i++; continue; }
      if (ch === 'ô') { out += 'o'; i++; continue; }
      if (ch === 'û' || ch === 'ù' || ch === 'ü') { out += 'y'; i++; continue; }
      if (ch === 'æ') { out += 'e'; i++; continue; }
      if (ch === 'œ') { out += 'œ'; i++; continue; }
      if (ch === 'y') {
        out += (w[i + 1] && isVowel(w[i + 1])) ? 'j' : 'i';
        i++; continue;
      }
      if (ch === 'h') { i++; continue; } // silent
      if (ch === 'c' || ch === 'ç') {
        const nx = w[i + 1];
        out += (nx === 'e' || nx === 'i' || nx === 'y') ? 's' : 'k';
        i++; continue;
      }
      if (ch === 'g') {
        const nx = w[i + 1];
        out += (nx === 'e' || nx === 'i' || nx === 'y') ? 'ʒ' : 'ɡ';
        i++; continue;
      }
      if (ch === 's') {
        const pv = i > 0 && isVowel(w[i - 1]);
        const nx = w[i + 1];
        out += (pv && nx && isVowel(nx)) ? 'z' : 's';
        i++; continue;
      }
      if (ch === 'x') { out += 'ks'; i++; continue; } // non-final here (final x caught above)
      if (ch === 'q') { out += 'k'; i++; continue; }
      out += singleCons(ch, w, i);
      i++;
    }
    return out;

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
