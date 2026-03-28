import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as http from 'http';

const action = process.argv[2];
const workFolderInput = process.argv[3];
const dataFolderInput = process.argv[4];

if (!action || !workFolderInput) {
  console.error('Usage: npx tsx tool/tool.ts <start|kill> <workFolder> [dataFolder]');
  process.exit(1);
}

const baseDir = process.cwd();
const workFolder = path.resolve(workFolderInput);
const dataFolder = dataFolderInput ? path.resolve(dataFolderInput) : undefined;

async function main() {
  // Ensure work folder exists
  if (!fs.existsSync(workFolder)) {
    fs.mkdirSync(workFolder, { recursive: true });
  }

  if (action === 'start') {
    await handleStart();
  } else if (action === 'kill') {
    await handleKill();
  } else {
    console.error(`Unknown action: ${action}`);
    process.exit(1);
  }
}

async function handleStart() {
  if (!dataFolder) {
    console.error('Data folder required for start');
    process.exit(1);
  }

  // Install dependencies if needed
  if (!fs.existsSync(path.join(baseDir, 'node_modules'))) {
    console.log('Installing root dependencies...');
    await runCommand('npm install', baseDir, 'install_root');
  }

  if (!fs.existsSync(path.join(baseDir, 'frontend', 'node_modules'))) {
    console.log('Installing frontend dependencies...');
    await runCommand('npm install', path.join(baseDir, 'frontend'), 'install_frontend');
  }

  // Start Backend
  console.log('Starting Backend...');
  spawnCommand(`npx tsx index.ts "${dataFolder}"`, path.join(baseDir, 'backend'), 'DSN_Backend');

  // Start Frontend
  console.log('Starting Frontend...');
  spawnCommand('npx vite', path.join(baseDir, 'frontend'), 'DSN_Frontend');
}

async function handleKill() {
  console.log('Stopping Dating Show Notebook...');
  
  // Call Backend shutdown
  try {
    await httpRequest('http://localhost:13762/api/shutdown', 'POST');
    console.log('Backend shutdown requested.');
  } catch (e) {
    console.log('Backend shutdown failed or already stopped.');
  }

  // Call Frontend quit
  try {
    await httpRequest('http://localhost:3762/quit', 'GET');
    console.log('Frontend quit requested.');
  } catch (e) {
    console.log('Frontend quit failed or already stopped.');
  }
}

function runCommand(cmd: string, cwd: string, name: string): Promise<void> {
  const cmdFile = path.join(workFolder, `${name}.cmd`);
  fs.writeFileSync(cmdFile, `@echo off\ncd /d "${cwd}"\n${cmd}`);
  
  return new Promise((resolve, reject) => {
    const proc = spawn('cmd.exe', ['/c', cmdFile], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${name} failed with code ${code}`));
    });
  });
}

function spawnCommand(cmd: string, cwd: string, name: string) {
  const cmdFile = path.join(workFolder, `${name}.cmd`);
  fs.writeFileSync(cmdFile, `@echo off\ncd /d "${cwd}"\n${cmd}`);
  
  // Using 'start' to run in a separate window and keep it open
  const startCmd = `start /min "${name}" cmd.exe /c "${cmdFile}"`;
  const startCmdFile = path.join(workFolder, `run_${name}.cmd`);
  fs.writeFileSync(startCmdFile, `@echo off\n${startCmd}`);

  spawn('cmd.exe', ['/c', startCmdFile], { detached: true, stdio: 'ignore' }).unref();
}

function httpRequest(url: string, method: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      method: method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname
    };
    const req = http.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', (e) => reject(e));
    req.end();
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
