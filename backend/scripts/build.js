import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(scriptsDirectory, '..');
const frontendDistDirectory = path.resolve(backendDirectory, '..', 'frontend', 'dist');
const publicDirectory = path.join(backendDirectory, 'public');

if (!existsSync(frontendDistDirectory)) {
  throw new Error(`Frontend build output not found at ${frontendDistDirectory}`);
}

rmSync(publicDirectory, { recursive: true, force: true });
cpSync(frontendDistDirectory, publicDirectory, { recursive: true });
console.log(`Copied frontend build to ${publicDirectory}`);
