/**
 * Append-only audit log for rz-auth-gateway.
 *
 * Every admin write + every login attempt (success and failure) gets one
 * record. Keys are ISO-timestamp prefixed so `kvList({prefix:'audit/'})`
 * returns them in chronological order without extra indexing.
 *
 * audit() NEVER throws — a failing audit write must not break the flow it
 * was logging. Failures go to console.warn for the Workers tail viewer.
 */

import { kvPut } from './kv.js';
import { randomToken } from './crypto.js';

export async function audit(env, { actor, action, target, before, after, ip, ua }) {
  try {
    const id = `${new Date().toISOString()}-${randomToken(4)}`;
    const record = {
      id,
      actor: actor ?? null,
      action: action ?? 'unknown',
      target: target ?? null,
      before: before ?? null,
      after: after ?? null,
      ip: ip ?? null,
      ua: ua ?? null,
      ts: Date.now(),
    };
    await kvPut(env.RZ_AUTH_KV, `audit/${id}`, record);
    return id;
  } catch (err) {
    console.warn('[rz-auth-gateway] audit write failed:', err && err.message || err);
    return null;
  }
}
