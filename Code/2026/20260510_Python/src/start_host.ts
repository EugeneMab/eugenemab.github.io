import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const titler = spawn("cmd.exe", ["/c", "titler.cmd"], { stdio: "inherit" });
const server = spawn("cmd.exe", ["/c", "start_internal.cmd"], {
  stdio: "inherit",
});

console.log(
  `[Host] Started Titler (PID: ${titler.pid}) and Server (PID: ${server.pid})`,
);

let exiting = false;

async function killAll() {
  if (exiting) return;
  exiting = true;
  console.log("[Host] Shutdown signal received. Cleaning up process trees...");

  try {
    const tasks = [];
    if (titler.pid) {
      console.log(`[Host] Killing titler tree (PID: ${titler.pid})...`);
      tasks.push(
        execAsync(`taskkill /F /T /PID ${titler.pid}`).catch(() => {}),
      );
    }
    if (server.pid) {
      console.log(`[Host] Killing server tree (PID: ${server.pid})...`);
      tasks.push(
        execAsync(`taskkill /F /T /PID ${server.pid}`).catch(() => {}),
      );
    }

    await Promise.all(tasks);
    console.log("[Host] All process trees terminated. Exiting.");
  } catch (err) {
    console.error("[Host] Error during cleanup:", err);
  } finally {
    process.exit(0);
  }
}

titler.on("exit", (code) => {
  console.log(`[Host] Titler process exited (Code: ${code})`);
  killAll();
});

server.on("exit", (code) => {
  console.log(`[Host] Server process exited (Code: ${code})`);
  killAll();
});

// Handle termination signals
process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);
