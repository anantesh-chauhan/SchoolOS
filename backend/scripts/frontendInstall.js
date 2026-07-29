import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptsDirectory, '..', '..', 'frontend');
const packageLock = path.join(frontendDirectory, 'package-lock.json');

if (!existsSync(packageLock)) {
  throw new Error(
    `Frontend package lock not found at ${packageLock}. On Render, leave Root Directory empty so the build can access both backend and frontend.`,
  );
}

const npmCli = process.env.npm_execpath;

if (!npmCli || !existsSync(npmCli)) {
  throw new Error('Unable to locate npm. Run this script with npm run frontend:install.');
}

const result = spawnSync(process.execPath, [npmCli, 'ci', '--include=dev'], {
  cwd: frontendDirectory,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
