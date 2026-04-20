import 'dotenv/config';

const VALID_MODES = new Set(['pooler', 'direct', 'supabase']);

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const getDbMode = () => {
  const rawMode = (process.env.DB_CONNECTION_MODE || 'pooler').toLowerCase().trim();
  if (!VALID_MODES.has(rawMode)) {
    throw new Error(
      `Invalid DB_CONNECTION_MODE: ${rawMode}. Supported: pooler | direct | supabase`
    );
  }
  return rawMode;
};

export const sanitizeError = (error) => {
  if (!error) return 'Unknown error';
  return error.message || String(error);
};

export const ensureRequired = (values) => {
  const hasMissing = values.some((value) => value === undefined || value === null || value === '');
  if (hasMissing) {
    throw new Error('Missing DB credentials for selected mode');
  }
};

export const getModeConfig = (scope = 'master', dbConfig = null) => {
  const mode = getDbMode();
  const databaseUrl = process.env.DATABASE_URL;
  let parsedDbUrl;

  if (databaseUrl) {
    try {
      parsedDbUrl = new URL(databaseUrl);
    } catch {
      parsedDbUrl = undefined;
    }
  }

  if (mode === 'supabase') {
    const supabaseUrl =
      dbConfig?.supabase_url ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      dbConfig?.supabase_anon_key ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    ensureRequired([supabaseUrl, supabaseAnonKey]);

    return {
      mode,
      scope,
      host: new URL(supabaseUrl).hostname,
      port: 443,
      supabaseUrl,
      supabaseAnonKey,
    };
  }

  const host = dbConfig?.db_host || process.env.MASTER_DB_HOST || parsedDbUrl?.hostname;
  const defaultPort = mode === 'pooler' ? 6543 : 5432;
  const rawPort = dbConfig?.db_port || process.env.MASTER_DB_PORT || parsedDbUrl?.port || defaultPort;
  let port = toInt(rawPort, defaultPort);
  if (mode === 'pooler' && port === 5432) {
    port = 6543;
  }
  const database =
    dbConfig?.db_name ||
    process.env.MASTER_DB_NAME ||
    parsedDbUrl?.pathname?.replace(/^\//, '');
  const user = dbConfig?.db_user || process.env.MASTER_DB_USER || parsedDbUrl?.username;
  const password =
    dbConfig?.db_password ||
    process.env.MASTER_DB_PASSWORD ||
    parsedDbUrl?.password;

  ensureRequired([host, port, database, user, password]);

  return {
    mode,
    scope,
    host,
    port,
    database,
    user,
    password,
  };
};
