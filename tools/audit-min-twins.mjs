/**
 * Ship gate — every `X.min.js` is the current build of its `X.js`.
 *
 * This bug has now shipped TWICE. `index.html` is one of only two pages that load
 * `auth.min.js` rather than `auth.js`, so a stale twin means the HOMEPAGE silently runs
 * old auth code while every other page runs the fixed one — and nothing fails. v1.126.x
 * caught it once ("the homepage always ran old auth logic regardless of auth.js fixes")
 * and rebuilt the file by hand; by v1.134.20 it was stale again, still painted in the
 * Anthropic purple that the same release had just removed from `auth.js`.
 *
 * Hand-discipline did not hold, so this is a gate instead. `terser <src> -c -m` is
 * byte-reproducible for every twin in this repo, which makes the check exact: rebuild,
 * compare, and report the drift rather than trusting that someone remembered.
 *
 * A terser upgrade will also fail this gate. That is the correct outcome, not a false
 * positive — the twins are build output and must be regenerated when the builder changes.
 *
 * Run: node tools/audit-min-twins.mjs [--strict] [--fix]
 */
import { execFile } from 'node:child_process';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const FIX = ARGS.includes('--fix');

/* Twins live at the repo root and in js/. Both are enumerated rather than listed by hand,
   so a NEW twin is covered the day it is added instead of the day someone remembers it. */
const DIRS = ['.', 'js', 'css'];
/* Both builders this repo uses are byte-reproducible, so both kinds of twin are checkable.
   The CSS pair matters at least as much as the JS one: styles.min.css is the stylesheet
   almost every page loads, and it was carrying the retired Anthropic purple in its
   .oe-*-violet rules long after styles.css had moved to a token. */
const BUILDERS = Object.freeze([
    { suffix: '.min.js', sourceExt: '.js', cmd: 'terser', args: (src, out) => [src, '-c', '-m', '-o', out] },
    { suffix: '.min.css', sourceExt: '.css', cmd: 'cleancss', args: (src, out) => [src, '-o', out] },
]);
const twins = [];
for (const dir of DIRS) {
    let entries;
    try { entries = await readdir(join(ROOT, dir)); } catch { continue; }
    for (const name of entries) {
        const builder = BUILDERS.find((b) => name.endsWith(b.suffix));
        if (!builder) continue;
        const source = name.slice(0, -builder.suffix.length) + builder.sourceExt;
        if (!entries.includes(source)) continue;   // a hand-authored .min with no source
        twins.push({
            source: dir === '.' ? source : `${dir}/${source}`,
            min: dir === '.' ? name : `${dir}/${name}`,
            builder,
        });
    }
}

const stale = [];
for (const twin of twins) {
    const out = join(tmpdir(), `rz-min-twin-${process.pid}-${twin.min.replace(/\W/g, '_')}`);
    try {
        await run(twin.builder.cmd, twin.builder.args(join(ROOT, twin.source), out));
    } catch (error) {
        console.error(`  ! ${twin.min}: ${twin.builder.cmd} failed — ${error.message.split('\n')[0]}`);
        stale.push({ ...twin, reason: 'build failed' });
        continue;
    }
    const [built, shipped] = await Promise.all([readFile(out, 'utf8'), readFile(join(ROOT, twin.min), 'utf8')]);
    await unlink(out).catch(() => {});
    if (built === shipped) continue;
    if (FIX) {
        await run(twin.builder.cmd, twin.builder.args(join(ROOT, twin.source), join(ROOT, twin.min)));
        console.log(`  ~ ${twin.min}: rebuilt from ${twin.source}`);
        continue;
    }
    stale.push({
        ...twin,
        reason: `${shipped.length} bytes shipped vs ${built.length} rebuilt`,
    });
}

console.log('── MIN-TWIN FRESHNESS ──');
if (!stale.length) {
    console.log(`  ✓ ${twins.length} minified twin(s) match a fresh build of their source`);
    process.exit(0);
}
for (const item of stale) {
    console.log(`  ✗ ${item.min} is stale against ${item.source} — ${item.reason}`);
    const rebuild = item.builder.cmd === 'terser'
        ? `terser ${item.source} -c -m -o ${item.min}`
        : `cleancss ${item.source} -o ${item.min}`;
    console.log(`      fix: ${rebuild}   (then bump its ?v= on the pages that load it)`);
}
console.log(`── ${stale.length} stale twin(s). A page loading one of these runs OLD code.`);
process.exit(STRICT ? 1 : 0);
