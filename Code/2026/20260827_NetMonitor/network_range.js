const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

// ==========================================
// CONSTANTS
// ==========================================
const RANGE_TXT_PATH = `C:\\S\\network_monitor\\network_range.txt`;
const EXEC_COMMAND = 'ipconfig /all';
const FILE_ENCODING = 'utf8';
const ONE_MINUTE_MS = 60 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;
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
    const secondsUTC = String(date.getUTCSeconds()).padStart(2, '0');

    const yearLocal = date.getFullYear();
    const monthLocal = String(date.getMonth() + 1).padStart(2, '0');
    const dayLocal = String(date.getDate()).padStart(2, '0');
    const hoursLocal = String(date.getHours()).padStart(2, '0');
    const minutesLocal = String(date.getMinutes()).padStart(2, '0');
    const secondsLocal = String(date.getSeconds()).padStart(2, '0');

    const timeStr = `${yearUTC}-${monthUTC}-${dayUTC} ${hoursUTC}:${minutesUTC}:${secondsUTC} UTC = ${yearLocal}-${monthLocal}-${dayLocal} ${hoursLocal}:${minutesLocal}:${secondsLocal} Local`;
    return timeStr;
}

function parseTimeToDate(timeStr) {
    // Input format: YYYY-MM-DD HH:mm:ss UTC = YYYY-MM-DD HH:mm:ss Local
    const utcPart = timeStr.split(' UTC = ')[0].trim();
    const [datePart, clockPart] = utcPart.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = clockPart.split(':').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}

function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    if (days > 0) {
        return `${days}.${hh}:${mm}:${ss}`;
    }
    return `${hh}:${mm}:${ss}`;
}

function normalizeLineEndings(str) {
    return str.replace(/\r?\n/g, '\r\n');
}

function findLeaseObtainedLine(output) {
    const lines = output.split('\r\n');
    const leaseLine = lines.find(line => line.includes('Lease Obtained'));
    return leaseLine ? leaseLine.trim() : '(none)';
}

function serializeRanges(ranges) {
    const lines = [];
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const startDate = parseTimeToDate(range.start);
        const endDate = parseTimeToDate(range.end);
        const durationMs = endDate.getTime() - startDate.getTime();
        const durationStr = formatDuration(durationMs);

        let gapStr = '';
        if (i < ranges.length - 1) {
            const nextStartDate = parseTimeToDate(ranges[i + 1].start);
            const gapMs = nextStartDate.getTime() - endDate.getTime();
            gapStr = formatDuration(gapMs);
        }

        if (gapStr) {
            lines.push(`${range.start} | ${durationStr} | ${range.end} | ${range.leaseLine} | ${gapStr}`);
        } else {
            lines.push(`${range.start} | ${durationStr} | ${range.end} | ${range.leaseLine}`);
        }
    }
    return lines;
}

function parseRanges(fileContent) {
    if (!fileContent || !fileContent.trim()) return [];
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    const ranges = [];

    for (const line of lines) {
        const parts = line.split(' | ').map(p => p.trim());
        if (parts.length >= 4) {
            ranges.push({
                start: parts[0],
                duration: parts[1],
                end: parts[2],
                leaseLine: parts[3],
                gap: parts[4] || ''
            });
        }
    }
    return ranges;
}

// ==========================================
// MAIN WORKFLOW
// ==========================================
async function runProbe() {
    const now = new Date();
    const currentTimeStr = getFormattedTime(now);
    let currentLeaseLine = '(error)';

    try {
        const { stdout, stderr } = await execAsync(EXEC_COMMAND, { encoding: FILE_ENCODING });
        const rawOutput = stdout || stderr || '';
        const output = normalizeLineEndings(rawOutput);
        currentLeaseLine = findLeaseObtainedLine(output);
    } catch (error) {
        console.error(`Error executing ipconfig: ${error.message}`);
        currentLeaseLine = '(error)';
    }

    try {
        await ensureDirectoryExistence(RANGE_TXT_PATH);

        let fileContent = '';
        try {
            fileContent = await fs.readFile(RANGE_TXT_PATH, FILE_ENCODING);
        } catch {
            fileContent = '';
        }

        let ranges = parseRanges(fileContent);

        if (ranges.length > 0) {
            const lastRange = ranges[ranges.length - 1];
            const lastEndDate = parseTimeToDate(lastRange.end);
            const diffMs = now.getTime() - lastEndDate.getTime();

            if (lastRange.leaseLine === currentLeaseLine && diffMs <= TWO_MINUTES_MS) {
                // Merge into last range
                lastRange.end = currentTimeStr;
            } else {
                // Create new range
                ranges.push({
                    start: currentTimeStr,
                    duration: '00:00:00',
                    end: currentTimeStr,
                    leaseLine: currentLeaseLine,
                    gap: ''
                });
            }
        } else {
            // First range
            ranges.push({
                start: currentTimeStr,
                duration: '00:00:00',
                end: currentTimeStr,
                leaseLine: currentLeaseLine,
                gap: ''
            });
        }

        const serializedLines = serializeRanges(ranges);
        const newFileContent = serializedLines.length > 0 ? serializedLines.join(EOL) + EOL : '';
        await fs.writeFile(RANGE_TXT_PATH, newFileContent, FILE_ENCODING);

        const lastLine = serializedLines[serializedLines.length - 1];
        console.log(`[${new Date().toISOString()}] Updated range: ${lastLine}`);
    } catch (fsError) {
        console.error(`Error writing to file: ${fsError.message}`);
    }
}

async function main() {
    while (true) {
        await runProbe();

        const now = new Date();
        const ms = now.getTime();
        const nextTick = Math.ceil(ms / ONE_MINUTE_MS) * ONE_MINUTE_MS;
        const delay = nextTick - ms;

        console.log(`Next execution scheduled in ${Math.round(delay / 1000)} seconds (at ${new Date(nextTick).toLocaleTimeString()}).`);
        await sleep(delay);
    }
}

main();
