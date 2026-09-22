#!/usr/bin/env python3
"""
Gate for the datasets this site publishes for download.

WHY THIS EXISTS

`data/article-26/fluid-properties.csv` is offered to readers as a downloadable
dataset, which means a stranger loads it into pandas and trusts what comes out.
In one week it carried two independent defects, neither visible by reading it:

  1. Novec 7000's vapour-pressure cell held NOVEC 7100's value. One row's number
     written onto another's row. The article, the glossary, seven unpublished
     social drafts and every generated artefact inherited it.
  2. FOUR rows mis-parsed for every CSV consumer, because chemical names like
     `cis-1,1,1,4,4,4-hexafluoro-2-butene` contain unquoted commas. Those rows
     silently shifted their columns: R-1234yf reported a chemical formula where
     its boiling point should be. Reading the file in a text editor shows
     nothing wrong.

So this gate does what a reader cannot do by eye: it parses each file the way a
consumer will, and where a table's own columns constrain each other, it checks
them against each other.

THREE CHECKS

  STRUCTURE  every row of EVERY published CSV must have exactly the header's
             column count. A row that does not is corrupt for every downstream
             consumer, full stop. This runs across all of `data/**` rather than
             over one file, because the defect is a property of hand-edited
             delimited text and not of any particular subject matter — the four
             broken rows were all chemical names, but the next one will not be.

  PHYSICS    boiling point and vapour pressure at 25 C are not independent. For
             a pure liquid, Trouton's rule gives the enthalpy of vaporisation
             from the boiling point alone (dHvap ~ 88 J/(mol K) x Tb), and
             Clausius-Clapeyron then predicts p_sat(25 C). Needing only the
             boiling point makes it a genuinely independent check on the
             pressure cell — which is exactly what the Novec 7000 defect needed
             and did not have.

             Validated on the fluids whose datasheets were read directly:
             Novec 7000 0.88x, Novec 649 0.93x, Novec 7100 0.96x, and
             perfluorohexane 0.89x. All within 15 %.

  DEFINITIONS
             Where a table's columns are related BY DEFINITION, assert it. In
             `data/fire/clean-agent-properties.csv` a design concentration
             cannot be below the concentration that extinguishes, and a
             no-observed-adverse-effect level cannot exceed the LOWEST-observed
             one. Those hold regardless of which standard is being followed, so
             they can be gated without one in hand. Deliberately NOT gated: the
             1.2x class-A safety factor and the occupied-space design<=NOAEL
             rule, both of which are NFPA 2001 provisions with exceptions I have
             not read. Asserting a compliance rule from memory is the same
             mistake this whole gate exists because of.

MIXTURES ARE DECLARED, NOT SKIPPED

Trouton's rule is for pure liquids. A PFPE cut or a PFTBA blend has no single
normal boiling point — the figure on the label is a nominal mid-cut, the light
ends flash off first, and the measured vapour pressure sits far below what a
pure compound boiling at that temperature would show. Those rows are listed
below BY NAME with the reason, so exempting one is a decision someone made and
can be argued with, rather than a silent pass.

Notably, the split is exact: every pure compound in the table passes, and every
row that fails is a mixture. That is the evidence the method works, and it is
also why a blanket "skip anything that looks like a mixture" would have been
the wrong design — it would have hidden the very pattern that validates it.

Run:  python3 tools/audit-fluid-properties.py [--strict]
"""
import csv
import io
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / 'data' / 'article-26' / 'fluid-properties.csv'
FIRE = ROOT / 'data' / 'fire' / 'clean-agent-properties.csv'

R_GAS = 8.314
P_ATM_KPA = 101.325
TROUTON = 88.0          # J/(mol K), entropy of vaporisation for a normal liquid

# Ratio band for stated/predicted. Wide on purpose: Trouton is a rule of thumb,
# and the point is to catch a value that belongs to a different substance, not
# to referee the third significant figure.
LOW, HIGH = 0.4, 2.5

# Rows exempt from the PHYSICS check, each with the reason it is exempt.
MIXTURES = {
    'Galden HT55': 'perfluoropolyether, a polydisperse cut; "HT55" is a nominal '
                   'mid-cut temperature, not a normal boiling point',
    'Galden HT70': 'perfluoropolyether, same reason as HT55',
    'Fluorinert FC-40': 'a perfluorotri-n-butylamine BLEND, as its own '
                        'chemical_name cell says',
    'Mineral oil (single-phase)': 'a hydrocarbon cut with no single boiling '
                                  'point; the table gives ">300" and '
                                  '"negligible", neither of them a number',
}

UNITS = {'hpa': 0.1, 'kpa': 1.0, 'bar': 100.0, 'mpa': 1000.0, 'psi': 6.89476}


def parse_pressure_kpa(cell):
    m = re.match(r'~?\s*([\d.]+)\s*(hPa|kPa|bar|MPa|psi)\s*$', cell.strip(), re.I)
    if not m:
        return None
    return float(m.group(1)) * UNITS[m.group(2).lower()]


def parse_temp_c(cell):
    m = re.match(r'[<>~]?\s*(-?[\d.]+)\s*$', cell.strip())
    return float(m.group(1)) if m else None


def predicted_p25_kpa(bp_c):
    """Clausius-Clapeyron from the boiling point alone, via Trouton's rule."""
    tb = bp_c + 273.15
    dh = TROUTON * tb
    return P_ATM_KPA * math.exp(-dh / R_GAS * (1 / 298.15 - 1 / tb))


def read_rows(path):
    import csv as _csv
    return list(_csv.reader(io.StringIO(path.read_text(encoding='utf-8', errors='replace'))))


