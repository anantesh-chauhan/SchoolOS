import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDatabaseUrlForRender } from '../src/config/databaseUrl.js';

normalizeDatabaseUrlForRender();

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const prismaCli = path.resolve(scriptsDirectory, '..', 'node_modules', 'prisma', 'build', 'index.js');

if (!existsSync(prismaCli)) {
  throw new Error(`Prisma CLI not found at ${prismaCli}`);
}

const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: path.resolve(scriptsDirectory, '..'),
  env: process.env,
  stdio: 'inherit',
});

if (migration.error) throw migration.error;
if (migration.status !== 0) process.exit(migration.status ?? 1);

await import('../server.js');
