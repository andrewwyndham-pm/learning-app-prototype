import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

function requireEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY') {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const supabaseAdmin = createClient<Database>(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
