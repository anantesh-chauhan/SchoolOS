const SUPABASE_POOLER_HOSTS = {
  hjflsxlbdkuchxojuary: 'aws-1-ap-south-1.pooler.supabase.com',
};

export const normalizeDatabaseUrlForRender = () => {
  const value = process.env.DATABASE_URL;

  if (!process.env.RENDER || !value) {
    return value;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  const directMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (!directMatch) {
    return value;
  }

  const projectRef = directMatch[1];
  const poolerHost = process.env.SUPABASE_POOLER_HOST
    || SUPABASE_POOLER_HOSTS[projectRef];

  if (!poolerHost) {
    throw new Error(
      `Render cannot use the IPv6-only Supabase host ${url.hostname}. Set DATABASE_URL to the Session pooler URL or set SUPABASE_POOLER_HOST.`,
    );
  }

  url.hostname = poolerHost;
  url.port = process.env.SUPABASE_POOLER_PORT || '5432';
  url.username = `postgres.${projectRef}`;
  url.searchParams.set('sslmode', 'require');
  process.env.DATABASE_URL = url.toString();

  console.warn(
    `DATABASE_URL used a Supabase direct endpoint; using Render-compatible Session Pooler ${url.hostname}:${url.port}.`,
  );

  return process.env.DATABASE_URL;
};
