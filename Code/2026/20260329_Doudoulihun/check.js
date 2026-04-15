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

function tokenizeConsonants(text) {
    var result = [];
    var index = 0;
    while (index < text.length) {
        if (text.startsWith("ts", index) || text.startsWith("dz", index)) {
            result.push(text.substring(index, index + 2));
            index += 2;
        }
        else {
            result.push(text[index]);
            index++;
        }
    }
    return result;
}

function syllabify(text) {
    var positions = [];
    var index = 0;
    while (index < text.length) {
        var matched = false;
        for (var vowelCombination of VOWEL_COMBINATIONS) {
            if (text.startsWith(vowelCombination, index)) {
                positions.push({ start: index, end: index + vowelCombination.length, vc: vowelCombination });
                index += vowelCombination.length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            index++;
        }
    }
    if (positions.length === 0) {
        return [text];
    }

    var syllables = positions.map(function (position) {
        return { vc: position.vc, start: position.start, end: position.end, pre: [], post: [] };
    });

    for (var syllableIdx = 1; syllableIdx < syllables.length; syllableIdx++) {
        var prevEnd = syllables[syllableIdx - 1].end;
        var currStart = syllables[syllableIdx].start;
        var middleText = text.substring(prevEnd, currStart);
        var units = tokenizeConsonants(middleText);

        var claimed = [];
        var unitIndex = units.length - 1;
        var stop = false;
        while (unitIndex >= 0 && !stop) {
            var unit = units[unitIndex];
            if (unit === 'w') {
                claimed.unshift(unit);
                unitIndex--;
                if (unitIndex >= 0) {
                    if ('ptk'.indexOf(units[unitIndex]) !== -1) {
                        claimed.unshift(units[unitIndex]);
                        unitIndex--;
                        if (unitIndex >= 0 && units[unitIndex] === 's') {
                            claimed.unshift(units[unitIndex]);
                            unitIndex--;
                        }
                    } else if ('bdg'.indexOf(units[unitIndex]) !== -1) {
                        claimed.unshift(units[unitIndex]);
                        unitIndex--;
                    }
                }
                stop = true;
            } else if (unit === 'l') {
                claimed.unshift(unit);
                unitIndex--;
                if (unitIndex >= 0) {
                    if ('pk'.indexOf(units[unitIndex]) !== -1) {
                        claimed.unshift(units[unitIndex]);
                        unitIndex--;
                        if (unitIndex >= 0 && units[unitIndex] === 's') {
                            claimed.unshift(units[unitIndex]);
                            unitIndex--;
                        }
                    } else if ('bg'.indexOf(units[unitIndex]) !== -1) {
                        claimed.unshift(units[unitIndex]);
                        unitIndex--;
                    }
                }
                stop = true;
            } else if ('ptk'.indexOf(unit) !== -1) {
                claimed.unshift(unit);
                unitIndex--;
                if (unitIndex >= 0 && units[unitIndex] === 's') {
                    claimed.unshift(units[unitIndex]);
                    unitIndex--;
                }
                stop = true;
            } else {
                claimed.unshift(unit);
                unitIndex--;
                stop = true;
            }
        }
        syllables[syllableIdx].pre = claimed;
        syllables[syllableIdx - 1].post = units.slice(0, unitIndex + 1);
    }

    syllables[0].pre = tokenizeConsonants(text.substring(0, syllables[0].start));
    syllables[syllables.length - 1].post = tokenizeConsonants(text.substring(syllables[syllables.length - 1].end));

    return syllables.map(function (syllable) {
        return syllable.pre.join("") + syllable.vc + syllable.post.join("");
    });
}

function convertSyllable(syllable, justOrganize) {
    var vowelMatch = null;
    for (var vowelCombination of VOWEL_COMBINATIONS) {
        var index = syllable.indexOf(vowelCombination);
        if (index !== -1) {
            vowelMatch = { vc: vowelCombination, start: index, end: index + vowelCombination.length };
            break;
        }
    }
    if (!vowelMatch) {
        return syllable;
    }

    var prePart = tokenizeConsonants(syllable.substring(0, vowelMatch.start));
    var postPart = tokenizeConsonants(syllable.substring(vowelMatch.end));
    var vc = vowelMatch.vc;
    var firstVowel = vc[0];
    var lastVowel = vc[vc.length - 1];

    var primaryConsonant = prePart.length > 0 ? prePart[0] : "";
    var beforeVowelSupportConsonant = prePart.slice(1);

    var postNasal = "";
    var afterVowelSupportConsonant = [];
    for (var i = 0; i < postPart.length; i++) {
        if ((postPart[i] === 'm' || postPart[i] === 'n') && postNasal === "") {
            postNasal = postPart[i];
        }
        else {
            afterVowelSupportConsonant.push(postPart[i]);
        }
    }

    var supportConsonant = beforeVowelSupportConsonant.concat(afterVowelSupportConsonant);
    var convertedResult = justOrganize ? primaryConsonant.toUpperCase() : primaryConsonant;

    function getX(consonant, vowel) {
        if (justOrganize) {
            return consonant;
        }
        if ("bpfv".indexOf(consonant) !== -1) {
            return "aeo".indexOf(vowel) !== -1 ? "uf" : (vowel === 'i' ? "uf" : "iuf");
        }
        if ("dt".indexOf(consonant) !== -1) {
            return "aeo".indexOf(vowel) !== -1 ? "ih" : (vowel === 'i' ? "uih" : "ij");
        }
        if ("s".indexOf(consonant) !== -1 || consonant === "ts" || consonant === "dz") {
            return "aeo".indexOf(vowel) !== -1 ? "ij" : (vowel === 'i' ? "uij" : "ij");
        }
        if ("gk".indexOf(consonant) !== -1) {
            return "aeo".indexOf(vowel) !== -1 ? "uh" : (vowel === 'i' ? "uh" : "iuh");
        }
        if (consonant === "w") {
            return "aeo".indexOf(vowel) !== -1 ? "uw" : (vowel === 'i' ? "uw" : "iuw");
        }
        if (consonant === "l") {
            return "aeo".indexOf(vowel) !== -1 ? "uv" : (vowel === 'i' ? "uv" : "iuv");
        }
        if (consonant === "m") {
            return "aeo".indexOf(vowel) !== -1 ? "uf" : (vowel === 'i' ? "uf" : "iuf");
        }
        if (consonant === "n") {
            return "aeo".indexOf(vowel) !== -1 ? "ih" : (vowel === 'i' ? "uih" : "ihu");
        }
        return "";
    }
    function getY(consonant, vowel) {
        if (justOrganize) {
            return consonant;
        }
        if ("bpfv".indexOf(consonant) !== -1) {
            return "aeo".indexOf(vowel) !== -1 ? "fu" : (vowel === 'i' ? "fu" : "fui");
        }
        if ("dt".indexOf(consonant) !== -1) {
            return "aeo".indexOf(vowel) !== -1 ? "hi" : (vowel === 'i' ? "hiu" : "ji");
        }
        if ("s".indexOf(consonant) !== -1 || consonant === "ts" || consonant === "dz") {
            return "aeo".indexOf(vowel) !== -1 ? "ji" : (vowel === 'i' ? "jiu" : "ji");
        }
        if ("gk".indexOf(consonant) !== -1) {
            return "aeo".indexOf(vowel) !== -1 ? "hu" : (vowel === 'i' ? "hu" : "hui");
        }
        if (consonant === "w") {
            return "aeo".indexOf(vowel) !== -1 ? "wu" : (vowel === 'i' ? "wu" : "wui");
        }
        if (consonant === "l") {
            return "aeo".indexOf(vowel) !== -1 ? "vu" : (vowel === 'i' ? "vu" : "vui");
        }
        return "";
    }
    function getZ(consonant) {
        if (justOrganize) {
            return consonant;
        }
        if ("bpfv".indexOf(consonant) !== -1) {
            return "m";
        }
        if ("dtgk".indexOf(consonant) !== -1) {
            return "n";
        }
        return "";
    }

    if (postNasal !== "") {
        if (supportConsonant.length === 0) {
            convertedResult += vc + postNasal;
        }
        else if (supportConsonant.length === 1 && beforeVowelSupportConsonant.length === 1) {
            convertedResult += getX(beforeVowelSupportConsonant[0], firstVowel) + vc + postNasal;
        }
        else if (supportConsonant.length === 1 && afterVowelSupportConsonant.length === 1) {
            convertedResult += vc + getY(afterVowelSupportConsonant[0], lastVowel) + postNasal;
        }
        else if (supportConsonant.length >= 2) {
            convertedResult += getX(supportConsonant[0], firstVowel) + vc + getY(supportConsonant[1], lastVowel) + postNasal;
        }
    } else {
        if (supportConsonant.length === 0) {
            convertedResult += vc;
        }
        else if (supportConsonant.length === 1 && beforeVowelSupportConsonant.length === 1) {
            convertedResult += getX(beforeVowelSupportConsonant[0], firstVowel) + vc;
        }
        else if (supportConsonant.length === 1 && afterVowelSupportConsonant.length === 1) {
            convertedResult += vc + getY(afterVowelSupportConsonant[0], lastVowel);
        }
        else if (supportConsonant.length === 2) {
            convertedResult += getX(supportConsonant[0], firstVowel) + vc + getY(supportConsonant[1], lastVowel);
        }
        else if (supportConsonant.length >= 3) {
            convertedResult += getX(supportConsonant[0], firstVowel) + vc + getY(supportConsonant[1], lastVowel) + getZ(supportConsonant[2]);
        }
    }
    return convertedResult;
}

const newLines = lines.map((line) => {
    if (line.trim() === "") {
        return line;
    }
    let columns = line.split(',');
    
    // Ensure we have exactly 7 columns
    if (columns.length > 7) {
        columns = columns.slice(0, 7);
    } else {
        while (columns.length < 7) {
            columns.push('');
        }
    }

    const doudouling = columns[0].trim();
    const root = columns[1].trim();
    const override = columns[2].trim();

    const input = override !== "" ? override : root;

    columns[2] = override; 

    try {
        const word = input.toLowerCase();
        // Validation from index.html
        var invalidMatches = word.match(/[^abdefghijklmnopstuvwz]/g);
        if (invalidMatches) {
            columns[3] = ""; // Breakdown
            columns[4] = ""; // Organized
            columns[5] = ""; // Generated
            columns[6] = ("Invalid characters: " + Array.from(new Set(invalidMatches)).join(" and "));
        } else if (/(^|[^d])z/.test(word)) {
            columns[3] = "";
            columns[4] = "";
            columns[5] = "";
            columns[6] = "Invalid sequence: 'z' must follow 'd'";
        } else {
            const syllables = syllabify(word);
            const breakdown = syllables.join("-");
            const organized = syllables.map((syllable) => {
                return convertSyllable(syllable, true);
            }).join("");
            const generated = syllables.map((syllable) => {
                return convertSyllable(syllable, false);
            }).join("");

            columns[3] = breakdown;
            columns[4] = organized;
            columns[5] = generated;

            if (doudouling !== generated) {
                columns[6] = "mismatched";
            } else {
                columns[6] = "";
            }
        }
    } catch (error) {
        columns[3] = "";
        columns[4] = "";
        columns[5] = "";
        columns[6] = ("Error: " + error.message).replace(/,/g, " and ");
    }

    return columns.join(',');
});

const newCsvDataStr = newLines.join('\n');
const updatedHtmlContent = htmlContent.replace(/const csvData = `([\s\S]*?)`;/, `const csvData = \`${newCsvDataStr}\`;`);

fs.writeFileSync(htmlPath, updatedHtmlContent, 'utf8');
console.log('Successfully updated check.html');
