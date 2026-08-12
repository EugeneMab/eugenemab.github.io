const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');

// Persistent keypress event queue and listener setup
const keyQueue = [];
let pendingResolver = null;

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  const event = { str, key: key || {} };
  if (pendingResolver) {
    const resolve = pendingResolver;
    pendingResolver = null;
    resolve(event);
  } else {
    keyQueue.push(event);
  }
});

function getNextKey() {
  if (keyQueue.length > 0) {
    return Promise.resolve(keyQueue.shift());
  }
  return new Promise((resolve) => {
    pendingResolver = resolve;
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let width = 80;
  let height = 25;

  if (args.length >= 1 && !isNaN(parseInt(args[0], 10))) {
    width = parseInt(args[0], 10);
  }
  if (args.length >= 2 && !isNaN(parseInt(args[1], 10))) {
    height = parseInt(args[1], 10);
  }

  return { width, height };
}

function formatLine(line, maxWidth) {
  if (line.length <= maxWidth) {
    return line;
  }
  if (maxWidth <= 3) {
    return line.slice(0, maxWidth);
  }
  return line.slice(0, maxWidth - 3) + '...';
}

function renderScreen(lines, focusIndex, width, height, modeInfo = null) {
  console.log();
  console.log('_'.repeat(2 + width + 3));

  const totalLines = lines.length;
  let startLine, endLine;

  if (totalLines <= height) {
    startLine = 0;
    endLine = totalLines - 1;
  } else {
    const half = Math.floor(height / 2);
    startLine = focusIndex - half;
    endLine = startLine + height - 1;

    if (startLine < 0) {
      startLine = 0;
      endLine = height - 1;
    } else if (endLine >= totalLines) {
      endLine = totalLines - 1;
      startLine = totalLines - height;
    }
  }

  for (let i = startLine; i <= endLine; i++) {
    const prefix = (i === focusIndex) ? '> ' : '  ';
    const contentWidth = Math.max(0, width - prefix.length);
    const lineText = lines[i] || '';
    const formatted = prefix + formatLine(lineText, contentWidth);
    console.log(formatted);
  }

  if (modeInfo) {
    console.log(modeInfo.title);
    console.log(modeInfo.status);
    process.stdout.write(modeInfo.currentStr);
  } else {
    const controls = [
      'Controls: [q]: quit',
      '[Up Arrow]: move up',
      '[Down Arrow]: move down',
      '[Ctrl+Up]: line up',
      '[Ctrl+Down]: line down',
      '[d/i/t]: move region',
      '[a]: edit amount',
      '[f]: find',
      '[s]: start item',
      '[e]: end item',
      '[o]: organize',
      '[u]: undo',
      '[r]: redo',
      '[l]: reload'
    ];
    console.log(controls.join(' | '));
  }
}

function parseFormattedAmount(inputStr) {
  const clean = inputStr.trim().replace(/,/g, '');
  if (!clean) return '0.00';

  // allow optional leading minus sign
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;

  const num = Number(clean);
  if (isNaN(num)) return null;

  const parts = Math.abs(num).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const formatted = parts.join('.');
  return num < 0 ? '-' + formatted : formatted;
}

function findNextMatchedLine(lines, currentLineIndex, searchStr) {
  if (!searchStr) return -1;
  const total = lines.length;
  const lowerSearch = searchStr.toLowerCase();
  for (let step = 1; step <= total; step++) {
    const idx = (currentLineIndex + step) % total;
    if (lines[idx].toLowerCase().includes(lowerSearch)) {
      return idx;
    }
  }
  return -1;
}

function findRegions(lines) {
  let doneIndex = -1;
  let doingIndex = -1;
  let todoIndex = -1;
  let todoEndIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'DONE') {
      doneIndex = i;
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'TODO') {
      todoIndex = i;
      break;
    }
  }

  if (doneIndex !== -1) {
    for (let i = doneIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        doingIndex = i;
        break;
      }
    }
  }

  if (todoIndex !== -1) {
    for (let i = todoIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        todoEndIndex = i;
        break;
      }
    }
  }

  // Validate presence and ordering of essential sections
  if (doneIndex === -1) {
    throw new Error('Invalid journal format: DONE section header missing.');
  }
  if (doingIndex === -1) {
    throw new Error('Invalid journal format: DOING section (first empty line after DONE) missing.');
  }
  if (todoIndex === -1) {
    throw new Error('Invalid journal format: TODO section header missing.');
  }
  if (todoEndIndex === -1) {
    throw new Error('Invalid journal format: TODO end line (first empty line after TODO) missing.');
  }

  if (doneIndex > doingIndex) {
    throw new Error(`Invalid section order: DONE section at line ${doneIndex + 1} comes after DOING section at line ${doingIndex + 1}`);
  }
  if (doingIndex > todoIndex) {
    throw new Error(`Invalid section order: DOING section at line ${doingIndex + 1} comes after TODO section at line ${todoIndex + 1}`);
  }
  if (doneIndex > todoIndex) {
    throw new Error(`Invalid section order: DONE section at line ${doneIndex + 1} comes after TODO section at line ${todoIndex + 1}`);
  }
  if (todoIndex > todoEndIndex) {
    throw new Error(`Invalid section order: TODO section at line ${todoIndex + 1} comes after TODO end line at line ${todoEndIndex + 1}`);
  }

  return { doneIndex, doingIndex, todoIndex, todoEndIndex };
}

