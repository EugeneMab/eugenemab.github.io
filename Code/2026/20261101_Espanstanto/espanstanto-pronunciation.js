// espanstanto-pronunciation.js
// Espanstanto pronunciation engine, v1 draft (2026-11-01).
// Converts one Espanstanto word to IPA. Strict deterministic rules, no exceptions.
// Stress is marked with ˈ, syllables joined with dots; monosyllables unmarked.
// v1 defaults (confirmed by the user 2026-11-01):
//  - seseo: c before e/i and z -> [s] (not Spain [θ])
//  - yeísmo: ll -> [ʝ] (not traditional [ʎ])
//  - no intervocalic lenition: b/v -> [b], d -> [d], g -> [ɡ] (not [β]/[ð]/[ɣ])
//  - x -> [ks], except word-initial x -> [s]
//  - no nasal assimilation (literal n/m, not [m]/[ŋ] before b/p/g/k)
//  - glides stay [j]/[w] (no word-initial strengthening to [ʝ]/[ɣw])
//  - tl is not an onset cluster (splits, unlike Mexican Spanish)
// Usage: const { ipa } = require('./espanstanto-pronunciation.js');
//        ipa('hola') -> '[ˈo.la]'
// Browser: <script src="espanstanto-pronunciation.js"></script> exposes
//        window.espanstantoPronounce = { ipa, pronounceWord }.

const ACCENT_MAP = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
const STRONG = new Set(['a', 'e', 'o']);
const VALID_ONSET = new Set(['pl', 'pɾ', 'bl', 'bɾ', 'tɾ', 'dɾ', 'kl', 'kɾ', 'ɡl', 'ɡɾ', 'fl', 'fɾ']);

function isVowelLetter(ch) {
  return 'aeiouáéíóúü'.includes(ch);
}

// Group one run of consecutive vowel units into nuclei.
// Each nucleus: { pre, vow, post } where pre/post are glide units or null.
function groupRun(units) {
  const nuclei = [];
  let i = 0;
  while (i < units.length) {
    const u = units[i];
    // Accented weak vowel (í/ú) is always its own nucleus: breaks diphthongs.
    if (u.accented && !u.strong) {
      nuclei.push({ pre: null, vow: u, post: null });
      i += 1;
      continue;
    }
    if (u.strong) {
      const n = units[i + 1];
      if (n && !n.strong && !n.accented) {
        nuclei.push({ pre: null, vow: u, post: n });
        i += 2;
      } else {
        nuclei.push({ pre: null, vow: u, post: null });
        i += 1;
      }
      continue;
    }
    // Unstressed weak vowel.
    const n = units[i + 1];
    if (!n) {
      nuclei.push({ pre: null, vow: u, post: null });
      i += 1;
      continue;
    }
    if (n.strong) {
      const m = units[i + 2];
      if (m && !m.strong && !m.accented) {
        // Triphthong: weak + strong + weak.
        nuclei.push({ pre: u, vow: n, post: m });
        i += 3;
      } else {
        nuclei.push({ pre: u, vow: n, post: null });
        i += 2;
      }
      continue;
    }
    if (n.accented) {
      // Weak + accented weak: hiatus, weak stands alone.
      nuclei.push({ pre: null, vow: u, post: null });
      i += 1;
      continue;
    }
    // Weak + weak: first glides, second is the vowel.
    nuclei.push({ pre: u, vow: n, post: null });
    i += 2;
  }
  return nuclei;
}

function consonantPh(ch, w, i) {
  const next = w[i + 1] || '';
  switch (ch) {
    case 'b': case 'v': return 'b';
    case 'c': return 'eéií'.includes(next) ? 's' : 'k';
    case 'd': return 'd';
    case 'f': return 'f';
    case 'g': return 'eéií'.includes(next) ? 'x' : 'ɡ';
    case 'j': return 'x';
    case 'k': return 'k';
    case 'l': return 'l';
    case 'm': return 'm';
    case 'n': return 'n';
    case 'ñ': return 'ɲ';
    case 'p': return 'p';
    case 'q': return 'k';
    case 'r': {
      if (i === 0) return 'r';
      const prev = w[i - 1];
      if (prev === 'n' || prev === 'l' || prev === 's') return 'r';
      return 'ɾ';
    }
    case 's': return 's';
    case 't': return 't';
    case 'w': return 'w';
    case 'z': return 's';
    default: return ch;
  }
}

