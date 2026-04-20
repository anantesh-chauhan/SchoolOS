import { createDatabaseConnection } from './db.factory.js';
import { getDbMode } from '../utils/dbMode.util.js';

const tenantDatabases = new Map();

export const getTenantDatabase = (dbConfig) => {
  const mode = getDbMode();
  const key = `${mode}:${dbConfig.db_host}:${dbConfig.db_port}:${dbConfig.db_name}`;

  if (tenantDatabases.has(key)) {
    return tenantDatabases.get(key);
  }

  const tenantDb = createDatabaseConnection({
    scope: 'tenant',
    dbConfig: {
      db_host: dbConfig.db_host,
      db_port: dbConfig.db_port,
      db_name: dbConfig.db_name,
      db_user: dbConfig.db_user,
      db_password: dbConfig.db_password,
      supabase_url: dbConfig.supabase_url,
      supabase_anon_key: dbConfig.supabase_anon_key,
    },
  });

  tenantDatabases.set(key, tenantDb);
  return tenantDb;
};

export const closeAllTenantDatabases = async () => {
  for (const [key, db] of tenantDatabases.entries()) {
    try {
      if (db && typeof db.end === 'function') {
        await db.end();
      }
      tenantDatabases.delete(key);
    } catch (err) {
      console.error(`Error closing tenant DB (${key}):`, err);
    }
  }
};

export default { getTenantDatabase, closeAllTenantDatabases };
