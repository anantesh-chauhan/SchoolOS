
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const locks = await prisma.$queryRawUnsafe(`
      SELECT pid 
      FROM pg_locks l
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE l.locktype = 'advisory' 
      AND (l.objid = 9234501 OR l.classid = 9234501)
      AND l.granted = true
    `);

    const myPid = await prisma.$queryRawUnsafe(`SELECT pg_backend_pid()`);
    const currentPid = myPid[0].pg_backend_pid;

    console.log("Found pids:", locks.map(l => l.pid));

    for (const lock of locks) {
      if (lock.pid !== currentPid) {
        console.log(`Terminating pid: ${lock.pid}`);
        await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${lock.pid})`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
