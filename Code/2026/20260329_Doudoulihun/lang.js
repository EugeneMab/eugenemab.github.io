const fs = require('fs');

const VOWEL_COMBINATIONS = [
  'iai', 'iei', 'ioi',
  'iau', 'ieu', 'iou',
  'uai', 'uei', 'uoi',
  'uau', 'ueu', 'uou',
  'ai', 'ei', 'oi',
  'au', 'eu', 'ou',
  'ia', 'ie', 'io',
  'ua', 'ue', 'uo',
  'a', 'e', 'i', 'o', 'u',
];

function tokenizeConsonants(str) {
  var res = [];
  var i = 0;
  while (i < str.length) {
    if (str.startsWith("ts", i) || str.startsWith("dz", i)) {
      res.push(str.substring(i, i+2));
      i += 2;
    }
    else { res.push(str[i]); i++; }
  }
  return res;
}

function syllabify(text) {
  var positions = [];
  var i = 0;
  while (i < text.length) {
    var matched = false;
    for (var vc of VOWEL_COMBINATIONS) {
      if (text.startsWith(vc, i)) {
        positions.push({ start: i, end: i + vc.length, vc: vc });
        i += vc.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      i++;
    }
  }
  if (positions.length === 0) {
    return [text];
  }
  
  var syllables = positions.map(function(p) { 
    return { vc: p.vc, start: p.start, end: p.end, pre: [], post: [] }; 
  });
  
  for (var idx = 1; idx < syllables.length; idx++) {
    var prevEnd = syllables[idx - 1].end;
    var currStart = syllables[idx].start;
    var mid = text.substring(prevEnd, currStart);
    var units = tokenizeConsonants(mid);
    
    var claimed = [];
    var k = units.length - 1;
    var stop = false;
    while (k >= 0 && !stop) {
      var u = units[k];
      if (u === 'w') {
        claimed.unshift(u);
        k--;
        if (k >= 0) {
          if ('ptk'.indexOf(units[k]) !== -1) {
            claimed.unshift(units[k]);
            k--;
            if (k >= 0 && units[k] === 's') {
              claimed.unshift(units[k]);
              k--;
            }
          } else if ('bdg'.indexOf(units[k]) !== -1) {
            claimed.unshift(units[k]); k--;
          }
        }
        stop = true;
      } else if (u === 'l') {
        claimed.unshift(u);
        k--;
        if (k >= 0) {
          if ('pk'.indexOf(units[k]) !== -1) {
            claimed.unshift(units[k]);
            k--;
            if (k >= 0 && units[k] === 's') {
              claimed.unshift(units[k]);
              k--;
            }
          } else if ('bg'.indexOf(units[k]) !== -1) {
            claimed.unshift(units[k]); k--;
          }
        }
        stop = true;
      } else if ('ptk'.indexOf(u) !== -1) {
        claimed.unshift(u);
        k--;
        if (k >= 0 && units[k] === 's') {
          claimed.unshift(units[k]);
          k--;
        }
        stop = true;
      } else {
        claimed.unshift(u);
        k--;
        stop = true;
      }
    }
    syllables[idx].pre = claimed;
    syllables[idx-1].post = units.slice(0, k + 1);
  }
  
  syllables[0].pre = tokenizeConsonants(text.substring(0, syllables[0].start));
  syllables[syllables.length-1].post = tokenizeConsonants(text.substring(syllables[syllables.length-1].end));
  
  return syllables.map(function(s) {
    return s.pre.join("") + s.vc + s.post.join("");
  });
}

function convertSyllable(s, justOrganize) {
  var vMatch = null;
  for (var vc of VOWEL_COMBINATIONS) {
    var idx = s.indexOf(vc);
    if (idx !== -1) {
      vMatch = { vc: vc, start: idx, end: idx + vc.length };
      break;
    }
  }
  if (!vMatch) {
    return s;
  }

  var pre = tokenizeConsonants(s.substring(0, vMatch.start));
  var post = tokenizeConsonants(s.substring(vMatch.end));
  var vc = vMatch.vc;
  var fv = vc[0];
  var lv = vc[vc.length - 1];
  
  var pc = pre.length > 0 ? pre[0] : "";
  var bsc = pre.slice(1);
  
  var pn = "";
  var asc = [];
  for (var i = 0; i < post.length; i++) {
    if ((post[i] === 'm' || post[i] === 'n') && pn === "") {
      pn = post[i];
    }
    else {
      asc.push(post[i]);
    }
  }
  
  var sc = bsc.concat(asc);
  var res = justOrganize ? pc.toUpperCase() : pc;
  
  function getX(c, v) {
    if (justOrganize) return c;
    if ("bpfv".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "uf" : (v==='i'?"uf":"iuf");
    if ("dt".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "ih" : (v==='i'?"uih":"ij");
    if ("s".indexOf(c) !== -1 || c==="ts" || c==="dz") return "aeo".indexOf(v) !== -1 ? "ij" : (v==='i'?"uij":"ij");
    if ("gk".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "uh" : (v==='i'?"uh":"iuh");
    if (c === "w") return "aeo".indexOf(v) !== -1 ? "uw" : (v==='i'?"uw":"iuw");
    if (c === "l") return "aeo".indexOf(v) !== -1 ? "uv" : (v==='i'?"uv":"iuv");
    if (c === "m") return "aeo".indexOf(v) !== -1 ? "uf" : (v==='i'?"uf":"iuf");
    if (c === "n") return "aeo".indexOf(v) !== -1 ? "ih" : (v==='i'?"uih":"ihu");
    return "";
  }
  function getY(c, v) {
    if (justOrganize) return c;
    if ("bpfv".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "fu" : (v==='i'?"fu":"fui");
    if ("dt".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "hi" : (v==='i'?"hiu":"ji");
    if ("s".indexOf(c) !== -1 || c==="ts" || c==="dz") return "aeo".indexOf(v) !== -1 ? "ji" : (v==='i'?"jiu":"ji");
    if ("gk".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "hu" : (v==='i'?"hu":"hui");
    if (c === "w") return "aeo".indexOf(v) !== -1 ? "wu" : (v==='i'?"wu":"wui");
    if (c === "l") return "aeo".indexOf(v) !== -1 ? "vu" : (v==='i'?"vu":"vui");
    return "";
  }
  function getZ(c) {
    if (justOrganize) return c;
    if ("bpfv".indexOf(c) !== -1) return "m";
    if ("dtgk".indexOf(c) !== -1) return "n";
    return "";
  }

  if (pn !== "") {
    if (sc.length === 0) res += vc + pn;
    else if (sc.length === 1 && bsc.length === 1) res += getX(bsc[0], fv) + vc + pn;
    else if (sc.length === 1 && asc.length === 1) res += vc + getY(asc[0], lv) + pn;
    else if (sc.length >= 2) res += getX(sc[0], fv) + vc + getY(sc[1], lv) + pn;
  } else {
    if (sc.length === 0) res += vc;
    else if (sc.length === 1 && bsc.length === 1) res += getX(bsc[0], fv) + vc;
    else if (sc.length === 1 && asc.length === 1) res += vc + getY(asc[0], lv);
    else if (sc.length === 2) res += getX(sc[0], fv) + vc + getY(sc[1], lv);
    else if (sc.length >= 3) res += getX(sc[0], fv) + vc + getY(sc[1], lv) + getZ(sc[2]);
  }
  return res;
}

const tableData = [
  ["state", "stat", "", "", "Stat", "sihahi"],
  ["sper", "spew", "", "", "Spew", "sufewu"],
  ["sport", "spowt", "", "", "Spowt", "sufowun"],
  ["science", "stsients", "", "", "Stsi-esn", "suijiejin"],
  ["photo", "foto", "", "", "FoTo", "foto"],
  ["wagon", "vagon", "", "", "VaGon", "vagon"],
  ["cent", "tsent", "", "", "Tsetn", "tsehin"],
  ["center", "tsentew", "", "", "TsenTew", "tsentewu"],
  ["aqu", "ak", "", "", "ak", "ahu"],
  ["aquatic", "akuatik", "", "", "aKuaTik", "akuatihu"],
  ["question", "kuestsion", "", "", "KuesTSion", "kuejitsion"],
  ["tank", "tank", "", "", "Takn", "tahun"],
  ["xerox", "tsewoks", "", "", "TseWkos", "tsewuhoji"],
  ["chocolate", "tsokolat", "", "", "TsoKoLat", "tsokolahi"],
  ["just", "dzust", "", "", "DZsut", "dzijuji"],
  ["adoption", "adoptsion", "", "", "aDopTSion", "adofutsion"],
  ["train", "twain", "", "", "Twain", "tuwain"],
  ["tract", "twakt", "", "", "Twakt", "tuwahun"],
  ["create", "kweat", "", "", "Kwe-at", "kuweahi"],
  ["class", "klass", "", "", "Klass", "kuvaji"],
  ["cause", "kaus", "", "", "Kaus", "kauji"],
  ["daemon", "daemon", "", "", "Daemon", "daemon"],
  ["coffee", "koffee", "", "", "KofFee", "kofufee"],
  ["moustache", "moustats", "", "", "MouStats", "mousihaji"],
  ["phoenix", "foeniks", "", "", "FoeNkis", "foenuhijiu"],
  ["phoenician", "foenitsian", "", "", "FoeNiTSian", "foenitsian"],
  ["europe", "euwop", "", "", "euWop", "euwofu"],
  ["return", "wetuwn", "", "", "WeTuwn", "wetuwuin"],
  ["depart", "depawt", "", "", "DePwat", "depuwahi"],
  ["alt", "alt", "", "", "lat", "uvahi"],
  ["art", "awt", "", "", "wat", "uwahi"],
  ["arts", "awts", "", "", "wats", "uwaji"],
  ["culture", "kultuw", "", "", "KulTuw", "kuvuituwui"],
  ["court", "kouwt", "", "", "Kwout", "kuwouji"],
  ["cant", "kant", "", "", "Katn", "kahin"],
  ["simple", "simple", "", "", "SimPle", "simpuve"],
  ["hom", "hom", "", "", "Hom", "hom"],
  ["autumn", "autumn", "", "", "auTunm", "autum"],
  ["environment", "enviwonment", "", "", "enViWonMetn", "enviwonmehin"],
  ["fact", "fakt", "", "", "Fkat", "fuhahi"],
  ["experiment", "ekspewiment", "", "", "ekSpeWiMetn", "ehusufewimehin"],
  ["expresss", "ekspwess", "", "", "ekSpwess", "ehusufewu"],
  ["sign", "sign", "", "", "Sign", "sihun"],
  ["sing", "sing", "", "", "Sign", "sihun"],
  ["skin", "skin", "", "", "Skin", "suhin"],
  ["dogmatic", "dogmatik", "", "", "DogMaTik", "dohumatihu"],
  ["construct", "konstwuk", "", "", "KonStuwk", "konsijuwuin"],
  ["verb", "vewb", "", "", "Vweb", "vuwefu"],
  ["partner", "pawtnew", "", "", "PwatNew", "puwahinewu"],
  ["investment", "", "", "", "inVsetMetn", "invijehimehin"],
  ["continue", "kontinu", "", "", "KonTiNu", "kontinu"],
  ["Doudouling", "doudouling", "", "", "DouDouLign", "doudoulihun"],
  ["data", "data", "", "", "DaTa", "data"],
  ["exact", "eksakt", "", "", "ekSkat", "ehusuhahi"],
  ["slave", "slav", "", "", "Slav", "suvafu"],
  ["salv", "salv", "", "", "Slav", "suvafu"],
  ["next", "nekst", "", "", "Nkest", "nuhejin"],
  ["stunt", "stunt", "", "", "Stutn", "sijujin"],
  ["complex", "kompleks", "", "", "KomPleks", "kompuvehu"],
  ["start", "stawt", "", "", "Stawt", "sihawun"],
  ["strate", "stwat", "", "", "Stawt", "sihawun"],
  ["transfer", "twansfew", "", "", "TwasnFew", "tuwajinfewu"]
];

const results = tableData.map((row, index) => {
  const input = row[1];
  if (!input) return { row: index + 1, existing: row, generated: ["", "", ""], mismatch: [false, false] };

  const syls = syllabify(input.toLowerCase());
  const col3_gen = syls.join("-");
  const col5_gen = syls.map(s => convertSyllable(s, true)).join("");
  const col6_gen = syls.map(s => convertSyllable(s, false)).join("");

  return {
    row: index + 1,
    existing: row,
    generated: [col3_gen, col5_gen, col6_gen],
    mismatch: [col5_gen !== row[4], col6_gen !== row[5]]
  };
});

fs.writeFileSync('compare.json', JSON.stringify(results, null, 2));
console.log('Comparison complete. Results saved to compare.json');
