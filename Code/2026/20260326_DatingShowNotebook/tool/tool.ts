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
  } else if (action === 'check') {
    await handleCheck();
  } else {
    console.error(`Unknown action: ${action}`);
    process.exit(1);
  }
}

// ... (other handlers)

async function handleCheck() {
  console.log('~~ Starting comprehensive verification...');
  let failed = false;

  const steps = [
    { name: 'format', cmd: 'npm run format' },
    { name: 'lint', cmd: 'npm run lint' },
    { name: 'test', cmd: 'npm test' },
  ];

  for (const step of steps) {
    try {
      console.log(`~~ Running ${step.name}...`);
      await runCommand(step.cmd, baseDir, `check_${step.name}`);
    } catch (_e) {
      console.error(`~~ ${step.name} failed.`);
      failed = true;
    }
  }

  if (failed) {
    console.error('~~ Verification completed with errors.');
    process.exit(1);
  } else {
    console.log('~~ All checks passed!');
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
  console.log('~~ Spawning Unified SSR Server (Port 3762)...');
  process.env.DSN_RESTRICTED_ROOT = dataFolder;
  process.env.DSN_WORK_FOLDER = workFolder;
  spawnCommand(`npm run dev`, baseDir, 'DSN_Server');

  console.log('~~ SSR Server launched.');
  console.log('~~ Access the UI at: http://localhost:3762/');
}

async function handleKill() {
  console.log('~~ Initiating shutdown sequence...');

  // Call Unified Server shutdown/quit
  try {
    console.log('~~ Requesting Server termination (GET :3762/quit)...');
    await httpRequest('http://localhost:3762/quit', 'GET');
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

  const logFile = `${cmdFile}.log`;
  let stopped = false;
  let exitCode = 0;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const updateTitle = () => {
    spawn('cmd.exe', ['/c', 'title', title]);
  };

  // Fiber #1: Process Runner
  const runner = async () => {
    return new Promise<void>((resolve) => {
      // Open log file for writing
      const logStream = fs.createWriteStream(logFile, { flags: 'w' });

      // Spawn process without shell redirection
      const proc = spawn('cmd.exe', ['/c', cmdFile], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout.pipe(logStream);
      proc.stderr.pipe(logStream);

      proc.on('close', (code) => {
        exitCode = code || 0;
        stopped = true;
        logStream.end(() => {
          resolve();
        });
      });

      proc.on('error', (err) => {
        console.error(`~~ Runner error: ${err.message}`);
        stopped = true;
        logStream.end(() => {
          resolve();
        });
      });
    });
  };

  // Fiber #2: Title Updater
  const titleUpdater = async () => {
    while (!stopped) {
      updateTitle();
      await sleep(1000);
    }
  };

  // Fiber #3: Log Tailer
  const logTailer = async () => {
    let lastReadIndex = 0;
    while (true) {
      if (fs.existsSync(logFile)) {
        try {
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.split(/\r?\n/);
          let newLines: string[] = [];

          if (!stopped) {
            if (lines.length > 1) {
              newLines = lines.slice(lastReadIndex, -1);
            }
          } else {
            newLines = lines.slice(lastReadIndex);
          }

          if (newLines.length > 0) {
            for (const line of newLines) {
              process.stdout.write(line + '\n');
            }
            lastReadIndex += newLines.length;
          }
        } catch (_e) {
          // Ignore read errors
        }
      }

      if (stopped) break;
      await sleep(100);
    }
  };

  await Promise.all([runner(), titleUpdater(), logTailer()]);
  process.exit(exitCode);
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