function calculateNextDate(dateStr, intervalStr) {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10); // 1-indexed
  let day = parseInt(dayStr, 10);
  const interval = parseInt(intervalStr, 10);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (interval === 30) {
    if (day > 28) {
      throw new Error(`Cannot add 1 month (30 days interval) to date with day > 28: ${dateStr}`);
    }
    date.setUTCMonth(date.getUTCMonth() + 1);
  } else if (interval > 0 && interval % 365 === 0) {
    const yearsToAdd = interval / 365;
    if (month === 2 && day === 29) {
      throw new Error(`Cannot add year interval (${interval} days = ${yearsToAdd} years) to leap day Feb 29: ${dateStr}`);
    }
    date.setUTCFullYear(date.getUTCFullYear() + yearsToAdd);
  } else if (interval > 0) {
    date.setUTCDate(date.getUTCDate() + interval);
  }

  const nextYear = String(date.getUTCFullYear()).padStart(4, '0');
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function generateNextOccurrenceLine(line) {
  const regex = /^\s*@(\d{4}-\d{2}-\d{2})(?:\s+(\d+))?/;
  const match = line.match(regex);

  if (!match) {
    throw new Error(`Invalid item format: Line does not start with '@YYYY-MM-DD': "${line}"`);
  }

  const dateStr = match[1];
  const intervalStr = match[2];

  const atPos = line.indexOf('@');
  const dateStartPos = atPos + 1;

  if (!intervalStr) {
    const dateEndPos = dateStartPos + dateStr.length;
    return line.slice(0, dateEndPos) + ' ???? ' + line.slice(dateEndPos);
  }

  const nextDateStr = calculateNextDate(dateStr, intervalStr);
  return line.slice(0, dateStartPos) + nextDateStr + line.slice(dateStartPos + dateStr.length);
}

function saveState(lines, undoStack, redoStack) {
  undoStack.push([...lines]);
  redoStack.length = 0;
}

async function loadFile(filePath) {
  const fileContent = await fs.readFile(filePath, 'utf8');
  return fileContent.split(/\r?\n/);
}

async function handleAmountEditMode(lines, focusIndex, width, height, undoStack, redoStack, filePath) {
  let currentStr = '';
  while (true) {
    const formatted = parseFormattedAmount(currentStr);
    const statusStr = formatted !== null ? formatted : 'INVALID NUMBER';
    const modeInfo = {
      title: 'A editing mode controls: [Space - ~]: append char | [Enter]: accept | [ESC]: cancel | [Backspace]: delete char',
      status: statusStr,
      currentStr: currentStr
    };
    renderScreen(lines, focusIndex, width, height, modeInfo);

    const { str, key } = await getNextKey();

    if (key.name === 'escape') {
      return { changed: false };
    } else if (key.name === 'return' || key.name === 'enter') {
      if (formatted !== null) {
        const amtRegex = /\$(\s*)(\d{1,3}(?:,\d{3})*\.\d{2}|[ \t]+)?\s/;
        const line = lines[focusIndex];
        const match = line.match(amtRegex);
        if (match) {
          const origAmt = match[2] || match[1] || '';
          const origWidth = match[0].length - 2;
          const rightAligned = formatted.padStart(origWidth, ' ');
          const rest = line.slice(match.index + match[0].length);
          const newLine = line.slice(0, match.index) + '$' + rightAligned + ' ' + rest;
          saveState(lines, undoStack, redoStack);
          lines[focusIndex] = newLine;
          return { changed: true };
        }
      }
      return { changed: false };
    } else if (key.name === 'backspace') {
      if (currentStr.length > 0) {
        currentStr = currentStr.slice(0, -1);
      }
    } else if (str && str.length === 1 && str >= ' ' && str <= '~') {
      currentStr += str;
    }
  }
}

