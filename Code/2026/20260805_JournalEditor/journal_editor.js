#!/usr/bin/env node

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

function renderScreen(lines, focusIndex, width, height) {
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

  console.log('Controls: [q]: quit | [Up Arrow]: move up | [Down Arrow]: move down | [Ctrl+Up]: line up | [Ctrl+Down]: line down | [u]: undo | [r]: redo | [l]: reload');
}

function findRegions(lines) {
  let doneIndex = -1;
  let doingIndex = -1;
  let todoIndex = -1;

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

  if (doneIndex !== -1 && doingIndex !== -1 && doneIndex > doingIndex) {
    throw new Error(`Invalid section order: DONE section at line ${doneIndex + 1} comes after DOING section at line ${doingIndex + 1}`);
  }
  if (doingIndex !== -1 && todoIndex !== -1 && doingIndex > todoIndex) {
    throw new Error(`Invalid section order: DOING section at line ${doingIndex + 1} comes after TODO section at line ${todoIndex + 1}`);
  }
  if (doneIndex !== -1 && todoIndex !== -1 && doneIndex > todoIndex) {
    throw new Error(`Invalid section order: DONE section at line ${doneIndex + 1} comes after TODO section at line ${todoIndex + 1}`);
  }

  return { doneIndex, doingIndex, todoIndex };
}

function saveState(lines, undoStack, redoStack) {
  undoStack.push([...lines]);
  redoStack.length = 0;
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
  let focusIndex = 0;
  if (todoIndex !== -1 && todoIndex + 1 < lines.length) {
    focusIndex = todoIndex + 1;
  } else if (todoIndex !== -1) {
    focusIndex = todoIndex;
  }

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
