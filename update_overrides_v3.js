const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'Code/2026/20260329_Doudoulihun/check.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

const csvMatch = htmlContent.match(/const csvData = `([\s\S]*?)`;/);
if (csvMatch) {
    const csvDataStr = csvMatch[1];
    const lines = csvDataStr.split('\n');
    const newLines = lines.map(line => {
        if (line.trim() === "") return line;
        let cols = line.split(',');
        while (cols.length < 7) cols.push('');
        
        const doudouling = cols[0].trim();
        const root = cols[1].trim();

        if (root === 'dict') cols[2] = 'dik';
        else if (root === 'alter') cols[2] = 'altew';
        else if (doudouling === 'ni' && root === 'nostr') cols[2] = 'ni';
        else if (root === 'lax') cols[2] = 'laks';
        else if (doudouling === 'le' && root === 'ill') cols[2] = 'le';
        else if (root === 'tile') cols[2] = 'til';
        else if (doudouling === 'li' && root === 'lor') cols[2] = 'li';
        else if (doudouling === 'hafu' && root === 'hab') cols[2] = 'hab';
        else if (root === 'pro') cols[2] = 'po';

        return cols.join(',');
    });
    const newCsvDataStr = newLines.join('\n');
    htmlContent = htmlContent.replace(/const csvData = `([\s\S]*?)`;/, `const csvData = \`${newCsvDataStr}\`;`);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log('Successfully updated overrides in check.html');
} else {
    console.error('CSV data not found in check.html');
}
