import { execFile } from 'node:child_process';

export function herdrBin(env = process.env) {
  return env.HERDR_BIN_PATH || 'herdr';
}

/** Runs a herdr CLI command and resolves its JSON output, or null when herdr is missing, slow or says something else. */
export function runHerdr(bin, args, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: timeoutMs }, (error, stdout) => {
      if (error) return resolve(null);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
  });
}
