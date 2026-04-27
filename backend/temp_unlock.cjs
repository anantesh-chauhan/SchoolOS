
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const locks = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT pid 
      FROM pg_locks 
      WHERE locktype = 'advisory' 
      AND (objid = 9234501 OR classid = 9234501)
      AND granted = true
    `);

    const myPidResult = await prisma.$queryRawUnsafe(`SELECT pg_backend_pid()`);
    const currentPid = myPidResult[0].pg_backend_pid;

    console.log("Found pids:", locks.map(l => l.pid));

    for (const lock of locks) {
      if (lock.pid !== currentPid) {
        console.log(`Terminating pid: ${lock.pid}`);
        try {
          await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${lock.pid})`);
        } catch (e) {
           console.log(`Could not terminate pid ${lock.pid}: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
