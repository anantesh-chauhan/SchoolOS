import pkg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { getModeConfig, sanitizeError } from '../utils/dbMode.util.js';

const { Pool } = pkg;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logModeBanner = (mode) => {
  if (mode === 'pooler') {
    console.log('Using Session Pooler');
    return;
  }
  if (mode === 'direct') {
    console.log('Using Direct Connection');
    return;
  }
  console.log('Using Supabase API');
};

export const logConnectionError = (error, meta, context = 'database') => {
  console.error(`[DB:${context}] Connection failed`);
  console.error(`  Mode: ${meta.mode}`);
  console.error(`  Host: ${meta.host}`);
  console.error(`  Port: ${meta.port}`);
  console.error(`  Reason: ${sanitizeError(error)}`);
};

const createPgAdapter = (config) => {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (error) => {
    logConnectionError(error, {
      mode: config.mode,
      host: config.host,
      port: config.port,
    }, `${config.scope}:idle`);
  });

  return {
    mode: config.mode,
    host: config.host,
    port: config.port,
    query: (sql, params = []) => pool.query(sql, params),
    healthCheck: async () => {
      await pool.query('SELECT 1');
      return true;
    },
    end: async () => pool.end(),
  };
};

const createSupabaseAdapter = (config) => {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const query = async (sql, params = []) => {
    const { data, error } = await client.rpc('execute_sql', { sql, params });
    if (error) {
      throw new Error(
        `${error.message}. Supabase API mode expects an RPC function named execute_sql(sql text, params jsonb)`
      );
    }

    const rows = Array.isArray(data) ? data : data?.rows || [];
    return { rows, rowCount: rows.length };
  };

  return {
    mode: config.mode,
    host: config.host,
    port: config.port,
    client,
    query,
    healthCheck: async () => {
      const response = await fetch(`${config.supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: config.supabaseAnonKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase API returned ${response.status}`);
      }
      return true;
    },
    end: async () => {},
  };
};

export const createDatabaseConnection = ({ scope = 'master', dbConfig = null } = {}) => {
  const config = getModeConfig(scope, dbConfig);

  logModeBanner(config.mode);
  console.log(`DB Mode: ${config.mode}`);
  console.log(`DB Host: ${config.host}`);
  console.log(`DB Port: ${config.port}`);

  if (config.mode === 'supabase') {
    return createSupabaseAdapter(config);
  }
  return createPgAdapter(config);
};

export const connectWithRetry = async (db, retries = 3, delayMs = 2000, meta = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (typeof db.healthCheck === 'function') {
        await db.healthCheck();
      } else {
        await db.query('SELECT 1');
      }
      return true;
    } catch (error) {
      lastError = error;
      logConnectionError(error, {
        mode: meta.mode || db.mode || 'unknown',
        host: meta.host || db.host || 'unknown',
        port: meta.port || db.port || 'unknown',
      }, `retry-attempt-${attempt}`);

      if (attempt < retries) {
        await wait(delayMs);
      }
    }
  }

  throw lastError;
};
