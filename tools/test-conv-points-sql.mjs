#!/usr/bin/env node
/**
 * test-conv-points-sql.mjs — PRD-CONV-POINT-STATUS-TREND §5b: the conv_points migration, run for real in the LOCAL
 * postgres:16 image (no pull, no download; `docker run --rm`, container rz-pst-pg-<pid>, removed in `finally`).
 *
 * Supabase bits the image does not have are stubbed: schema auth (users, uid() from the request.jwt.claim.sub setting),
 * roles anon / authenticated with Supabase's default grants, and schema cron (job table, schedule, unschedule — a
 * plain insert, so a missing unschedule guard shows as a duplicate). supabase/schema.sql is applied whole (is_root,
 * audit_log), then the migration TWICE (idempotency).
 *
 *   S1 parity     conv_hist_value = RZConvHistory.value (js/conv/history.js) for 50 points × 2,000 minutes, exactly;
 *                 and the samples conv_samples_span writes over those minutes equal it too
 *   S2 rollup     after conv_backfill(30): every rollup row's min / max / mean / n = the JS recomputation from the model
 *   S3 retention  samples older than 48 h and rollups older than 35 d are pruned by conv_sample_tick
 *   S4 RLS        anon reads; anon update changes 0 rows; anon cannot write samples or call the writer; a non-root
 *                 user updates 0 rows; root updates 1 row and audit_log gets the old and new row; bad bound order refused
 *   S5 RPC        conv_point_series: a 24 h window returns samples (t, v); a 25 h window returns rollups (min/max/mean)
 *   S6 idempotent the second run: 1 cron job named conv-sample-tick, seed rows = data/conv-points.json, 0 new audit rows
 *   S7 seed       the hist definitions in the database = tools/build-conv-points-seed.mjs rows
 *
 *   --plant=hash|prune|anonwrite|cronguard   a planted defect; each must turn the gate red
 *   Prints the measured size of the three tables after the 30-day backfill (pg_total_relation_size).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { seedRows, MIGRATION } from './build-conv-points-seed.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const H = require(path.join(ROOT, 'js/conv/history.js'));
const PLANT = (process.argv.find((a) => a.startsWith('--plant=')) || '').split('=')[1] || '';
const PLANTS = {
  hash: ['16777619::double precision', '16777618::double precision'],
  prune: ["delete from public.conv_point_samples where ts < at - interval '48 hours';", '-- planted: no sample prune'],
  anonwrite: ['-- ===== audit:', 'drop policy if exists "planted anon write" on public.conv_points;\ncreate policy "planted anon write" on public.conv_points for update to anon using (true) with check (true);\n-- ===== audit:'],
  cronguard: ["select cron.unschedule(jobid) from cron.job where jobname = 'conv-sample-tick';", '-- planted: no unschedule guard'],
};
if (PLANT && !PLANTS[PLANT]) { console.error(`unknown plant ${PLANT}: ${Object.keys(PLANTS).join(', ')}`); process.exit(2); }
const NAME = `rz-pst-pg-${process.pid}`;
const fails = []; let passes = 0;
const ok = (c, law, msg) => { if (c) passes++; else fails.push(`${law} ${msg}`); };

function docker(args, input) { return spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 256 << 20 }); }
function psql(sql) {
  const r = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-At', '-F', '|'], sql);
  if (r.status !== 0) { const e = new Error((r.stderr || '').trim().split('\n').slice(-3).join(' | ')); e.sqlError = true; throw e; }
  return r.stdout.trim();
}
function tryPsql(sql) { try { return { out: psql(sql) }; } catch (e) { return { err: e.message }; } }
const rowsOf = (out) => (out ? out.split('\n').map((l) => l.split('|')) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const STUB = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create or replace function cron.schedule(p_name text, p_sched text, p_cmd text) returns bigint language sql as
  $$ insert into cron.job (jobname, schedule, command) values (p_name, p_sched, p_cmd) returning jobid $$;
create or replace function cron.unschedule(p_id bigint) returns boolean language sql as
  $$ delete from cron.job where jobid = p_id returning true $$;
`;

function migrationSql() {
  let s = fs.readFileSync(path.join(ROOT, MIGRATION), 'utf8');
  const ext = 'create extension if not exists pg_cron with schema pg_catalog;';
  if (!s.includes(ext)) throw new Error('migration: pg_cron line not found');
  s = s.replace(ext, '-- pg_cron stubbed by the gate (schema cron)');
  if (PLANT) {
    const [a, b] = PLANTS[PLANT];
    if (!s.includes(a)) { console.error(`plant ${PLANT}: anchor not found`); process.exit(2); }
    s = s.split(a).join(b);
  }
  return s;
}

/* 50 points: the real seed + synthetic ones covering every shape, 0–4 digits, zero / negative / large amp and base */
function parityPoints() {
  const real = seedRows().map((r) => ({ id: r.id, base: r.hist_base, amp: r.hist_amp, shape: r.hist_shape, digits: r.hist_digits }));
  const shapes = ['load', 'flat', 'saw'], out = real.slice();
  for (let i = 0; out.length < 50; i++) {
    out.push({ id: `gate.p${i}.${shapes[i % 3]}_v`, base: [12.5, -3.25, 0, 1234.567, 0.0042, 98.6][i % 6] * (1 + i / 37),
      amp: [0.3, 0, 2.75, 15, 0.0005, -1.2][i % 6], shape: shapes[i % 3], digits: i % 5 });
  }
  return out;
}

