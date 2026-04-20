import { createDatabaseConnection, connectWithRetry } from './db.factory.js';

let masterDb;

export const getDatabase = () => {
  if (!masterDb) {
    masterDb = createDatabaseConnection({ scope: 'master' });
  }
  return masterDb;
};

export const testDatabaseConnection = async () => {
  const db = getDatabase();
  await connectWithRetry(db, 3, 2000, {
    mode: db.mode,
    host: db.host,
    port: db.port,
  });
  return true;
};

export const closeDatabase = async () => {
  if (masterDb && typeof masterDb.end === 'function') {
    await masterDb.end();
  }
};

masterDb = getDatabase();

export default masterDb;
