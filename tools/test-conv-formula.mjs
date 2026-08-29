/**
 * Ship gate — every declared formula is EVALUATED, not just written down.
 *
 * The registry has carried a `formula` field since v1.134.1. It was prose: nobody checked that
 * `heat_rejection_kw = it_load_kw + ups_loss_kw` was what the engine actually did, so a formula
 * could describe a calculation the code had stopped performing and nothing would notice. That is
 * the same defect as a basis drawer restating provenance by hand, one level down.
 *
 * `formulaExpr` is the machine-checkable form: an arithmetic expression over registry ids. This
 * gate evaluates each one against the registry's own published values and requires the result to
 * match. It closes the loop the registry was built for — the dependency EDGES are measured by
 * perturbing the engine, and the ARITHMETIC on those edges is verified here.
 *
 *   F1 EVALUATES   every formulaExpr parses, references only registered ids, and produces the
 *                  published value within the rounding the engine applies.
 *   F2 ACCOUNTED   every DERIVED parameter either carries a formulaExpr or states in
 *                  `formulaNotExpressible` why it cannot. A derived value with neither is an
 *                  unexplained number, which is what this whole programme removes.
 *   F3 NO SELF-REF a formula may not reference the parameter it defines.
 *   F4 DEPS AGREE  every id a formula references must appear in that parameter's declared deps
 *                  (or be a scalar constant). A formula and a dependency list that disagree
 *                  cannot both be right.
 *
 * Run: node tools/test-conv-formula.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const registry = JSON.parse(await readFile(join(ROOT, 'data', 'conv-parameters.json'), 'utf8'));
const byId = new Map(registry.parameters.map((p) => [p.id, p]));

/* A deliberately tiny evaluator. It accepts numbers, registry ids, + - * / ( ) and ceil(), and
   nothing else — no eval(), no property access, no way for a registry entry to run code. */
function tokenize(expr) {
    const tokens = expr.match(/ceil|\(|\)|[+\-*/]|[A-Za-z_][\w.]*|\d+(?:\.\d+)?/g);
    assert.ok(tokens, `formula produced no tokens: ${expr}`);
    assert.equal(tokens.join(' ').replace(/\s+/g, ''), expr.replace(/\s+/g, ''),
        `formula contains characters this evaluator does not accept: ${expr}`);
    return tokens;
}

function evaluate(tokens, resolve, expr) {
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function primary() {
        const token = next();
        assert.ok(token !== undefined, `unexpected end of formula: ${expr}`);
        if (token === '(') {
            const value = additive();
            assert.equal(next(), ')', `unbalanced parentheses in: ${expr}`);
            return value;
        }
        if (token === 'ceil') {
            assert.equal(next(), '(', `ceil must be called: ${expr}`);
            const value = additive();
            assert.equal(next(), ')', `unbalanced parentheses in: ${expr}`);
            return Math.ceil(value);
        }
        if (token === '-') return -primary();
        if (/^\d/.test(token)) return Number(token);
        return resolve(token);
    }
    function multiplicative() {
        let value = primary();
        while (peek() === '*' || peek() === '/') {
            const op = next();
            const rhs = primary();
            value = op === '*' ? value * rhs : value / rhs;
        }
        return value;
    }
    function additive() {
        let value = multiplicative();
        while (peek() === '+' || peek() === '-') {
            const op = next();
            const rhs = multiplicative();
            value = op === '+' ? value + rhs : value - rhs;
        }
        return value;
    }
    const result = additive();
    assert.equal(pos, tokens.length, `trailing tokens in formula: ${expr}`);
    return result;
}

let checked = 0;
const unexplained = [];

for (const p of registry.parameters) {
    /* ── F2 ── */
    if (p.kind === 'derived' && !p.formulaExpr && !p.formulaNotExpressible) {
        unexplained.push(p.id);
        continue;
    }
    if (!p.formulaExpr) continue;

    const tokens = tokenize(p.formulaExpr);
    const referenced = new Set(tokens.filter((t) => /^[A-Za-z_]/.test(t) && t !== 'ceil'));

    /* ── F3 ── */
    assert.ok(!referenced.has(p.id),
        `${p.id}: its formula references itself`);

    /* ── F4 ── */
    const declared = new Set(p.deps || []);
    for (const ref of referenced) {
        assert.ok(byId.has(ref),
            `${p.id}: formula references "${ref}", which is not a registered parameter`);
        assert.ok(declared.has(ref),
            `${p.id}: formula uses ${ref} but does not declare it as a dependency — a formula `
            + 'and a dependency list that disagree cannot both be right');
    }

    /* ── F1 ── */
    const value = evaluate(tokens, (id) => {
        const target = byId.get(id);
        const v = Number(target.value);
        assert.ok(Number.isFinite(v), `${p.id}: dependency ${id} has no numeric value`);
        return v;
    }, p.formulaExpr);

    const published = Number(p.value);
    assert.ok(Number.isFinite(published), `${p.id}: is derived but publishes no number`);
    /* The engine rounds when it publishes (round1/round2), and a formula built from ALREADY
       ROUNDED dependencies accumulates a little more. Allow 0.5 % or half a display unit,
       whichever is larger — far tighter than any real drift, and it still catches a formula
       that describes a different calculation. */
    const tolerance = Math.max(Math.abs(published) * 0.005, 0.05);
    assert.ok(Math.abs(value - published) <= tolerance,
        `${p.id}: formula "${p.formulaExpr}" evaluates to ${value} but the engine publishes `
        + `${published} — the stated arithmetic is not the arithmetic being performed`);
    checked += 1;
}

assert.equal(unexplained.length, 0,
    `derived parameters with neither a formulaExpr nor a stated reason: ${unexplained.join(', ')}`);

const stated = registry.parameters.filter((p) => p.formulaNotExpressible).length;
console.log(`PASS Conventional formulas — ${checked} declared formulas evaluated against the `
    + `engine's published values; ${stated} derived parameters carry a stated reason for having `
    + 'no machine-checkable form');
