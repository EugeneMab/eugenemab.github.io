import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as http from 'http';
import os from 'os';

const action = process.argv[2];
const baseDir = process.cwd();

// These will be initialized in main() for non-follow actions
let workFolder: string = '';
let dataFolder: string | undefined;

async function main() {
  if (action === 'follow') {
    await handleFollow();
    return;
  }

  const workFolderInput =
    process.argv[3] ||
    process.env.TEMP ||
    process.env.TMPDIR ||
    process.env.TMP ||
    os.tmpdir() ||
    '';
  const dataFolderInput = process.argv[4];

  if (!action || !workFolderInput) {
    console.error('Usage: npx tsx tool/tool.ts <start|kill> <workFolder> [dataFolder]');
    console.error('       npx tsx tool/tool.ts follow <title> <cmdFile>');
    process.exit(1);
  }

  workFolder = path.resolve(workFolderInput);
  dataFolder = dataFolderInput ? path.resolve(dataFolderInput) : undefined;

  console.log(`~~ Action: ${action.toUpperCase()}`);
  console.log(`~~ Work Folder: ${workFolder}`);
  if (dataFolder) {
    console.log(`~~ Data Folder: ${dataFolder}`);
  }

  // Ensure work folder exists
  if (!fs.existsSync(workFolder)) {
    console.log(`~~ Creating work folder: ${workFolder}`);
    fs.mkdirSync(workFolder, { recursive: true });
  }

  if (action === 'start') {
    console.log(`~~ Killing previous services`);
    await handleKill();
    console.log(`~~ Starting new services`);
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
    console.log('~~ Root dependencies missing. Installing...');
    await runCommand('npm install', baseDir, 'install_root');
    console.log('~~ Root dependencies installed successfully.');
  } else {
    console.log('~~ Root node_modules found. Skipping install.');
  }

  // Start Unified SSR Server
  console.log('~~ Spawning Unified SSR Server (Port 13762)...');
  process.env.DSN_RESTRICTED_ROOT = dataFolder;
  process.env.DSN_WORK_FOLDER = workFolder;
  spawnCommand(`npm run dev`, baseDir, 'DSN_Server');

  console.log('~~ SSR Server launched.');
  console.log('~~ Access the UI at: http://localhost:13762/');
}

async function handleKill() {
  console.log('~~ Initiating shutdown sequence...');

  // Call Unified Server shutdown/quit
  try {
    console.log('~~ Requesting Server termination (GET :13762/quit)...');
    await httpRequest('http://localhost:13762/quit', 'GET');
    console.log('~~ Server termination request sent.');
  } catch (_e) {
    console.log('~~ Server unreachable or already stopped.');
  }

  console.log('~~ Cleanup complete.');
}

async function handleFollow() {
  const title = process.argv[3];
  const cmdFile = process.argv[4];
  if (!title || !cmdFile) {
    process.exit(1);
  }

  const updateTitle = () => {
    // Only use standard title command, no ANSI escape sequences
    spawn('cmd.exe', ['/c', 'title', title]);
  };

  updateTitle();
  const interval = setInterval(updateTitle, 1000);

  const proc = spawn('cmd.exe', ['/c', cmdFile], { stdio: 'inherit' });
  proc.on('close', (code) => {
    clearInterval(interval);
    process.exit(code || 0);
  });
}

function runCommand(cmd: string, cwd: string, name: string): Promise<void> {
  const cmdFile = path.join(workFolder, `${name}.cmd`);
  fs.writeFileSync(cmdFile, `cd /d "${cwd}"\r\n${cmd}`);

  return new Promise((resolve, reject) => {
    const proc = spawn('cmd.exe', ['/c', cmdFile], { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command ${name} failed with code ${code}`));
      }
    });
  });
}

function spawnCommand(cmd: string, cwd: string, name: string) {
  // 1. The actual payload script
  const payloadFile = path.join(workFolder, `${name}_payload.cmd`);
  fs.writeFileSync(payloadFile, `cd /d "${cwd}"\r\n${cmd}`);

  // 2. The follow script that manages the window title
  const followFile = path.join(workFolder, `${name}_follow.cmd`);
  const followCmd = `npx tsx "${path.join(baseDir, 'tool', 'tool.ts')}" follow "${name}" "${payloadFile}"`;
  fs.writeFileSync(followFile, `cd /d "${baseDir}"\r\n${followCmd}`);

  // 3. The launch script that uses 'start /min'
  const launchFile = path.join(workFolder, `${name}_launch.cmd`);
  const startCmd = `start /min cmd.exe /c "${followFile}"`;
  fs.writeFileSync(launchFile, `${startCmd}`);

  // Execute the launch script
  spawn('cmd.exe', ['/c', launchFile], { detached: true, stdio: 'ignore' }).unref();
}

function httpRequest(url: string, method: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      method: method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
    };
    const req = http.request(options, (res) => {
      res.on('data', () => {
        return;
      });
      res.on('end', () => {
        return resolve();
      });
    });
    req.on('error', (e) => {
      return reject(e);
    });
    req.end();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
