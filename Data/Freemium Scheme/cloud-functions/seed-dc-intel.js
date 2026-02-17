/**
 * Seed DC Intelligence tables in Supabase
 * Run: cd cloud-functions && node seed-dc-intel.js
 */
require('dotenv').config();
const { supaAdmin } = require('./services/supabase');

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

async function seed() {
  console.log('\n=== DC Intelligence — Supabase Seeder ===\n');

  // Step 1: Create tables via raw SQL (Supabase doesn't expose DDL via client,
  // so we'll use the REST API with service_role to insert data directly.
  // Tables must be created first in Supabase Dashboard SQL editor.)

  console.log('NOTE: Tables must be created first in Supabase Dashboard SQL Editor.');
  console.log('      Run supabase_dc_intelligence.sql there first.\n');

  // Step 2: Check if tables exist by trying to query them
  let tablesExist = true;
  for (const table of ['dc_operators', 'dc_countries', 'dc_facilities', 'dc_market_summary']) {
    const { data, error } = await supaAdmin.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ${FAIL} Table "${table}" — ${error.message}`);
      tablesExist = false;
    } else {
      console.log(`  ${PASS} Table "${table}" exists (${data.length} row(s) found)`);
    }
  }

  if (!tablesExist) {
    console.log('\n  Some tables missing. Run the SQL schema first.\n');
    process.exit(1);
  }

  // Step 3: Check row counts
  console.log('\n--- Current Row Counts ---');
  for (const table of ['dc_operators', 'dc_countries', 'dc_facilities', 'dc_market_summary']) {
    const { count } = await supaAdmin.from(table).select('id', { count: 'exact', head: true });
    console.log(`  ${table}: ${count || 0} rows`);
  }

  // Step 4: If data already seeded, skip
  const { count: opCount } = await supaAdmin.from('dc_operators').select('id', { count: 'exact', head: true });
  if (opCount >= 50) {
    console.log('\n  Data already seeded (' + opCount + ' operators). Skipping insert.');
    console.log('  To re-seed, truncate tables first in SQL editor.\n');
    process.exit(0);
  }

  console.log('\n  Data will be seeded via SQL file. Run in Supabase SQL Editor.');
  console.log('  File: Sandbox/Data/Freemium Scheme/supabase_dc_intelligence.sql\n');

  process.exit(0);
}

seed().catch(e => { console.error('FATAL:', e); process.exit(1); });
