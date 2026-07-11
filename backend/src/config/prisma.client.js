import { PrismaClient } from '../generated/prisma/index.js';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.schoolOsPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.schoolOsPrisma = prisma;
}

export default prisma;
