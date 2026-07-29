import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptsDirectory, '..', '..', 'frontend');

if (!existsSync(path.join(frontendDirectory, 'package.json'))) {
  throw new Error(`Frontend package not found at ${frontendDirectory}`);
}

const npmCli = process.env.npm_execpath;

if (!npmCli || !existsSync(npmCli)) {
  throw new Error('Unable to locate npm. Run this script with npm run frontend:build.');
}

const result = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  cwd: frontendDirectory,
  env: {
    ...process.env,
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || '/api',
  },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
