const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlPath = path.join(__dirname, 'check.html');
const args = process.argv.slice(2);

if (args.length < 2 || args.length > 3) {
    console.log('Usage: node override.js [root] [new_override]');
    console.log('       node override.js [doudouling] [root] [new_override]');
    process.exit(1);
}

let col1, col2, col3;
if (args.length === 2) {
    [col2, col3] = args;
} else {
    [col1, col2, col3] = args;
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');
const csvMatch = htmlContent.match(/const csvData = `([\s\S]*?)`;/);

if (csvMatch) {
    const csvDataStr = csvMatch[1];
    const lines = csvDataStr.split('\n');
    const newLines = lines.map(line => {
        if (line.trim() === "") return line;
        let cols = line.split(',');
        while (cols.length < 7) cols.push('');
        
        const doudou = cols[0].trim();
        const root = cols[1].trim();

        let match = false;
        if (args.length === 2) {
            if (root === col2) match = true;
        } else {
            if (doudou === col1 && root === col2) match = true;
        }

        if (match) {
            cols[2] = col3;
        }
        return cols.join(',');
    });

    const newCsvDataStr = newLines.join('\n');
    htmlContent = htmlContent.replace(/const csvData = `([\s\S]*?)`;/, `const csvData = \`${newCsvDataStr}\`;`);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`Updated override: ${args.length === 2 ? col2 : col1 + ',' + col2} -> ${col3}`);

    // Run check.js
    const checkJsPath = path.join(__dirname, 'check.js');
    try {
        console.log('Running check.js...');
        const output = execSync(`node "${checkJsPath}"`, { encoding: 'utf8' });
        console.log(output);
    } catch (err) {
        console.error('Error running check.js:', err.message);
    }
} else {
    console.error('CSV data not found in check.html');
}
