/**
 * signed-in-supabase.mjs — a signed-in visitor for browser gates, the way the site now authenticates.
 *
 * Since v3.57.7 a page unlocks only from a Supabase session + profile row; a forged localStorage
 * `rz_premium_session` grants nothing (audit F2, tools/test-feature-overrides.mjs). Gates that test
 * something OTHER than auth (engine authority, Design Studio, building levels) used that forged key
 * and so started measuring the login wall. This module answers the js/rz-supabase.js request with a
 * stub that reports one signed-in user and its profile tier, nothing else.
 *
 *   import { isSupabaseModule, signedInSupabaseBody } from './lib/signed-in-supabase.mjs';
 *   if (isSupabaseModule(url)) return request.respond({ status: 200, contentType: 'text/javascript',
 *     body: signedInSupabaseBody({ email: 'educator@resistancezero.com', tier: 'pro' }) });
 */
export function isSupabaseModule(url) {
  try { return new URL(url).pathname.endsWith('/js/rz-supabase.js'); } catch { return false; }
}

export function signedInSupabaseBody({ email = 'gate.user@resistancezero.com', tier = 'pro', id = 'gate-user', educator = false } = {}) {
  const user = { id, email };
  return `const u=${JSON.stringify(user)},t=${JSON.stringify(tier)};
    const ok=(d)=>async()=>({data:d,error:null});
    const api={configured:true,
      getUser:async()=>u,getSession:async()=>({user:u}),
      getProfile:ok({id:u.id,email:u.email,tier:t}),
      signIn:async()=>({error:'gate stub'}),signOut:async()=>({}),
      isEducator:ok(${educator ? 'true' : 'false'}),getFeatureOverrides:ok([]),listEducators:ok([]),
      listAllProfiles:ok([]),listAuditLog:ok([]),listSubscribers:ok([])};
    api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;
}

/** localStorage keys a real signed-in visitor carries: the mirror session auth.js reads, plus the
 *  Supabase token marker (sb-*-auth-token) whose presence lets syncServerRole keep a server role.
 *  Use inside page.evaluateOnNewDocument((entries) => entries.forEach(([k, v]) => localStorage.setItem(k, v)), ...). */
export function signedInStorage({ email = 'gate.user@resistancezero.com', tier = 'pro', role = 'pro' } = {}) {
  return [
    ['rz_premium_session', JSON.stringify({ email, tier, role, expires: '2099-12-31T23:59:59.000Z' })],
    ['sb-gate-auth-token', '{"gate":true}'],
  ];
}

/** A visitor with NO Supabase session: the module loads and answers, nobody is signed in. For gates that prove a
 *  client-written session record grants nothing (audit 2026-11-16 S1). */
export function signedOutSupabaseBody() {
  return `const ok=(d)=>async()=>({data:d,error:null});
    const api={configured:true,
      getUser:async()=>null,getSession:async()=>null,
      getProfile:ok(null),
      signIn:async()=>({error:'gate stub'}),signOut:async()=>({}),
      isEducator:ok(false),getFeatureOverrides:ok([]),listEducators:ok([]),
      listAllProfiles:ok([]),listAuditLog:ok([]),listSubscribers:ok([])};
    api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;
}

/** A forged local token: supabase-js getSession() only reads localStorage, so it "returns" the user the visitor wrote
 *  there; the server-validated getUser() says nobody is signed in. A gate that takes getSession() as proof fails here. */
export function forgedTokenSupabaseBody({ email = 'admin@resistancezero.com' } = {}) {
  const user = { id: 'forged', email };
  return `const u=${JSON.stringify(user)};
    const ok=(d)=>async()=>({data:d,error:null});
    const api={configured:true,
      getUser:async()=>null,getSession:async()=>({user:u}),
      getProfile:ok(null),
      signIn:async()=>({error:'gate stub'}),signOut:async()=>({}),
      isEducator:ok(true),getFeatureOverrides:ok([]),listEducators:ok([]),
      listAllProfiles:ok([]),listAuditLog:ok([]),listSubscribers:ok([])};
    api.ready=Promise.resolve(api);window.rzSupa=api;window.dispatchEvent(new CustomEvent("rz-supa-ready",{detail:api}));`;
}
