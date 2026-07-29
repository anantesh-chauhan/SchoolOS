import { PrismaClient } from '../generated/prisma/index.js';
import { normalizeDatabaseUrlForRender } from './databaseUrl.js';

const globalForPrisma = globalThis;

normalizeDatabaseUrlForRender();

export const prisma = globalForPrisma.schoolOsPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.schoolOsPrisma = prisma;
}

export default prisma;
