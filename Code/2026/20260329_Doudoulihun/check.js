const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'check.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract CSV data from check.html
const csvMatch = htmlContent.match(/const csvData = `([\s\S]*?)`;/);
if (!csvMatch) {
    console.error('Could not find csvData in check.html');
    process.exit(1);
}

let csvDataStr = csvMatch[1];
const lines = csvDataStr.split('\n');

// Conversion Logic from index.html
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
            res.push(str.substring(i, i + 2));
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

    var syllables = positions.map(function (p) {
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
        syllables[idx - 1].post = units.slice(0, k + 1);
    }

    syllables[0].pre = tokenizeConsonants(text.substring(0, syllables[0].start));
    syllables[syllables.length - 1].post = tokenizeConsonants(text.substring(syllables[syllables.length - 1].end));

    return syllables.map(function (s) {
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
        if ("bpfv".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "uf" : (v === 'i' ? "uf" : "iuf");
        if ("dt".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "ih" : (v === 'i' ? "uih" : "ij");
        if ("s".indexOf(c) !== -1 || c === "ts" || c === "dz") return "aeo".indexOf(v) !== -1 ? "ij" : (v === 'i' ? "uij" : "ij");
        if ("gk".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "uh" : (v === 'i' ? "uh" : "iuh");
        if (c === "w") return "aeo".indexOf(v) !== -1 ? "uw" : (v === 'i' ? "uw" : "iuw");
        if (c === "l") return "aeo".indexOf(v) !== -1 ? "uv" : (v === 'i' ? "uv" : "iuv");
        if (c === "m") return "aeo".indexOf(v) !== -1 ? "uf" : (v === 'i' ? "uf" : "iuf");
        if (c === "n") return "aeo".indexOf(v) !== -1 ? "ih" : (v === 'i' ? "uih" : "ihu");
        return "";
    }
    function getY(c, v) {
        if (justOrganize) return c;
        if ("bpfv".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "fu" : (v === 'i' ? "fu" : "fui");
        if ("dt".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "hi" : (v === 'i' ? "hiu" : "ji");
        if ("s".indexOf(c) !== -1 || c === "ts" || c === "dz") return "aeo".indexOf(v) !== -1 ? "ji" : (v === 'i' ? "jiu" : "ji");
        if ("gk".indexOf(c) !== -1) return "aeo".indexOf(v) !== -1 ? "hu" : (v === 'i' ? "hu" : "hui");
        if (c === "w") return "aeo".indexOf(v) !== -1 ? "wu" : (v === 'i' ? "wu" : "wui");
        if (c === "l") return "aeo".indexOf(v) !== -1 ? "vu" : (v === 'i' ? "vu" : "vui");
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

const newLines = lines.map(line => {
    if (line.trim() === "") return line;
    let cols = line.split(',');
    
    // Ensure we have exactly 7 columns
    if (cols.length > 7) {
        cols = cols.slice(0, 7);
    } else {
        while (cols.length < 7) cols.push('');
    }

    const doudouling = cols[0].trim();
    const root = cols[1].trim();
    const override = cols[2].trim();

    const input = override !== "" ? override : root;

    cols[2] = override; 

    try {
        const word = input.toLowerCase();
        // Validation from index.html
        var invalid = word.match(/[^abdefghijklmnopstuvwz]/g);
        if (invalid) {
            cols[3] = ""; // Breakdown
            cols[4] = ""; // Organized
            cols[5] = ""; // Generated
            cols[6] = ("Invalid characters: " + Array.from(new Set(invalid)).join(" and "));
        } else if (/(^|[^d])z/.test(word)) {
            cols[3] = "";
            cols[4] = "";
            cols[5] = "";
            cols[6] = "Invalid sequence: 'z' must follow 'd'";
        } else {
            const syls = syllabify(word);
            const breakdown = syls.join("-");
            const organized = syls.map(s => convertSyllable(s, true)).join("");
            const generated = syls.map(s => convertSyllable(s, false)).join("");

            cols[3] = breakdown;
            cols[4] = organized;
            cols[5] = generated;

            if (doudouling !== generated) {
                cols[6] = "mismatched";
            } else {
                cols[6] = "";
            }
        }
    } catch (e) {
        cols[3] = "";
        cols[4] = "";
        cols[5] = "";
        cols[6] = ("Error: " + e.message).replace(/,/g, " and ");
    }

    return cols.join(',');
});

const newCsvDataStr = newLines.join('\n');
const updatedHtmlContent = htmlContent.replace(/const csvData = `([\s\S]*?)`;/, `const csvData = \`${newCsvDataStr}\`;`);

fs.writeFileSync(htmlPath, updatedHtmlContent, 'utf8');
console.log('Successfully updated check.html');