async function handleFindEditMode(lines, focusIndex, width, height) {
  const originalFocusIndex = focusIndex;
  let currentFocusIndex = focusIndex;
  let currentStr = '';
  let currentlyFoundIndex = -1;

  while (true) {
    const statusStr = currentlyFoundIndex !== -1 ? 'FOUND' : 'NOT FOUND';
    const modeInfo = {
      title: 'F editing mode controls: [Space - ~]: append char | [TAB]: find next | [Enter]: accept | [ESC]: cancel | [Backspace]: delete char',
      status: statusStr,
      currentStr: currentStr
    };
    renderScreen(lines, currentFocusIndex, width, height, modeInfo);

    const { str, key } = await getNextKey();

    if (key.name === 'escape') {
      return { focusIndex: originalFocusIndex };
    } else if (key.name === 'return' || key.name === 'enter') {
      return { focusIndex: currentFocusIndex };
    } else if (key.name === 'tab') {
      if (currentStr.length > 0) {
        const matched = findNextMatchedLine(lines, currentFocusIndex, currentStr);
        if (matched !== -1) {
          currentlyFoundIndex = matched;
          currentFocusIndex = matched;
        }
      }
    } else if (key.name === 'backspace') {
      if (currentStr.length > 0) {
        currentStr = currentStr.slice(0, -1);
        if (currentStr.length > 0) {
          const lowerStr = currentStr.toLowerCase();
          if (lines[originalFocusIndex].toLowerCase().includes(lowerStr)) {
            currentlyFoundIndex = originalFocusIndex;
            currentFocusIndex = originalFocusIndex;
          } else {
            const matched = findNextMatchedLine(lines, originalFocusIndex, currentStr);
            if (matched !== -1) {
              currentlyFoundIndex = matched;
              currentFocusIndex = matched;
            } else {
              currentlyFoundIndex = -1;
              currentFocusIndex = originalFocusIndex;
            }
          }
        } else {
          currentlyFoundIndex = -1;
          currentFocusIndex = originalFocusIndex;
        }
      }
    } else if (str && str.length === 1 && str >= ' ' && str <= '~') {
      currentStr += str;
      const lowerStr = currentStr.toLowerCase();
      if (lines[currentFocusIndex].toLowerCase().includes(lowerStr)) {
        currentlyFoundIndex = currentFocusIndex;
      } else {
        const matched = findNextMatchedLine(lines, currentFocusIndex, currentStr);
        if (matched !== -1) {
          currentlyFoundIndex = matched;
          currentFocusIndex = matched;
        } else {
          currentlyFoundIndex = -1;
        }
      }
    }
  }
}

async function loadFile(filePath) {
  const fileContent = await fs.readFile(filePath, 'utf8');
  return fileContent.split(/\r?\n/);
}

