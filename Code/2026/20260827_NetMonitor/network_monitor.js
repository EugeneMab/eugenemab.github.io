const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

// ==========================================
// CONSTANTS
// ==========================================
const TXT_PATH = `C:\\S\\network_monitor\\network_monitor.txt`;
const LOG_PATH = `C:\\S\\network_monitor\\network_monitor.log`;
const EXEC_COMMAND = 'ipconfig /all';
const FILE_ENCODING = 'utf8';
const SEPARATOR_CHAR = '_';
const SEPARATOR_LENGTH = 80;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const EOL = '\r\n';

// ==========================================
// UTILITIES & HELPERS
// ==========================================
const execAsync = util.promisify(exec);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    try {
        await fs.access(dirname);
    } catch {
        await fs.mkdir(dirname, { recursive: true });
    }
}

function getFormattedTime(date = new Date()) {
    const yearUTC = date.getUTCFullYear();
    const monthUTC = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dayUTC = String(date.getUTCDate()).padStart(2, '0');
    const hoursUTC = String(date.getUTCHours()).padStart(2, '0');
    const minutesUTC = String(date.getUTCMinutes()).padStart(2, '0');

    const yearLocal = date.getFullYear();
    const monthLocal = String(date.getMonth() + 1).padStart(2, '0');
    const dayLocal = String(date.getDate()).padStart(2, '0');
    const hoursLocal = String(date.getHours()).padStart(2, '0');
    const minutesLocal = String(date.getMinutes()).padStart(2, '0');

    const timeStr = `${yearUTC}-${monthUTC}-${dayUTC} ${hoursUTC}:${minutesUTC} UTC = ${yearLocal}-${monthLocal}-${dayLocal} ${hoursLocal}:${minutesLocal} Local`;
    return timeStr;
}

function normalizeLineEndings(str) {
    // Standardize all line endings (\r\n or standalone \n) to \r\n
    return str.replace(/\r?\n/g, '\r\n');
}

// ==========================================
// MAIN WORKFLOW
// ==========================================
async function runIpconfig() {
    try {
        const { stdout, stderr } = await execAsync(EXEC_COMMAND, { encoding: FILE_ENCODING });
        const timeStr = getFormattedTime();
        const rawOutput = stdout || stderr || '';
        const output = normalizeLineEndings(rawOutput);

        await ensureDirectoryExistence(TXT_PATH);
        await ensureDirectoryExistence(LOG_PATH);

        // File 1: Single line per instance <time> <json-stringified-output>
        const txtLine = `${timeStr} ${JSON.stringify(output)}${EOL}`;
        await fs.appendFile(TXT_PATH, txtLine, FILE_ENCODING);

        // File 2: Log file with separator, <time>, and multiline output
        const separator = SEPARATOR_CHAR.repeat(SEPARATOR_LENGTH);
        const logBlock = `${separator}${EOL}${timeStr}${EOL}${output}${EOL}`;
        await fs.appendFile(LOG_PATH, logBlock, FILE_ENCODING);

        console.log(`[${new Date().toISOString()}] Executed ipconfig /all and logged output.`);
    } catch (error) {
        console.error(`Error executing ipconfig: ${error.message}`);
    }
}

async function main() {
    while (true) {
        await runIpconfig();

        const now = new Date();
        const ms = now.getTime();
        const nextTick = Math.ceil(ms / TEN_MINUTES_MS) * TEN_MINUTES_MS;
        const delay = nextTick - ms;

        console.log(`Next execution scheduled in ${Math.round(delay / 1000)} seconds (at ${new Date(nextTick).toLocaleTimeString()}).`);
        await sleep(delay);
    }
}

main();
