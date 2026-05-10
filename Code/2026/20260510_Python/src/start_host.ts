import { spawn } from 'child_process';

const titler = spawn('cmd.exe', ['/c', 'titler.cmd'], { stdio: 'inherit' });
const server = spawn('cmd.exe', ['/c', 'start_internal.cmd'], { stdio: 'inherit' });

console.log(`[Host] Started Titler (PID: ${titler.pid}) and Server (PID: ${server.pid})`);

let exiting = false;

function killAll() {
    if (exiting) return;
    exiting = true;
    console.log('[Host] One process exited, shutting down all...');
    titler.kill();
    server.kill();
    process.exit();
}

titler.on('exit', killAll);
server.on('exit', killAll);

// Handle host termination
process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
