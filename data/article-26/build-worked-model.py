#!/usr/bin/env python3
"""
Generate worked-model-scenarios.csv for article-26 ("The Invisible Leak").

This is the article's own fluid-loss model evaluated across a grid of
fluid charge x make-up rate x fluid type. It is ILLUSTRATIVE-BUT-RIGOROUS:
the per-fluid constants are representative published/vendor values (see the
`source` notes), and the arithmetic is exactly the model described in the
article's "Worked Models" section. Re-run to regenerate.

    annual_loss_L   = charge_L * makeup_rate_pct / 100
    annual_loss_kg  = annual_loss_L * density_kg_per_L
    replacement_usd = annual_loss_L * price_usd_per_L
    co2e_tonnes     = annual_loss_kg * gwp100 / 1000
    tfa_kg_per_yr   = annual_loss_kg * tfa_molar_yield      # HFO fluids only
"""
import csv

# Representative per-fluid constants. density kg/L, price $/L (midpoints),
# gwp100 (100-yr), tfa_molar_yield = MW(TFA)/MW(parent) x fraction-to-TFA.
FLUIDS = [
    # key,           label,                 type,  density, price, gwp100, tfa_yield, source
    ("novec-7000",  "3M Novec 7000 (HFE-7000)", "pfas", 1.40, 70, 320,   0.0,   "3M datasheet; HFE GWP representative"),
    ("galden-ht",   "Solvay Galden HT-series (PFPE)", "pfas", 1.70, 90, 10000, 0.0, "Syensqo datasheet; PFPE GWP ~10,000"),
    ("opteon-2p50", "Chemours Opteon 2P50 (HFO-1336mzz-Z)", "hfo", 1.37, 60, 10, 0.695, "Chemours; MW 114/164, ~1 mol TFA/mol at 100%"),
]

CHARGES = list(range(100, 5001, 100))          # 100..5000 L, 50 steps
MAKEUP  = [round(0.5 + 0.5 * i, 1) for i in range(40)]  # 0.5..20.0 %/yr, 40 steps

ROWS = []
for key, label, ftype, dens, price, gwp, yld, src in FLUIDS:
    for charge in CHARGES:
        for mk in MAKEUP:
            loss_L = charge * mk / 100.0
            loss_kg = loss_L * dens
            cost = loss_L * price
            co2e_t = loss_kg * gwp / 1000.0
            tfa = loss_kg * yld
            ROWS.append({
                "fluid_key": key,
                "fluid_label": label,
                "fluid_type": ftype,
                "charge_L": charge,
                "makeup_rate_pct_per_yr": mk,
                "density_kg_per_L": dens,
                "price_usd_per_L": price,
                "gwp100": gwp,
                "tfa_molar_yield": yld,
                "annual_loss_L": round(loss_L, 2),
                "annual_loss_kg": round(loss_kg, 2),
                "replacement_cost_usd": round(cost, 2),
                "co2e_tonnes_per_yr": round(co2e_t, 3),
                "tfa_kg_per_yr": round(tfa, 2),
                "constants_source": src,
            })

FIELDS = ["fluid_key","fluid_label","fluid_type","charge_L","makeup_rate_pct_per_yr",
          "density_kg_per_L","price_usd_per_L","gwp100","tfa_molar_yield",
          "annual_loss_L","annual_loss_kg","replacement_cost_usd","co2e_tonnes_per_yr",
          "tfa_kg_per_yr","constants_source"]

with open("worked-model-scenarios.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    w.writerows(ROWS)

print(f"wrote worked-model-scenarios.csv with {len(ROWS)} rows")
