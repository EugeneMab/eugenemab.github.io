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
  const half = Math.floor(height / 2);
  const startLine = Math.max(0, focusIndex - half);
  const endLine = Math.min(lines.length - 1, focusIndex + half);

  for (let i = startLine; i <= endLine; i++) {
    const prefix = (i === focusIndex) ? '> ' : '  ';
    const contentWidth = Math.max(0, width - prefix.length);
    const lineText = lines[i] || '';
    const formatted = prefix + formatLine(lineText, contentWidth);
    console.log(formatted);
  }

  console.log(formatLine('Controls: [^/Up Arrow]: move up | [v/Down Arrow]: move down | [q]: quit', width));
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

  const fileContent = await fs.readFile(filePath, 'utf8');
  let lines = fileContent.split(/\r?\n/);

  let todoIndex = lines.findIndex(line => line.trim() === 'TODO');
  let focusIndex = 0;
  if (todoIndex !== -1 && todoIndex + 1 < lines.length) {
    focusIndex = todoIndex + 1;
  } else if (todoIndex !== -1) {
    focusIndex = todoIndex;
  }

  let running = true;

  while (running) {
    renderScreen(lines, focusIndex, width, height);

    const { str, key } = await getNextKey();
    let changed = false;

    if (key.name === 'up' || str === '^' || key.name === 'k') {
      if (focusIndex > 0) {
        focusIndex--;
        changed = true;
      }
    } else if (key.name === 'down' || str === 'v' || str === 'V' || key.name === 'j') {
      if (focusIndex < lines.length - 1) {
        focusIndex++;
        changed = true;
      }
    } else if (str === 'q' || str === 'Q' || (key.ctrl && key.name === 'c')) {
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
