import { execFileSync, spawn } from "node:child_process";
import { closeSync, existsSync, openSync, writeSync } from "node:fs";
import path from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

const worktreeArgument = argument("--worktree");
const logArgument = argument("--log");
const worktreePath = worktreeArgument ? path.resolve(worktreeArgument) : "";
const port = Number(argument("--port"));
const logPath = logArgument ? path.resolve(logArgument) : "";
if (!worktreePath || !Number.isInteger(port) || port < 3000 || port > 3999 || !logPath) {
  throw new Error("Invalid local preview runner arguments.");
}

const logFd = openSync(logPath, "a");

try {
  if (!existsSync(path.join(worktreePath, "node_modules"))) {
    const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npm.cmd", "ci", "--ignore-scripts", "--prefer-offline", "--no-audit", "--no-fund"]
      : ["ci", "--ignore-scripts", "--prefer-offline", "--no-audit", "--no-fund"];
    execFileSync(command, args, { cwd: worktreePath, windowsHide: true, stdio: ["ignore", logFd, logFd], timeout: 10 * 60 * 1000 });
  }

  const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd", "run", "dev", "--", "--port", String(port)]
    : ["run", "dev", "--", "--port", String(port)];
  const child = spawn(command, args, { cwd: worktreePath, windowsHide: true, stdio: ["ignore", logFd, logFd] });
  const stop = () => {
    try { child.kill("SIGTERM"); } catch { /* process may already be gone */ }
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  const exitCode = await new Promise((resolve) => {
    child.once("exit", (code) => resolve(code ?? 1));
    child.once("error", () => resolve(1));
  });
  process.exitCode = Number(exitCode);
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  const buffer = Buffer.from(`[${new Date().toISOString()}] ${message}\n`, "utf8");
  writeSync(logFd, buffer);
  process.exitCode = 1;
} finally {
  closeSync(logFd);
}
