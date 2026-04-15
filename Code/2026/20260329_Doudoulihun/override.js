const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlPath = path.join(__dirname, 'check.html');
const cliArguments = process.argv.slice(2);

if (cliArguments.length < 2 || cliArguments.length > 3) {
    console.log('Usage: node override.js [root] [new_override]');
    console.log('       node override.js [doudouling] [root] [new_override]');
    process.exit(1);
}

let column1, column2, column3;
if (cliArguments.length === 2) {
    [column2, column3] = cliArguments;
} else {
    [column1, column2, column3] = cliArguments;
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');
const csvMatch = htmlContent.match(/const csvData = `([\s\S]*?)`;/);

if (csvMatch) {
    const csvDataStr = csvMatch[1];
    const lines = csvDataStr.split('\n');
    const newLines = lines.map((line) => {
        if (line.trim() === "") {
            return line;
        }
        let columns = line.split(',');
        while (columns.length < 7) {
            columns.push('');
        }
        
        const doudouling = columns[0].trim();
        const root = columns[1].trim();

        let isMatch = false;
        if (cliArguments.length === 2) {
            if (root === column2) {
                isMatch = true;
            }
        } else {
            if (doudouling === column1 && root === column2) {
                isMatch = true;
            }
        }

        if (isMatch) {
            columns[2] = column3;
        }
        return columns.join(',');
    });

    const newCsvDataStr = newLines.join('\n');
    htmlContent = htmlContent.replace(/const csvData = `([\s\S]*?)`;/, `const csvData = \`${newCsvDataStr}\`;`);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`Updated override: ${cliArguments.length === 2 ? column2 : column1 + ',' + column2} -> ${column3}`);

    // Run check.js
    const checkJsPath = path.join(__dirname, 'check.js');
    try {
        console.log('Running check.js...');
        const output = execSync(`node "${checkJsPath}"`, { encoding: 'utf8' });
        console.log(output);
    } catch (error) {
        console.error('Error running check.js:', error.message);
    }
} else {
    console.error('CSV data not found in check.html');
}