function ipa(word) {
  const w = word.toLowerCase().trim();
  // Pass 1: scan into items. Vowel runs continue across silent h.
  const items = [];
  let run = [];
  const flushRun = () => { if (run.length) { items.push({ run }); run = []; } };
  let i = 0;
  while (i < w.length) {
    const ch = w[i];
    const two = w.slice(i, i + 2);
    if (two === 'ch') { flushRun(); items.push({ cons: 'tʃ' }); i += 2; continue; }
    if (two === 'll') { flushRun(); items.push({ cons: 'ʝ' }); i += 2; continue; }
    if (two === 'rr') { flushRun(); items.push({ cons: 'r' }); i += 2; continue; }
    if (ch === 'q' && w[i + 1] === 'u' && 'eéií'.includes(w[i + 2] || '')) {
      flushRun(); items.push({ cons: 'k' }); i += 2; continue;
    }
    if (ch === 'g' && w[i + 1] === 'u' && 'eéií'.includes(w[i + 2] || '')) {
      flushRun(); items.push({ cons: 'ɡ' }); i += 2; continue;
    }
    if (ch === 'g' && w[i + 1] === 'ü' && 'eéií'.includes(w[i + 2] || '')) {
      flushRun(); items.push({ cons: 'ɡw' }); i += 2; continue;
    }
    if (ch === 'h') { i += 1; continue; } // silent, transparent to vowel runs
    if (ch === 'x') {
      flushRun();
      if (i === 0) {
        items.push({ cons: 's' }); // word-initial x -> [s]
      } else {
        items.push({ cons: 'k' });
        items.push({ cons: 's' });
      }
      i += 1; continue;
    }
    if (ch === 'y') {
      const prev = w[i - 1];
      const next = w[i + 1];
      if (i === w.length - 1 && prev && isVowelLetter(prev)) {
        run.push({ base: 'i', strong: false, accented: false });
        i += 1; continue;
      }
      if (next && isVowelLetter(next)) {
        flushRun(); items.push({ cons: 'ʝ' }); i += 1; continue;
      }
      run.push({ base: 'i', strong: false, accented: false });
      i += 1; continue;
    }
    if (isVowelLetter(ch)) {
      const base = ACCENT_MAP[ch] || (ch === 'ü' ? 'u' : ch);
      run.push({ base, strong: STRONG.has(base), accented: ch in ACCENT_MAP });
      i += 1; continue;
    }
    flushRun();
    items.push({ cons: consonantPh(ch, w, i) });
    i += 1;
  }
  flushRun();

  // Pass 2: expand into elements (consonant phonemes and nucleus blocks).
  const elements = [];
  for (const it of items) {
    if (it.cons !== undefined) {
      elements.push({ kind: 'c', ph: it.cons });
    } else {
      for (const nuc of groupRun(it.run)) {
        const phones = [];
        if (nuc.pre) phones.push(nuc.pre.base === 'i' ? 'j' : 'w');
        phones.push(nuc.vow.base);
        if (nuc.post) phones.push(nuc.post.base === 'i' ? 'j' : 'w');
        elements.push({ kind: 'n', phones, accented: nuc.vow.accented });
      }
    }
  }

  // Pass 3: syllabify. Cuts fall between nuclei; each slice holds one nucleus.
  const nucPos = elements.map((e, idx) => (e.kind === 'n' ? idx : -1)).filter((x) => x >= 0);
  const cuts = [0];
  for (let p = 0; p + 1 < nucPos.length; p++) {
    const a = nucPos[p];
    const b = nucPos[p + 1];
    const cons = elements.slice(a + 1, b);
    const k = cons.length;
    let cut;
    if (k === 0) {
      cut = a + 1;
    } else if (k >= 2 && VALID_ONSET.has(cons[k - 2].ph + cons[k - 1].ph)) {
      cut = a + k - 1;
    } else {
      cut = a + k;
    }
    cuts.push(cut);
  }
  cuts.push(elements.length);
  const syllables = [];
  for (let s = 0; s + 1 < cuts.length; s++) {
    syllables.push(elements.slice(cuts[s], cuts[s + 1]));
  }

  // Pass 4: stress. Accent mark wins; else vowel/n/s ending -> penult, else final.
  let stressed = -1;
  for (let s = 0; s < syllables.length; s++) {
    if (syllables[s].some((e) => e.kind === 'n' && e.accented)) { stressed = s; break; }
  }
  if (stressed === -1) {
    const last = w[w.length - 1];
    // Word-final y counts as a consonant for stress (Paraguay, Uruguay,
    // mamey are final-stressed, like words ending in a consonant); only
    // vowel/n/s endings take the penult.
    const endsSoft = 'aeiouáéíóú'.includes(last) || last === 'n' || last === 's';
    stressed = syllables.length > 1 ? (endsSoft ? syllables.length - 2 : syllables.length - 1) : 0;
  }

  // Pass 5: render. The stress mark replaces the dot before the stressed syllable.
  let out = '';
  syllables.forEach((syl, idx) => {
    const ph = syl.map((e) => (e.kind === 'c' ? e.ph : e.phones.join(''))).join('');
    if (idx === 0) {
      out += (syllables.length > 1 && idx === stressed ? 'ˈ' : '') + ph;
    } else if (syllables.length > 1 && idx === stressed) {
      out += 'ˈ' + ph;
    } else {
      out += '.' + ph;
    }
  });
  return '[' + out + ']';
}

// Export: Node (module.exports) and browser (window.espanstantoPronounce).
var espanstantoPronounce = { ipa: ipa, pronounceWord: ipa };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = espanstantoPronounce;
}
if (typeof window !== 'undefined') {
  window.espanstantoPronounce = espanstantoPronounce;
}