def check_structure_everywhere(failures):
    """Every published CSV, parsed the way a consumer will parse it."""
    files = sorted(ROOT.glob('data/**/*.csv')) + sorted(ROOT.glob('*.csv'))
    total_rows = 0
    for f in files:
        rows = read_rows(f)
        if not rows:
            continue
        ncol = len(rows[0])
        total_rows += len(rows) - 1
        for i, r in enumerate(rows[1:], start=2):
            if not any(c.strip() for c in r):
                continue                      # a blank trailing line is not a row
            if len(r) != ncol:
                failures.append(
                    f'{f.relative_to(ROOT)} line {i}: {len(r)} columns, expected '
                    f'{ncol} — this row mis-parses for every CSV consumer. Quote '
                    f'any field containing a comma. First cell: {r[0][:40]!r}')
    return len(files), total_rows


def num(cell):
    try:
        return float(cell.strip())
    except (ValueError, AttributeError):
        return None


def check_fire_definitions(failures):
    """Relations that hold by definition, so they need no standard in hand.

    Blank cells are skipped rather than read as zero: CO2 legitimately carries no
    NOAEL because it is lethal at design concentration, and its own source cell
    says so. A blank means not applicable, and coercing it to 0 would invent a
    passing comparison out of missing data.
    """
    rows = read_rows(FIRE)
    hdr = rows[0]
    idx = {k: hdr.index(k) for k in
           ('agent', 'design_conc_classA_pct', 'min_extinguish_pct',
            'noael_pct', 'loael_pct')}
    checked = 0
    for r in rows[1:]:
        if len(r) != len(hdr):
            continue
        name = r[idx['agent']]
        design = num(r[idx['design_conc_classA_pct']])
        minext = num(r[idx['min_extinguish_pct']])
        noael = num(r[idx['noael_pct']])
        loael = num(r[idx['loael_pct']])
        if design is not None and minext is not None:
            checked += 1
            if design < minext:
                failures.append(
                    f'{name}: design concentration {design}% is below the '
                    f'{minext}% that extinguishes. A design concentration that '
                    f'does not extinguish is not a design concentration.')
        if noael is not None and loael is not None:
            checked += 1
            if noael > loael:
                failures.append(
                    f'{name}: NOAEL {noael}% exceeds LOAEL {loael}%. The '
                    f'no-observed-adverse-effect level cannot be above the '
                    f'lowest observed one; one of the two cells is wrong.')
    return checked


def main():
    strict = '--strict' in sys.argv
    rows = list(csv.reader(io.StringIO(CSV.read_text(encoding='utf-8'))))
    header, data = rows[0], rows[1:]
    ncol = len(header)
    failures, notes = [], []

    print('── PUBLISHED DATASETS ──\n')

    # ------------------------------------------------- structure, every dataset
    nfiles, nrows = check_structure_everywhere(failures)
    if not failures:
        print(f'  ✓ structure     {nrows:,} rows across {nfiles} CSV files parse to '
              f'their own header width')

    # ------------------------------------------------- definitional relations
    nfire = check_fire_definitions(failures)
    if not any(f.startswith(('Novec 1230', 'FM-200', 'IG-', 'CO2')) for f in failures):
        print(f'  ✓ definitions   {nfire} clean-agent relations hold '
              f'(design ≥ extinguishing, NOAEL ≤ LOAEL)')

    print(f'\n  fluid physics · {CSV.relative_to(ROOT)} · {len(data)} rows')

    # ---------------------------------------------------------------- physics
    idx = {k: header.index(k) for k in ('fluid', 'boiling_point_C', 'vapor_pressure_25C')}
    checked = 0
    print()
    for r in data:
        if len(r) != ncol:
            continue
        name = r[idx['fluid']]
        if name in MIXTURES:
            notes.append(f'  – {name:<28} exempt: {MIXTURES[name]}')
            continue
        bp = parse_temp_c(r[idx['boiling_point_C']])
        p25 = parse_pressure_kpa(r[idx['vapor_pressure_25C']])
        if bp is None or p25 is None:
            failures.append(
                f'{name}: boiling point {r[idx["boiling_point_C"]]!r} or vapour '
                f'pressure {r[idx["vapor_pressure_25C"]]!r} is not a number and the '
                f'row is not declared a mixture. Either give numbers or add it to '
                f'MIXTURES with a reason.')
            continue
        pred = predicted_p25_kpa(bp)
        ratio = p25 / pred
        checked += 1
        ok = LOW <= ratio <= HIGH
        mark = '✓' if ok else '✗'
        print(f'  {mark} {name:<28} bp {bp:>6.1f} °C   stated {p25:>7.2f} kPa   '
              f'Trouton {pred:>7.2f} kPa   ×{ratio:.2f}')
        if not ok:
            failures.append(
                f'{name}: vapour pressure {p25:.2f} kPa is ×{ratio:.2f} of the '
                f'{pred:.2f} kPa a pure liquid boiling at {bp:.1f} °C should show. '
                f'Either the cell belongs to a different substance, or this row is '
                f'a mixture and should say so in MIXTURES.')

    if notes:
        print('\n  declared mixtures, exempt from the physics check:')
        for n in notes:
            print(n)

    print()
    if failures:
        print(f'FAIL — {len(failures)} problem(s)\n')
        for f in failures:
            print('  ' + f)
        return 1 if strict else 0
    print(f'PASS — {nrows:,} rows across {nfiles} datasets parse cleanly; {nfire} '
          f'clean-agent relations hold;\n       {checked} pure compounds agree with '
          f'Clausius-Clapeyron from their boiling points alone,\n       '
          f'{len(notes)} declared mixtures exempt.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
