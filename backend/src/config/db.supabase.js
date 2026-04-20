import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper function to execute SQL queries
const query = async (sql, params = []) => {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql,
      params,
    });

    if (error) throw error;
    return { rows: data, error: null };
  } catch (error) {
    console.error('Supabase query error:', error);
    return { rows: [], error };
  }
};

// Alternative direct database execution (using REST API)
const directQuery = async (sql, params = []) => {
  try {
    const { data, error } = await supabase
      .from('_supabase_migrations')
      .select('*')
      .limit(0);

    if (error) throw error;

    // Use raw fetch for custom SQL queries
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ sql, params }),
    });

    const result = await response.json();
    return { rows: result, error: null };
  } catch (error) {
    console.error('Direct query error:', error);
    return { rows: [], error };
  }
};

const supabaseDb = {
  query: query,
  directQuery: directQuery,
  client: supabase,
};

export default supabaseDb;
