/**
 * Supabase client factory.
 * With Firebase Auth, we only use the service_role client
 * (no user JWTs for Supabase — Cloud Run mediates all access).
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supaAdmin };
