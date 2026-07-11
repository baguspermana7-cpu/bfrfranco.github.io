/**
 * rz-config.js — public runtime config for resistancezero.com.
 *
 * These values are PUBLIC by design (they ship in the browser). Supabase security
 * relies on Row Level Security (RLS) policies in the database, NOT on hiding the anon
 * key. The `service_role` key and DB password must NEVER appear here or anywhere in
 * this repo. Load this BEFORE js/rz-supabase.js.
 */
(function (w) {
  w.RZ_CONFIG = w.RZ_CONFIG || {
    // Supabase project (Tokyo). Anon/publishable key — safe in client code.
    SUPABASE_URL:  'https://kffjaqkqwhvbqxdumyll.supabase.co',
    SUPABASE_ANON: 'sb_publishable_pALlKKusg565V6UFgLDmIA_yrbfUyZU'
  };
})(typeof window !== 'undefined' ? window : this);
