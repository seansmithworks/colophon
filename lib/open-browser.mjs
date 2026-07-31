// Launches the platform default browser at a URL. Zero dependencies: shells
// out to the OS-native opener instead of pulling in a package for this.
import { spawn } from "node:child_process";

export function openBrowser(url) {
  const platform = process.platform;
  let command;
  let args;
  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else {
    command = "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.unref();
  } catch {
    // Non-fatal: the URL is already printed for the user to open manually.
  }
}
