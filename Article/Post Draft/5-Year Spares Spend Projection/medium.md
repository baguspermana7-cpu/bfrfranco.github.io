# Three Compounding Forces That Blow Up Your Spares Budget by Year 4

(74-char title: "Three Compounding Forces That Blow Up Your Spares Budget")

Fleet growth, equipment ageing, and parts cost inflation are three separate compounding processes that all hit your spares budget simultaneously. Most organisations model them independently — a flat headcount multiplier here, a 5% annual uplift there — and miss the interaction.

Critical Spares Engine v1.18.14 adds a 5-Year Spend Projection tab that models all three together, year by year, across eight DC commodity classes.

The formula is straightforward: for each year Y, installed base scales as base x (1+growth)^Y; failure rates drift as (1+drift)^Y as equipment ages beyond its early-life period; and unit costs inflate as (1+inflation)^Y from tariffs, supply chain pressure, and OEM pricing. For each commodity class, annual spend is failure_rate x installed_base x unit_cost x share, compounded by both drift and inflation multipliers.

The eight classes — Chillers, Transformers / Switchgear, UPS Systems, PDU / Floor Distribution, Network, Mechanical, Sensors / Controls, and Consumables — use industry-calibrated defaults. Four commodity mix profiles (balanced, chiller-heavy, electrical-heavy, IT-heavy) let you match your facility's actual footprint.

The output is a stacked area chart across the horizon, a data table with cumulative spend, and four KPI cards. The "Growth vs Year 0" card is usually the most sobering number in the room.

Try it free at resistancezero.com/spares-readiness-calculator.html