let started = false;
try {
  const port = await freePort();
  const run = docker(['run', '-d', '--rm', '--name', NAME, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-p', `127.0.0.1:${port}:5432`, '--pull', 'never', 'postgres:16']);
  if (run.status !== 0) throw new Error(`docker run failed: ${(run.stderr || '').trim()}`);
  started = true;
  for (let i = 0; i < 60; i++) {
    if (docker(['exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) break;
    await sleep(500);
  }
  psql('select 1');

  /* schema + migration twice */
  psql(STUB);
  psql(fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8'));
  const mig = migrationSql();
  psql(mig);
  const audit1 = +psql('select count(*) from public.audit_log');
  psql(mig);
  const audit2 = +psql('select count(*) from public.audit_log');
  const seed = seedRows();

  /* S6 idempotent */
  ok(psql("select count(*) from cron.job where jobname = 'conv-sample-tick'") === '1', 'S6', `cron jobs named conv-sample-tick after two runs: ${psql("select count(*) from cron.job where jobname = 'conv-sample-tick'")}`);
  ok(+psql('select count(*) from public.conv_points') === seed.length, 'S6', `conv_points rows ${psql('select count(*) from public.conv_points')} (want ${seed.length})`);
  ok(audit2 === audit1, 'S6', `second run wrote ${audit2 - audit1} audit rows (want 0: nothing changed)`);

  /* S7 seed = builder */
  const db = Object.fromEntries(rowsOf(psql('select id, hist_base, hist_amp, hist_shape, hist_digits, lo_alarm, lo_warn, hi_warn, hi_alarm from public.conv_points')).map((r) => [r[0], r]));
  const num = (s) => (s === '' ? null : +s);
  const seedBad = seed.filter((r) => { const d = db[r.id]; return !d || num(d[1]) !== r.hist_base || num(d[2]) !== r.hist_amp || d[3] !== r.hist_shape || +d[4] !== r.hist_digits || num(d[5]) !== r.lo_alarm || num(d[6]) !== r.lo_warn || num(d[7]) !== r.hi_warn || num(d[8]) !== r.hi_alarm; });
  ok(!seedBad.length, 'S7', `seed rows differing from the builder: ${seedBad.map((r) => r.id).join(', ')}`);

  /* S1 parity: function, then the samples writer */
  const pts = parityPoints(), M0 = Math.floor(1795000000000 / 60000) - 1000, N = 2000;
  const vals = pts.map((p, i) => `(${i}, '${p.id}', ${p.base}::double precision, ${p.amp}::double precision, '${p.shape}', ${p.digits})`).join(',\n');
  const out = psql(`select d.i, m.m, public.conv_hist_value(d.id, d.b, d.a, d.s, d.g, m.m)
    from (values ${vals}) as d(i, id, b, a, s, g) cross join generate_series(${M0}::bigint, ${M0 + N - 1}::bigint) as m(m) order by d.i, m.m`);
  let n = 0, bad = 0; const firstBad = [];
  for (const [i, m, v] of rowsOf(out)) {
    n++; const want = H.value(pts[+i], +m);
    if (want !== +v) { bad++; if (firstBad.length < 3) firstBad.push(`${pts[+i].id}@${m} sql ${v} js ${want}`); }
  }
  ok(n === 50 * N && bad === 0, 'S1', `parity ${n - bad}/${n} values equal (want ${50 * N}/${50 * N})${firstBad.length ? ': ' + firstBad.join('; ') : ''}`);
  console.log(`S1 parity: ${n - bad}/${n} values equal RZConvHistory.value (50 points × ${N} minutes)`);

  psql(`begin;
    insert into public.conv_points (id, label, hist_base, hist_amp, hist_shape, hist_digits)
      select id, id, b, a, s, g from (values ${pts.slice(seed.length).map((p) => `('${p.id}', ${p.base}::double precision, ${p.amp}::double precision, '${p.shape}', ${p.digits})`).join(',')}) as x(id, b, a, s, g);
    select public.conv_samples_span(${M0}, ${M0 + N});
    commit;`);
  const smp = rowsOf(psql(`select point_id, (extract(epoch from ts) / 60)::bigint, value from public.conv_point_samples
                           where ts >= to_timestamp(${M0 * 60}) and ts < to_timestamp(${(M0 + N) * 60})`));
  const byId = Object.fromEntries(pts.map((p) => [p.id, p]));
  const smpBad = smp.filter(([id, m, v]) => H.value(byId[id], +m) !== +v);
  ok(smp.length === 50 * (N / 5) && !smpBad.length, 'S1', `samples writer: ${smp.length - smpBad.length}/${smp.length} equal (want ${50 * N / 5})`);
  psql(`delete from public.conv_points where id like 'gate.%'`);

  /* S2 rollup + size */
  const AT = '2026-11-20 10:07:00+00', atMin = Date.parse('2026-11-20T10:07:00Z') / 60000;
  psql(`truncate public.conv_point_samples, public.conv_point_rollup; select public.conv_backfill(30, '${AT}');`);
  const roll = rowsOf(psql('select point_id, (extract(epoch from ts) / 60)::bigint, v_min, v_max, v_mean, n from public.conv_point_rollup'));
  const seedDef = Object.fromEntries(seed.map((r) => [r.id, { id: r.id, base: r.hist_base, amp: r.hist_amp, shape: r.hist_shape, digits: r.hist_digits }]));
  let rBad = 0; const rFirst = [];
  for (const [id, w, mn, mx, mean, cnt] of roll) {
    const v = [0, 5, 10, 15, 20, 25].map((o) => H.value(seedDef[id], +w + o));
    let sum = 0; v.forEach((x) => { sum += x; });
    const want = [Math.min(...v), Math.max(...v), sum / v.length, v.length];
    if (want[0] !== +mn || want[1] !== +mx || want[2] !== +mean || want[3] !== +cnt) { rBad++; if (rFirst.length < 2) rFirst.push(`${id}@${w} sql ${mn}/${mx}/${mean}/${cnt} js ${want.join('/')}`); }
  }
  const wantRoll = seed.length * 30 * 48;
  ok(roll.length === wantRoll && !rBad, 'S2', `rollup ${roll.length - rBad}/${roll.length} rows = JS recomputation (want ${wantRoll} rows)${rFirst.length ? ': ' + rFirst.join('; ') : ''}`);
  const size = rowsOf(psql(`select c, pg_total_relation_size(('public.' || c)::regclass), (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.' || c, false, true, '')))[1]::text::int
                            from unnest(array['conv_points','conv_point_samples','conv_point_rollup']) c`));
  const bytes = size.reduce((s, r) => s + +r[1], 0), rows = size.reduce((s, r) => s + +r[2], 0);
  console.log(`SIZE after conv_backfill(30), ${seed.length} points: ${size.map((r) => `${r[0]} ${r[2]} rows ${(+r[1] / 1048576).toFixed(2)} MB`).join(' · ')} · total ${rows} rows ${(bytes / 1048576).toFixed(2)} MB`);

  /* S3 retention: plant rows past retention, tick, they are gone; nothing older than the windows survives */
  psql(`insert into public.conv_point_samples values ('${seed[0].id}', '${AT}'::timestamptz - interval '49 hours', 1);
        insert into public.conv_point_rollup values ('${seed[0].id}', '${AT}'::timestamptz - interval '36 days', 1, 1, 1, 6);
        select public.conv_sample_tick('${AT}'::timestamptz + interval '5 minutes');`);
  const oldS = +psql(`select count(*) from public.conv_point_samples where ts < '${AT}'::timestamptz + interval '5 minutes' - interval '48 hours'`);
  const oldR = +psql(`select count(*) from public.conv_point_rollup where ts < '${AT}'::timestamptz + interval '5 minutes' - interval '35 days'`);
  ok(oldS === 0 && oldR === 0, 'S3', `after a tick: ${oldS} samples older than 48 h, ${oldR} rollups older than 35 d (want 0, 0)`);
  const tickRows = +psql(`select count(*) from public.conv_point_samples where ts = '2026-11-20 10:10:00+00'`);
  ok(tickRows === seed.length, 'S3', `the tick wrote ${tickRows} samples at 10:10 (want ${seed.length})`);

  /* S4 RLS */
  const ROOT_ID = '00000000-0000-4000-8000-000000000001', USER_ID = '00000000-0000-4000-8000-000000000002', P = seed[0].id;
  psql(`insert into auth.users (id, email) values ('${ROOT_ID}', 'root@example.test'), ('${USER_ID}', 'user@example.test') on conflict do nothing;
        insert into public.profiles (id, email, tier, role) values ('${ROOT_ID}', 'root@example.test', 'root', 'root'), ('${USER_ID}', 'user@example.test', 'free', 'user')
          on conflict (id) do update set tier = excluded.tier, role = excluded.role;`);
  const as = (role, uid, sql) => tryPsql(`begin; set local role ${role}; ${uid ? `set local request.jwt.claim.sub = '${uid}';` : ''} ${sql}; commit;`);
  const anonRead = as('anon', null, 'select count(*) from public.conv_points');
  ok(+anonRead.out === seed.length, 'S4', `anon reads ${anonRead.out || anonRead.err} points`);
  const anonUpd = as('anon', null, `with u as (update public.conv_points set hi_warn = 38 where id = '${P}' returning 1) select count(*) from u`);
  ok(anonUpd.out === '0' || /permission denied|row-level/.test(anonUpd.err || ''), 'S4', `anon update changed ${anonUpd.out ?? anonUpd.err} rows (want 0)`);
  const anonIns = as('anon', null, `insert into public.conv_point_samples values ('${P}', now(), 1)`);
  ok(!!anonIns.err, 'S4', `anon insert into samples: ${anonIns.err || 'ACCEPTED'}`);
  const anonTick = as('anon', null, 'select public.conv_sample_tick(now())');
  ok(/permission denied/.test(anonTick.err || ''), 'S4', `anon calls conv_sample_tick: ${anonTick.err || 'ACCEPTED'}`);
  const userUpd = as('authenticated', USER_ID, `with u as (update public.conv_points set hi_warn = 38 where id = '${P}' returning 1) select count(*) from u`);
  ok(userUpd.out === '0', 'S4', `non-root update changed ${userUpd.out ?? userUpd.err} rows (want 0)`);
  const before = +psql(`select count(*) from public.audit_log where action = 'conv_point_update' and target_id = '${P}'`);
  const rootUpd = as('authenticated', ROOT_ID, `with u as (update public.conv_points set hi_warn = 38 where id = '${P}' returning 1) select count(*) from u`);
  ok(rootUpd.out === '1', 'S4', `root update changed ${rootUpd.out ?? rootUpd.err} rows (want 1)`);
  const aud = rowsOf(psql(`select actor_id, meta->'old'->>'hi_warn', meta->'new'->>'hi_warn', meta->'new'->>'updated_by' from public.audit_log
                           where action = 'conv_point_update' and target_id = '${P}' order by created_at desc limit 1`))[0] || [];
  const after = +psql(`select count(*) from public.audit_log where action = 'conv_point_update' and target_id = '${P}'`);
  ok(after === before + 1 && aud[0] === ROOT_ID && aud[1] === '37' && aud[2] === '38' && aud[3] === ROOT_ID, 'S4', `audit_log: +${after - before} row, actor ${aud[0]}, hi_warn ${aud[1]} -> ${aud[2]}, updated_by ${aud[3]}`);
  const badOrder = as('authenticated', ROOT_ID, `update public.conv_points set hi_warn = 45 where id = '${P}'`);
  ok(/conv_points_order_chk/.test(badOrder.err || ''), 'S4', `root sets hi_warn 45 > hi_alarm 40: ${badOrder.err || 'ACCEPTED'}`);

  /* S5 RPC table choice (as anon, the browser's role) */
  const NOW = `'${AT}'::timestamptz + interval '5 minutes'`;
  const r24 = as('anon', null, `select count(*), count(v), count(v_min) from public.conv_point_series('${P}', ${NOW} - interval '24 hours', ${NOW})`);
  const r25 = as('anon', null, `select count(*), count(v), count(v_min) from public.conv_point_series('${P}', ${NOW} - interval '25 hours', ${NOW})`);
  const [c24, v24, m24] = (r24.out || '0|0|0').split('|').map(Number), [c25, v25, m25] = (r25.out || '0|0|0').split('|').map(Number);
  ok(c24 === 288 && v24 === 288 && m24 === 0, 'S5', `24 h window: ${r24.out || r24.err} rows/v/min (want 288 samples)`);
  /* windows starting 09:30 the day before .. 09:30 (the last closed one at 10:12): 49 */
  ok(c25 === 49 && v25 === 0 && m25 === 49, 'S5', `25 h window: ${r25.out || r25.err} rows/v/min (want 49 rollups)`);
  const unk = as('anon', null, `select count(*) from public.conv_point_series('no.such.point', ${NOW} - interval '1 hour', ${NOW})`);
  ok(unk.out === '0', 'S5', `unknown id returns ${unk.out ?? unk.err} rows (want 0, no error)`);
  void atMin;
} catch (e) {
  fails.push(`RUN ${e.message}`);
} finally {
  if (started) docker(['rm', '-f', NAME]);
}

for (const f of fails) console.log('FAIL ' + f);
console.log(`test-conv-points-sql${PLANT ? ` [plant ${PLANT}]` : ''}: ${passes} pass, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