async function main() {
  const { width, height } = parseArgs();

  const now = new Date();
  const currentYear = now.getFullYear();
  const journalDir = 'C:\\D\\Personal\\2026\\MabSurface';
  const journalFileName = `Home.${currentYear}.mabsurface.txt`;
  const filePath = path.join(journalDir, journalFileName);

  console.log(`Local Date: ${now.toLocaleString()}`);
  console.log(`Journal File: ${filePath}`);
  console.log(`Effective size: width = ${width}, height = ${height}`);

  if (!fsSync.existsSync(filePath)) {
    console.error(`Error: Journal file not found at ${filePath}`);
    process.exit(1);
  }

  let lines = await loadFile(filePath);

  const undoStack = [];
  const redoStack = [];

  let { todoIndex } = findRegions(lines);
  let focusIndex = todoIndex + 1;

  let running = true;

  while (running) {
    const regions = findRegions(lines);

    renderScreen(lines, focusIndex, width, height);

    const { str, key } = await getNextKey();
    let changed = false;

    if (key.ctrl && key.name === 'up') {
      if (focusIndex > 0) {
        saveState(lines, undoStack, redoStack);
        const temp = lines[focusIndex];
        lines[focusIndex] = lines[focusIndex - 1];
        lines[focusIndex - 1] = temp;
        focusIndex--;
        changed = true;
      }
    } else if (key.ctrl && key.name === 'down') {
      if (focusIndex < lines.length - 1) {
        saveState(lines, undoStack, redoStack);
        const temp = lines[focusIndex];
        lines[focusIndex] = lines[focusIndex + 1];
        lines[focusIndex + 1] = temp;
        focusIndex++;
        changed = true;
      }
    } else if (key.name === 'up') {
      if (focusIndex > 0) {
        focusIndex--;
      }
    } else if (key.name === 'down') {
      if (focusIndex < lines.length - 1) {
        focusIndex++;
      }
    } else if (str === 'd') {
      focusIndex = regions.doingIndex - 1;
    } else if (str === 'i') {
      focusIndex = regions.doingIndex + 1;
    } else if (str === 't') {
      focusIndex = regions.todoIndex + 1;
    } else if (str === 'a') {
      const res = await handleAmountEditMode(lines, focusIndex, width, height, undoStack, redoStack, filePath);
      if (res.changed) {
        changed = true;
      }
    } else if (str === 'f') {
      const res = await handleFindEditMode(lines, focusIndex, width, height);
      focusIndex = res.focusIndex;
    } else if (str === 's') {
      if (focusIndex > regions.todoIndex && focusIndex < regions.todoEndIndex) {
        saveState(lines, undoStack, redoStack);
        const originalLine = lines[focusIndex];

        const nextOccurrenceLine = generateNextOccurrenceLine(originalLine);

        lines.splice(focusIndex, 1);

        const currentRegions = findRegions(lines);
        const insertInProgressIndex = currentRegions.doingIndex + 1;
        lines.splice(insertInProgressIndex, 0, originalLine);

        const freshRegions = findRegions(lines);
        lines.splice(freshRegions.todoEndIndex, 0, nextOccurrenceLine);

        const finalRegions = findRegions(lines);
        const start = finalRegions.todoIndex + 1;
        const count = finalRegions.todoEndIndex - start;
        const todoLines = lines.slice(start, finalRegions.todoEndIndex);
        todoLines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        lines.splice(start, count, ...todoLines);

        focusIndex++;
        changed = true;
      }
    } else if (str === 'e') {
      if (focusIndex > regions.doingIndex && focusIndex < regions.todoIndex) {
        // In-progress region: current action
        saveState(lines, undoStack, redoStack);
        const [movedLine] = lines.splice(focusIndex, 1);
        const isNonRecordable = movedLine.trim().endsWith('-');

        if (!isNonRecordable) {
          const targetDoneEndIndex = regions.doingIndex;
          lines.splice(targetDoneEndIndex, 0, movedLine);
          focusIndex++;
        }
        changed = true;
      } else if (focusIndex > regions.todoIndex && focusIndex < regions.todoEndIndex) {
        // To-do region: combo of 's' and 'e' operations
        saveState(lines, undoStack, redoStack);

        const originalLine = lines[focusIndex];
        const nextOccurrenceLine = generateNextOccurrenceLine(originalLine);
        const isNonRecordable = originalLine.trim().endsWith('-');

        const targetRelIndex = focusIndex - regions.todoIndex;

        // 1) Remove focused item from TODO region
        lines.splice(focusIndex, 1);

        // 2) If recordable, append originalLine to DONE section (at regions.doingIndex)
        if (!isNonRecordable) {
          const r1 = findRegions(lines);
          lines.splice(r1.doingIndex, 0, originalLine);
        }

        // 3) Append next occurrence line to TODO section and sort TODO region
        const r2 = findRegions(lines);
        lines.splice(r2.todoEndIndex, 0, nextOccurrenceLine);

        const r3 = findRegions(lines);
        const start = r3.todoIndex + 1;
        const count = r3.todoEndIndex - start;
        const todoLines = lines.slice(start, r3.todoEndIndex);
        todoLines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        lines.splice(start, count, ...todoLines);

        // 4) Set focusIndex directly using calculated relative index from updated todoIndex
        const rFinal = findRegions(lines);
        focusIndex = rFinal.todoIndex + targetRelIndex;

        changed = true;
      }
    } else if (str === 'o') {
      const start = regions.todoIndex + 1;
      const count = regions.todoEndIndex - start;
      if (count > 1) {
        saveState(lines, undoStack, redoStack);
        const todoLines = lines.slice(start, regions.todoEndIndex);
        todoLines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        lines.splice(start, count, ...todoLines);
        changed = true;
      }
    } else if (str === 'u') {
      if (undoStack.length > 0) {
        redoStack.push([...lines]);
        lines = undoStack.pop();
        if (focusIndex >= lines.length) {
          focusIndex = lines.length - 1;
        }
        changed = true;
      }
    } else if (str === 'r') {
      if (redoStack.length > 0) {
        undoStack.push([...lines]);
        lines = redoStack.pop();
        if (focusIndex >= lines.length) {
          focusIndex = lines.length - 1;
        }
        changed = true;
      }
    } else if (str === 'l') {
      saveState(lines, undoStack, redoStack);
      lines = await loadFile(filePath);
      if (focusIndex >= lines.length) {
        focusIndex = lines.length - 1;
      }
    } else if (str === 'q' || (key.ctrl && key.name === 'c')) {
      running = false;
      break;
    }

    if (changed) {
      await fs.writeFile(filePath, lines.join('\r\n'), 'utf8');
    }
  }

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
