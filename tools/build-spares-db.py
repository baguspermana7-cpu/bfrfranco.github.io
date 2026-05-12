#!/usr/bin/env python3
"""
build-spares-db.py — Data-Center M&E Spare-Parts Database generator
====================================================================
Generates `data/spares-parts.sqlite` from `tools/spares-db-schema.sql` plus a
rich set of realistic part archetypes covering the full DC equipment landscape:
legacy raised-floor enterprise DCs → cloud hyperscale → AI-factory (liquid-cooled).

Also exports:
  · data/spares-parts.csv.gz       (gzipped CSV of the parts table — gitignored)
  · data/spares-oems.csv           (small, committed)
  · data/spares-taxonomy.csv       (small, committed)
  · data/spares-facility-types.csv (small, committed)
  · js/spares-parts-catalog.js     (curated ≤300 KB subset for the in-browser calculator)

Stdlib only. Deterministic (seeded RNG) — same --scale → same DB.

Usage:
    python3 tools/build-spares-db.py --scale 1 --audit
    python3 tools/build-spares-db.py --scale 5         # ~5x rows
    python3 tools/build-spares-db.py --scale 20 --audit  # toward millions
"""
from __future__ import annotations
import argparse
import csv
import gzip
import json
import math
import random
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "tools" / "spares-db-schema.sql"
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "spares-parts.sqlite"
SEED = 20260512

# ---------------------------------------------------------------------------
# DC facility types (small fixed table)
# ---------------------------------------------------------------------------
FACILITY_TYPES = [
    # id, name, era, it_mw_min, it_mw_max, pue, cooling_arch, power_arch, rack_kw_min, rack_kw_max, key_equipment, notes
    ("legacy-raised-floor", "Legacy Raised-Floor DC", "1995-2010", 0.2, 5.0, 2.0,
     "perimeter CRAC/CRAH; raised-floor plenum; chilled water or DX; no containment",
     "N or N+1", 1.5, 6.0,
     "perimeter CRAC; raised-floor tiles; legacy PDU breakers; flooded VRLA UPS; FM-200 panels; legacy DDC",
     "Often Tier II equivalent; high PUE; many parts now NRND/obsolete."),
    ("enterprise-tier3", "Enterprise Tier III", "2005-2020", 1.0, 15.0, 1.6,
     "in-row or perimeter cooling; hot-aisle containment; chilled water; concurrently maintainable",
     "N+1 (concurrently maintainable)", 4.0, 12.0,
     "static UPS modules; MV/LV switchgear; ATS/STS; diesel gensets; air-cooled or water-cooled chillers; CRAH; BMS DDC; VESDA",
     "Uptime Tier III; the bulk of enterprise/colo DC stock."),
    ("colo-wholesale", "Colocation / Wholesale DC", "2010-now", 5.0, 80.0, 1.45,
     "in-row + hot-aisle containment; water-cooled chillers + economizer; some rear-door HX",
     "N+1 to 2N (block-redundant)", 6.0, 20.0,
     "modular UPS galleries; medium-voltage switchgear; busway; large chiller plants; cooling towers; STS for dual-cord; FACP",
     "Multi-tenant wholesale; standardized blocks; rapid build cadence."),
    ("cloud-hyperscale", "Cloud Hyperscale Campus", "2012-now", 30.0, 300.0, 1.2,
     "free-cooling economizer; evaporative/adiabatic; rear-door HX; some direct-to-chip on AI rows",
     "distributed-redundant; 2N where required", 8.0, 40.0,
     "OEM/ODM UPS or DC-bus; 415V/400V busway; large air-handling units; dry coolers; adiabatic coolers; OEM BMS; clean-agent",
     "Lean, custom-engineered; tight supplier partnerships; long lead-time M&E."),
    ("ai-factory-liquid-cooled", "AI Factory (Liquid-Cooled)", "2023-now", 20.0, 500.0, 1.1,
     "direct-to-chip liquid (CDU); rear-door HX; immersion (single/two-phase); facility water loop + dry coolers",
     "2N power + N+1 cooling; block-redundant", 40.0, 250.0,
     "CDU coolant distribution units; cold plates; cooling manifolds; dielectric coolant filters; 415V busway taps for 100kW+ racks; high-density UPS or DC-bus; large dry coolers; leak detection",
     "Highest rack density; emerging supply chain; many specialist OEMs; liquid-cooling parts are the new critical class."),
    ("edge-micro", "Edge / Micro-DC", "2018-now", 0.01, 1.0, 1.5,
     "self-contained in-rack cooling; DX or chilled water; sealed enclosure",
     "N or N+1", 2.0, 10.0,
     "in-rack cooling units; small UPS; mini PDU; environmental sensors; remote monitoring; small fire suppression",
     "Distributed micro-facilities; remote management; consumable-heavy maintenance."),
]
DC_GENS = [f[0] for f in FACILITY_TYPES]

# ---------------------------------------------------------------------------
# OEMs (real DC-equipment manufacturers + distributors + specialists + generic)
# ---------------------------------------------------------------------------
# id, name, hq, founded, commodities (short), market_position, fin_health(1-10), lead_wk, otif%, contract_models, single_source_risk, notes
OEMS = [
    ("vertiv","Vertiv","United States",2016,"UPS, switchgear, PDU, CRAC/CRAH, busway, CDU, DCIM","oem-primary",7,16,92.0,"MSA, framework","medium","Spun out of Emerson Network Power; broad critical-power + thermal portfolio."),
    ("schneider","Schneider Electric / APC","France",1836,"UPS, switchgear, PDU, busway, CRAC, BMS, EcoStruxure","oem-primary",9,14,93.0,"MSA, framework, consignment-capable","low","Largest critical-power player; EcoStruxure DCIM; APC + MGE + Square D lines."),
    ("eaton","Eaton","Ireland/US",1911,"UPS, switchgear, busway, PDU, breakers, transfer switch","oem-primary",9,14,92.0,"MSA, framework","low","Electrical-systems major; large UPS + power-distribution portfolio."),
    ("abb","ABB","Switzerland",1988,"MV/LV switchgear, transformers, breakers, drives, motors","oem-primary",9,18,90.0,"MSA, framework","low","Power & automation; MV switchgear, transformers, breakers."),
    ("siemens","Siemens","Germany",1847,"MV/LV switchgear, transformers, breakers, BMS, Desigo","oem-primary",9,20,90.0,"MSA, framework","low","SIVACON/SENTRON/8DJH switchgear; Desigo BMS; large transformers."),
    ("caterpillar","Caterpillar","United States",1925,"diesel gensets, ATS, switchgear, fuel systems","oem-primary",8,30,88.0,"MSA, framework","medium","Cat gensets via dealer network; data-center power packages."),
    ("cummins","Cummins","United States",1919,"diesel gensets, ATS, alternators, after-treatment","oem-primary",8,28,88.0,"MSA, framework","medium","Cummins/Onan gensets; PowerCommand controls."),
    ("kohler","Kohler Power","United States",1873,"diesel/gas gensets, ATS, paralleling switchgear","oem-primary",6,26,87.0,"MSA, PO-only","medium","Kohler/SDMO gensets; common in mid-size DCs."),
    ("mtu","MTU / Rolls-Royce Power Systems","Germany",1909,"diesel gensets, large engines","oem-primary",7,34,86.0,"MSA, framework","high","mtu Onsite Energy; large high-end gensets; long lead times."),
    ("generac","Generac","United States",1959,"diesel/gas gensets, modular power, ATS","oem-primary",6,20,87.0,"PO-only, framework","medium","Industrial gensets + modular power blocks."),
    ("carrier","Carrier","United States",1915,"chillers, AHU, CRAC, cooling towers, controls","oem-primary",7,18,89.0,"MSA, framework","medium","19XR/19DV centrifugal chillers; AquaForce/AquaEdge lines."),
    ("trane","Trane Technologies","Ireland/US",1885,"chillers, AHU, CRAC, cooling towers, controls","oem-primary",8,18,89.0,"MSA, framework","medium","CenTraVac/Sintesis chillers; large DC cooling installs."),
    ("daikin","Daikin Applied (McQuay)","Japan",1924,"chillers, AHU, CRAC, fan coils, VRV","oem-primary",8,20,88.0,"MSA, framework","medium","Magnitude magnetic-bearing chillers; AHU + applied systems."),
    ("johnson-controls","Johnson Controls / York","United States/Ireland",1885,"chillers, AHU, cooling towers, BMS (Metasys), fire (Tyco)","oem-primary",8,18,88.0,"MSA, framework","low","York YK/YZ chillers; Metasys BMS; Tyco fire suppression."),
    ("stulz","STULZ","Germany",1947,"CRAC/CRAH, in-row, rear-door HX, CDU, chillers","specialist",6,16,90.0,"MSA, framework","medium","Precision-cooling specialist; CyberAir/CyberRow; CDU + liquid-cooling products."),
    ("munters","Munters","Sweden",1955,"adiabatic/evaporative cooling, AHU, dehumidification","specialist",6,18,88.0,"MSA, PO-only","medium","Indirect-evaporative DC cooling (Oasis/SyCool); dehumidification."),
    ("rittal","Rittal","Germany",1961,"server racks, in-row cooling, busbar, enclosures, RDHx","oem-primary",6,12,90.0,"framework, PO-only","low","TS IT racks; LCP in-row/rear-door cooling; RiLine busbar."),
    ("legrand","Legrand","France",1865,"PDU, cable management, busway, KVM, containment","oem-primary",7,12,91.0,"framework, PO-only","low","Raritan PDU; Starline busway; Server Technology; cable management."),
    ("eaton-tripp-lite","Tripp Lite by Eaton","United States",1922,"PDU, small UPS, KVM, racks, surge","oem-primary",8,8,92.0,"PO-only, framework","low","Rack PDUs, small UPS, KVM — high-volume distribution."),
    ("russelectric","Russelectric (Siemens)","United States",1955,"ATS, paralleling switchgear, transfer switches","specialist",7,22,89.0,"MSA, PO-only","medium","Automatic transfer switches + paralleling switchgear; now Siemens."),
    ("asco","ASCO Power (Schneider)","United States",1888,"ATS, paralleling switchgear, surge, monitoring","specialist",8,18,90.0,"MSA, framework","low","ASCO 7000-series ATS; bypass-isolation switches; now Schneider."),
    ("cyberex","Cyberex","United States",1975,"STS, static transfer switches, PDU","specialist",6,20,88.0,"PO-only","medium","Static transfer switches for dual-cord loads."),
    ("camfil","Camfil","Sweden",1963,"air filters, filter housings, gas-phase filtration","specialist",5,6,90.0,"PO-only, framework","low","HEPA/MERV air filters for AHU/CRAC; consumable-heavy."),
    ("aaf","AAF International (Daikin)","United States",1921,"air filters, filter banks, housings","specialist",6,6,90.0,"PO-only, framework","low","Air filtration; filter elements consumable."),
    ("bosch-fire","Bosch Building Technologies","Germany",1886,"fire detection, VESDA-class aspiration, panels","specialist",8,12,90.0,"framework, PO-only","low","Aspirating smoke detection, fire panels, detection devices."),
    ("xtralis","Xtralis (Honeywell)","Australia",1982,"VESDA aspirating smoke detection","specialist",7,14,89.0,"framework, PO-only","medium","VESDA — the reference aspirating smoke-detection brand; now Honeywell."),
    ("honeywell","Honeywell","United States",1906,"BMS, fire (Notifier/Gamewell), controls, sensors","oem-primary",9,14,90.0,"MSA, framework","low","BMS controls, Notifier fire panels, sensors, actuators."),
    ("tyco-fire","Johnson Controls / Tyco Fire","United States",1874,"clean-agent suppression, sprinklers, fire pumps, panels","oem-primary",8,16,88.0,"MSA, framework","low","Sapphire/INERGEN clean agent; Tyco sprinklers; fire pumps."),
    ("fike","Fike","United States",1945,"clean-agent suppression, detection, explosion protection","specialist",5,18,87.0,"PO-only, framework","medium","ECARO-25/PROINERT clean-agent systems; detection."),
    ("kidde","Kidde Fire Systems (Carrier)","United States",1917,"clean-agent (FM-200/Novec), CO2, detection, panels","specialist",7,16,88.0,"framework, PO-only","low","FM-200/Novec 1230 clean-agent; ADS panels; now Carrier."),
    ("tridium","Tridium (Honeywell)","United States",1996,"Niagara BMS framework, JACE controllers","specialist",8,12,90.0,"framework, PO-only","medium","Niagara Framework; JACE supervisory controllers."),
    ("distech","Distech Controls (Acuity)","Canada",1995,"DDC controllers, BMS, IoT controls","specialist",6,12,90.0,"framework, PO-only","medium","ECLYPSE/ECB DDC controllers; Niagara-compatible."),
    ("belimo","Belimo","Switzerland",1975,"actuators, control valves, sensors, flow meters","specialist",7,8,93.0,"PO-only, framework","low","HVAC actuators + characterized control valves; energy valves."),
    ("danfoss","Danfoss","Denmark",1933,"valves, drives, compressors, sensors, heat exchangers","oem-primary",8,12,91.0,"framework, PO-only","low","Refrigeration components; drives; valves; plate HX."),
    ("grundfos","Grundfos","Denmark",1945,"pumps, pump controls, sensors","oem-primary",7,10,92.0,"framework, PO-only","low","Centrifugal/circulator pumps for chilled-water + condenser loops."),
    ("xylem","Xylem (Bell & Gossett)","United States",2011,"pumps, heat exchangers, valves, controls","oem-primary",7,12,90.0,"framework, PO-only","low","Bell & Gossett pumps; plate-and-frame HX; coil products."),
    ("armstrong","Armstrong Fluid Technology","Canada",1934,"pumps, design-envelope packages, controls","specialist",6,12,91.0,"framework, PO-only","low","Design Envelope pumping; integrated pump-controls packages."),
    ("taco","Taco Comfort Solutions","United States",1920,"pumps, heat exchangers, controls, expansion tanks","specialist",5,10,90.0,"PO-only","low","Circulator pumps; brazed-plate HX; expansion/air management."),
    ("wilo","Wilo","Germany",1872,"pumps, pump systems, controls","specialist",6,12,90.0,"framework, PO-only","low","Smart circulator + inline pumps; building-services pumping."),
    ("spirax-sarco","Spirax Sarco","United Kingdom",1888,"valves, steam/condensate, flow meters, controls","specialist",7,10,91.0,"PO-only, framework","low","Control valves; pressure-reducing valves; metering."),
    ("victaulic","Victaulic","United States",1919,"grooved pipe couplings, valves, fittings","specialist",6,8,91.0,"PO-only, framework","low","Grooved mechanical pipe joining; valves; fittings — chilled-water + fire pipework."),
    ("swagelok","Swagelok","United States",1947,"tube fittings, valves, hoses, regulators","specialist",7,6,93.0,"PO-only, framework","low","Tube fittings + instrumentation valves — coolant + sensor lines."),
    ("parker","Parker Hannifin","United States",1917,"fittings, hoses, filters, valves, seals","oem-primary",8,10,91.0,"framework, PO-only","low","Hydraulic/fluid-connector products; filtration; seals."),
    ("coolit","CoolIT Systems","Canada",2001,"direct-to-chip liquid cooling, CDU, cold plates, manifolds","specialist",5,16,88.0,"framework, PO-only","high","Direct-to-chip liquid cooling for AI/HPC; CDU + cold plates."),
    ("asetek","Asetek","Denmark",1997,"direct-to-chip liquid cooling, cold plates, CDU","specialist",4,18,86.0,"framework, PO-only","high","D2C liquid cooling; cold plates; rack-level CDU."),
    ("boyd","Boyd Corporation","United States",1928,"cold plates, heat exchangers, thermal interface, CDU","specialist",5,16,87.0,"framework, PO-only","high","Liquid cold plates; brazed HX; thermal-management assemblies."),
    ("motivair","Motivair (Schneider)","United States",1988,"CDU, rear-door HX, chillers, dry coolers","specialist",6,16,88.0,"framework, PO-only","medium","CDUs + rear-door heat exchangers + chillers for HPC; now Schneider."),
    ("zutacore","ZutaCore","Israel",2016,"two-phase direct-to-chip cooling, HyperCool","specialist",3,20,84.0,"framework, PO-only","high","Two-phase D2C liquid cooling for AI; waterless dielectric."),
    ("iceotope","Iceotope","United Kingdom",2005,"precision immersion (chassis-level) cooling","specialist",3,20,84.0,"framework, PO-only","high","Chassis-level precision immersion; KU:L systems."),
    ("grc","GRC (Green Revolution Cooling)","United States",2009,"single-phase immersion cooling systems","specialist",4,18,85.0,"framework, PO-only","high","Single-phase immersion tanks (ICEraQ/ICEtank); dielectric fluid."),
    ("liquidstack","LiquidStack","United States",2012,"two-phase immersion cooling, CDU","specialist",3,20,84.0,"framework, PO-only","high","Two-phase immersion + D2C; CDUs; partnered with Trane."),
    ("submer","Submer","Spain",2015,"single/two-phase immersion cooling, SmartPodX","specialist",3,20,84.0,"framework, PO-only","high","Immersion cooling pods; SmartCoolant dielectric fluid."),
    ("nvent","nVent (Hoffman/Schroff/Erico)","United Kingdom",2018,"enclosures, busbar, cable management, grounding","oem-primary",7,12,90.0,"framework, PO-only","low","Hoffman enclosures; Schroff racks; Erico grounding; busbar."),
    ("chatsworth","Chatsworth Products (CPI)","United States",1991,"server racks, containment, cable management, PDU","specialist",5,10,90.0,"framework, PO-only","low","TeraFrame racks; aisle containment; eConnect PDU."),
    ("panduit","Panduit","United States",1955,"structured cabling, racks, cable management, grounding","oem-primary",6,10,91.0,"framework, PO-only","low","Copper/fiber cabling systems; cable management; racks."),
    ("commscope","CommScope (Systimax/Uniprise)","United States",1976,"structured cabling, fiber, ODF, patch panels","oem-primary",6,12,90.0,"framework, PO-only","low","Systimax cabling; fiber distribution; high-density ODF."),
    ("corning","Corning Optical Communications","United States",1851,"fiber cable, ODF, connectors, splice modules","oem-primary",8,12,91.0,"framework, PO-only","low","Single-mode/multi-mode fiber; EDGE ODF; MTP/MPO systems."),
    ("leviton","Leviton Network Solutions","United States",1906,"structured cabling, fiber, patch panels, racks","oem-primary",6,10,91.0,"framework, PO-only","low","Atlas-X1 copper; fiber cassettes; e-Bay racks."),
    ("hpe","HPE / Cray (network/compute)","United States",2015,"network switches, interconnect, compute, Slingshot","oem-primary",8,16,89.0,"MSA, framework","medium","Slingshot interconnect; Apollo/Cray EX HPC; switches."),
    ("nvidia","NVIDIA (network)","United States",1993,"InfiniBand/Spectrum switches, NVLink, DPUs","oem-primary",10,20,88.0,"MSA, framework","high","Quantum InfiniBand + Spectrum Ethernet; NVLink switches; DGX/HGX infra."),
    ("arista","Arista Networks","United States",2004,"data-center Ethernet switches, optics","oem-primary",9,14,90.0,"framework, PO-only","medium","7000-series DC switches; EOS; high-speed optics."),
    ("cisco","Cisco Systems","United States",1984,"network switches, optics, console servers","oem-primary",9,14,90.0,"MSA, framework","low","Nexus DC switches; transceivers; UCS; console/management."),
    ("juniper","Juniper Networks (HPE)","United States",1996,"data-center switches, routers, optics","oem-primary",8,14,89.0,"framework, PO-only","medium","QFX DC switches; Junos; now HPE."),
    ("camille-bauer","Camille Bauer / GMC Instruments","Switzerland",1900,"power meters, transducers, monitoring","specialist",5,10,90.0,"PO-only","low","Power-quality meters; transducers; energy monitoring."),
    ("packet-power","Packet Power","United States",2008,"wireless power/environment monitoring, DCIM sensors","specialist",4,8,90.0,"PO-only","medium","Wireless power + environmental monitoring nodes; DCIM."),
    ("ge-grid","GE Vernova / GE Grid Solutions","United States/France",1892,"MV switchgear, transformers, protection relays","oem-primary",7,24,87.0,"MSA, framework","medium","MV switchgear (Multilin protection); medium/large transformers."),
    ("hyosung","HD Hyundai Electric / Hyosung Heavy","South Korea",1962,"transformers, MV switchgear, GIS","oem-primary",6,28,86.0,"MSA, framework","high","Power transformers; GIS; MV switchgear — long lead times."),
    ("powell","Powell Industries","United States",1947,"MV switchgear, bus duct, control buildings","specialist",6,26,87.0,"MSA, framework","medium","Custom MV switchgear; e-houses; integrated power packages."),
    ("nidec","Nidec / Leroy-Somer","Japan/France",1973,"motors, alternators, drives, pumps","oem-primary",7,14,89.0,"framework, PO-only","low","Industrial motors + alternators (genset ends); drives."),
    ("weg","WEG","Brazil",1961,"motors, drives, transformers, switchgear","oem-primary",7,16,89.0,"framework, PO-only","low","Industrial motors; drives; transformers; LV switchgear."),
    ("franklin","Franklin Electric / Pioneer Pump","United States",1944,"pumps, motors, controls","specialist",5,12,89.0,"PO-only","low","Submersible/surface pumps; motors; controls."),
    ("bell-gossett","Bell & Gossett (Xylem)","United States",1916,"pumps, heat exchangers, air separators, valves","specialist",7,12,90.0,"framework, PO-only","low","HVAC pumps; brazed-plate + plate-and-frame HX; hydronic accessories."),
    ("alfa-laval","Alfa Laval","Sweden",1883,"plate heat exchangers, valves, separation","oem-primary",8,12,91.0,"framework, PO-only","low","Gasketed/brazed/welded plate HX — chilled-water + free-cooling + D2C facility loops."),
    ("kelvion","Kelvion","Germany",2015,"heat exchangers, dry coolers, condensers","specialist",6,16,88.0,"framework, PO-only","medium","Plate + finned-tube HX; dry coolers; adiabatic coolers (ex-GEA HX)."),
    ("guntner","Güntner","Germany",1931,"dry coolers, condensers, evaporators, adiabatic","specialist",6,16,88.0,"framework, PO-only","medium","Finned-tube dry coolers; adiabatic coolers — free-cooling + facility loops."),
    ("baltimore-aircoil","Baltimore Aircoil (BAC)","United States",1938,"cooling towers, evaporative condensers, closed-circuit coolers","oem-primary",7,16,89.0,"framework, PO-only","medium","Open/closed-circuit cooling towers; evaporative fluid coolers."),
    ("spx-cooling","SPX Cooling (Marley)","United States",1922,"cooling towers, fluid coolers, fans, fill","oem-primary",7,16,88.0,"framework, PO-only","medium","Marley cooling towers; fill media; gearboxes; fans."),
    ("evapco","EVAPCO","United States",1976,"cooling towers, evaporative condensers, closed-circuit coolers","oem-primary",7,16,89.0,"framework, PO-only","medium","Evaporative cooling equipment; closed-circuit coolers."),
    ("victaulic-fire","Victaulic Fire","United States",1919,"fire-protection valves, couplings, sprinkler fittings","specialist",6,8,91.0,"PO-only","low","Grooved fire-protection products; valves; couplings."),
    ("viking-fire","Viking Group","United States",1921,"sprinklers, fire-protection valves, fire pumps","specialist",5,12,89.0,"PO-only, framework","low","Sprinkler heads; deluge/alarm valves; fire-pump packages."),
    ("pentair-fire","Pentair (Aurora/Hydromatic fire pumps)","United Kingdom",2000,"fire pumps, jockey pumps, pump packages","specialist",6,14,89.0,"framework, PO-only","medium","Fire-pump packages; jockey pumps; controllers."),
    ("generic-mech","Generic / Third-Party Mechanical","International",None,"bearings, seals, belts, filters, gaskets, fasteners","generic",4,4,85.0,"PO-only","medium","Commodity mechanical consumables — multiple interchangeable sources."),
    ("generic-elec","Generic / Third-Party Electrical","International",None,"breakers, contactors, relays, fuses, terminals, cable","generic",4,4,85.0,"PO-only","medium","Commodity electrical components — multiple interchangeable sources."),
    ("generic-fluid","Generic / Third-Party Fluid","International",None,"hoses, fittings, gauges, strainers, valves, gaskets","generic",4,3,85.0,"PO-only","low","Commodity fluid-system components — multiple interchangeable sources."),
    ("refurb-pool","Certified Refurbished / Harvested Pool","International",None,"refurbished modules harvested from decommissioned equipment","specialist",3,2,80.0,"PO-only","high","Reclaimed/refurbished parts from decommissioned DCs — circular-economy sourcing."),
    # NEW OEMs added in enrichment pass
    ("staubli","Stäubli","Switzerland",1909,"quick-disconnect couplings, tooling connectors, liquid cooling fittings","specialist",7,8,92.0,"PO-only, framework","low","Precision quick-disconnect couplings; dripless fluid connectors for liquid-cooling loops."),
    ("cpc-colder","CPC / Colder Products (Dover)","United States",1978,"quick-disconnect couplings, push-to-connect fittings, manifolds","specialist",6,6,91.0,"PO-only, framework","low","Plastic & stainless quick-disconnects; push-to-connect; biopharm & DC liquid-cooling."),
    ("goulds-itt","Goulds Pumps / ITT","United States",1848,"centrifugal pumps, vertical turbines, submersible pumps","oem-primary",7,12,90.0,"framework, PO-only","low","Goulds/ITT end-suction + split-case + vertical inline pumps for HVAC & fire service."),
    ("ksb","KSB","Germany",1871,"centrifugal pumps, valves, pump systems","oem-primary",7,14,90.0,"framework, PO-only","low","EtaLine/Etanorm centrifugal pumps; ZETA valves; large-facility chilled-water loops."),
    ("flowserve","Flowserve","United States",1997,"industrial pumps, valves, mechanical seals, actuators","oem-primary",7,14,89.0,"framework, PO-only","low","Durco/Mark 3 pumps; Valtek/Durcoflow control valves; mechanical seals for large CHW systems."),
    ("watts-water","Watts Water Technologies","United States",1874,"pressure-reducing valves, backflow preventers, balancing valves, check valves","specialist",6,8,91.0,"PO-only, framework","low","PRV, BFP, balancing valves, thermostatic mixing; commercial building water systems."),
    ("apollo-valves","Apollo Valves (Aalberts)","United States",1928,"ball valves, check valves, butterfly valves, backflow preventers","specialist",5,6,91.0,"PO-only","low","High-cycle ball valves; fire-rated valves; HVAC isolation and check valves."),
    ("spraying-systems","Spraying Systems Co.","United States",1937,"spray nozzles, headers, cooling-tower nozzles, misting systems","specialist",4,6,90.0,"PO-only","low","Cooling-tower spray nozzles; adiabatic-cooler misting heads; clean-in-place spray headers."),
    ("marlo-culligan","Marlo / Culligan Industrial","United States",1936,"water softeners, dealkalizers, filtration, water-treatment systems","specialist",5,8,88.0,"PO-only, framework","medium","Industrial water treatment, softening, deionization, filtration for condenser & cooling-tower loops."),
    ("donaldson","Donaldson Company","United States",1915,"industrial filtration, air filters, liquid filters, hydraulic filters","oem-primary",8,6,91.0,"PO-only, framework","low","Torit dust collectors; liquid-line filters; hydraulic filtration; fuel/lube filters for gensets."),
    ("mann-hummel","MANN+HUMMEL","Germany",1941,"air filters, liquid filters, fuel filters, cabin air filtration","oem-primary",7,8,90.0,"framework, PO-only","low","Engine air/oil/fuel filter elements for gensets; HVAC filters; heavy-equipment filtration OEM."),
    ("3m-novec","3M Novec / 3M Electronic Markets","United States",1902,"Novec 1230 clean agent, Novec 7100/7200 dielectric fluids, thermal management","specialist",9,10,91.0,"framework, PO-only","high","Novec 1230 fire suppression; Novec 7100/7200 two-phase dielectric fluids for immersion cooling."),
    ("engineered-fluids","Engineered Fluids","United States",2012,"dielectric fluids (BioNovaTek, ElectriCool), single/two-phase immersion coolants","specialist",4,8,86.0,"PO-only, framework","high","Next-gen biodegradable dielectric coolants for immersion and direct-to-chip; BioNovaTek EC-110."),
    ("afl-ofs","AFL / OFS Fitel","United States",1984,"fiber optic cable, connectors, fusion splicers, OTDR test equipment","oem-primary",7,8,91.0,"framework, PO-only","low","AFL loose-tube/ribbon fiber; OFS specialty fiber; factory-terminated assemblies; splicing tools."),
    ("belden","Belden","United States",1902,"structured cabling, industrial ethernet cable, signal cable, fiber","oem-primary",6,8,90.0,"PO-only, framework","low","Bonded-pair Cat6A/Cat8 copper; industrial Ethernet cable; fiber distribution."),
    ("siemon","Siemon","United States",1903,"structured cabling, fiber, patch panels, racks, data-center cabling systems","specialist",6,10,91.0,"framework, PO-only","low","Z-MAX Cat6A; TERA copper; high-density fiber solutions; MAP ODF systems."),
    ("marvell-tech","Marvell Technology","United States",2000,"optical transceiver ICs, PHY chips, Ethernet switch ASICs, DPUs","oem-primary",8,12,88.0,"MSA, framework","high","Marvell COLORZ-II/ALASKA C transceivers; 400G/800G PAM4 optical module chipsets; Prestera switch ASICs."),
]
OEM_IDS = {o[0] for o in OEMS}

# ---------------------------------------------------------------------------
# Commodity taxonomy (l1 system group → l2 subsystem → l3 component class)
# ---------------------------------------------------------------------------
# (l1, l2, l3, system_code, description, typical_criticality, typical_dc_generations)
TAXONOMY = [
    # ELECTRICAL
    ("Power — Critical","UPS","static UPS module","electrical","Double-conversion static UPS power module / amplifier",9,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Power — Critical","UPS","UPS rectifier/IGBT assembly","electrical","Rectifier / inverter IGBT power assembly for static UPS",9,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Critical","UPS","UPS battery string (VRLA)","electrical","Valve-regulated lead-acid battery string for UPS autonomy",8,"legacy-raised-floor,enterprise-tier3"),
    ("Power — Critical","UPS","UPS battery module (Li-ion)","electrical","Lithium-ion battery module for modern UPS",8,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Critical","UPS","UPS static bypass switch","electrical","Static bypass / SCR assembly for UPS maintenance bypass",8,"enterprise-tier3,colo-wholesale"),
    ("Power — Critical","UPS","UPS control / display board","electrical","Control logic / HMI display board for UPS",6,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Power — Distribution","switchgear","MV vacuum circuit breaker","electrical","Medium-voltage vacuum circuit breaker (5-38 kV)",9,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","switchgear","LV air circuit breaker","electrical","Low-voltage air/insulated-case circuit breaker (400-6300 A)",8,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Power — Distribution","switchgear","MV protection relay","electrical","Numerical protection relay (50/51/87/27/59) for MV switchgear",8,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Distribution","transformer","cast-resin distribution transformer","electrical","Dry-type cast-resin distribution transformer (500-3150 kVA)",8,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Distribution","transformer","oil-immersed power transformer","electrical","Oil-filled power transformer (10-100 MVA) for campus substation",9,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","transformer","transformer cooling fan / pump","electrical","Forced-air/forced-oil cooling auxiliary for power transformer",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","PDU","floor PDU transformer/breaker","electrical","Floor-mount PDU step-down transformer + distribution breakers",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Power — Distribution","PDU","rack PDU (metered/switched)","electrical","Intelligent rack power distribution unit (metered/switched)",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Power — Distribution","busway","busway / busduct section","electrical","Overhead busway run section (400-6000 A)",7,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","busway","busway plug-in tap-off unit","electrical","Plug-in tap-off / busway end-feed unit for rack supply",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Transfer","ATS","automatic transfer switch","electrical","Automatic transfer switch (open/closed transition, 100-4000 A)",8,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Transfer","ATS","ATS controller / logic board","electrical","Transfer-switch controller logic board",6,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Power — Transfer","STS","static transfer switch (SCR)","electrical","Static transfer switch for dual-cord loads (sub-cycle transfer)",8,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Reactive","capacitor-bank","power-factor capacitor bank","electrical","Automatic power-factor-correction capacitor bank",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Power — DC","battery-system","DC plant rectifier module","electrical","48 V DC plant rectifier module (telecom-style DC bus)",7,"cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Power — Metering","power-meter","revenue/PQ power meter","monitoring","Power-quality / revenue metering instrument (Class 0.2S)",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # MECHANICAL (power generation)
    ("Power — Standby Generation","diesel-generator","genset alternator (end)","mechanical","Diesel genset alternator / generator end (500-3500 kVA)",8,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","diesel-generator","genset controller / paralleling module","mechanical","Genset engine controller / paralleling switchgear module",7,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Standby Generation","diesel-generator","genset turbocharger","mechanical","Turbocharger for standby diesel genset",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Standby Generation","diesel-generator","genset jacket-water heater","mechanical","Block / jacket-water immersion heater for genset readiness",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Standby Generation","diesel-generator","genset starter / battery","mechanical","Engine starter motor / starter battery for genset",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Standby Generation","diesel-generator","genset fuel/oil/air filter set","mechanical","Fuel + oil + air filter element set for genset (consumable)",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Power — Standby Generation","fuel-system","diesel fuel transfer pump","mechanical","Day-tank / bulk-tank diesel fuel transfer pump",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","fuel-system","fuel polishing/filtration unit","mechanical","Diesel fuel polishing / filtration / water-separation unit",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Standby Generation","exhaust-system","genset exhaust silencer/SCR","mechanical","Exhaust silencer + selective-catalytic-reduction (Tier 4) module",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # COOLING
    ("Cooling — Chilled Water","chiller","centrifugal chiller compressor","cooling","Centrifugal chiller compressor (500-3000 ton)",9,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Chilled Water","chiller","magnetic-bearing chiller compressor","cooling","Oil-free magnetic-bearing chiller compressor",8,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Chilled Water","chiller","chiller control panel / VFD","cooling","Chiller microprocessor control panel / compressor VFD",7,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Chilled Water","chiller","chiller evaporator/condenser tube bundle","cooling","Shell-and-tube evaporator or condenser bundle for chiller",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Heat Rejection","cooling-tower","cooling-tower fan / gearbox","cooling","Induced/forced-draft cooling-tower fan + gear reducer",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Heat Rejection","cooling-tower","cooling-tower fill / drift eliminator","cooling","PVC fill media + drift eliminator pack for cooling tower",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Heat Rejection","dry-cooler","finned-tube dry cooler","cooling","Adiabatic / dry fluid cooler module (free-cooling + facility loop)",6,"cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Heat Rejection","dry-cooler","dry-cooler EC fan","cooling","Electronically-commutated axial fan for dry cooler / condenser",5,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Air","CRAC-CRAH","CRAC/CRAH compressor","cooling","DX compressor for computer-room air conditioner",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Cooling — Air","CRAC-CRAH","CRAC/CRAH EC fan array","cooling","Electronically-commutated fan / fan array for CRAC/CRAH",6,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Air","CRAC-CRAH","CRAC/CRAH cooling coil","cooling","Chilled-water / DX cooling coil for CRAH/CRAC",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Cooling — Air","CRAC-CRAH","CRAC/CRAH humidifier","cooling","Steam / infrared / ultrasonic humidifier module for CRAC",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Cooling — Air","CRAC-CRAH","air filter element","cooling","MERV/HEPA air filter element for CRAC/CRAH/AHU (consumable)",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Cooling — Air","CRAC-CRAH","AHU supply/return fan","cooling","Plug fan / fan-wall module for air-handling unit",6,"colo-wholesale,cloud-hyperscale"),
    ("Cooling — Air","adiabatic-cooling","adiabatic cooler media + pump","cooling","Evaporative media pad + recirculation pump for adiabatic cooler",4,"cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Liquid","CDU-coolant-distribution","coolant distribution unit (CDU) pump","cooling","Primary coolant pump for direct-to-chip CDU",8,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","CDU-coolant-distribution","CDU plate heat exchanger","cooling","Brazed-plate HX (technology↔facility loop) inside a CDU",8,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","CDU-coolant-distribution","CDU control board / leak sensor","cooling","CDU control / monitoring board with leak detection",7,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","direct-to-chip-cooling","GPU/CPU cold plate","cooling","Direct-to-chip liquid cold plate (microchannel) for GPU/CPU",7,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","cooling-manifold","rack cooling manifold","cooling","In-rack liquid-cooling distribution manifold + quick-disconnects",6,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","cooling-manifold","quick-disconnect coupling (dripless)","cooling","Dripless quick-disconnect coupling for liquid-cooling lines",6,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","direct-to-chip-cooling","dielectric / coolant filter element","cooling","Filter element / chemistry-conditioning cartridge for liquid-cooling loop",5,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","immersion-cooling","immersion-tank circulation pump","cooling","Dielectric-fluid circulation pump for immersion tank",7,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","immersion-cooling","immersion-tank heat exchanger","cooling","Coil / plate HX inside an immersion tank (fluid↔facility water)",7,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","refrigerant-circuit","two-phase immersion condenser","cooling","Condenser coil for two-phase immersion (dielectric vapour↔water)",7,"ai-factory-liquid-cooled"),
    ("Cooling — Air","RDHx","rear-door heat exchanger coil","cooling","Passive/active rear-door heat-exchanger coil for high-density racks",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","chilled-water circulation pump","cooling","Centrifugal chilled-water / condenser-water circulation pump",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","pump motor / VFD","cooling","Induction motor + variable-frequency drive for hydronic pump",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","pump mechanical seal / bearing","cooling","Mechanical shaft seal + bearing set for hydronic pump (consumable-ish)",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","valve","motorized control valve (2-way/3-way)","cooling","Characterized 2-way / 3-way control valve + actuator",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","valve","butterfly / gate isolation valve","cooling","Large isolation valve (butterfly/gate) for chilled-water headers",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","valve","pressure-independent control valve (PICV)","cooling","Pressure-independent control valve for terminal-unit balancing",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","heat-exchanger","plate-and-frame heat exchanger","cooling","Gasketed plate-and-frame HX (free-cooling / heat-recovery / facility loop)",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","heat-exchanger","HX gasket / plate set","cooling","Replacement gasket + plate set for plate-and-frame HX (consumable)",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pipework","grooved pipe coupling / fitting","cooling","Grooved mechanical pipe coupling / fitting for chilled-water + fire mains",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pipework","expansion / air-separation tank","cooling","Bladder expansion tank + air separator for hydronic loop",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pipework","strainer / Y-strainer basket","cooling","Y-strainer / basket-strainer screen for pump-protection (consumable)",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # FIRE-LIFE-SAFETY
    ("Fire — Detection","VESDA","aspirating smoke detector (VESDA)","fire-life-safety","Aspirating smoke-detection unit (very-early-warning) + sampling pipe",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Detection","smoke-detection","addressable smoke/heat detector","fire-life-safety","Addressable photoelectric/heat detector for SLC loop",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Fire — Control","fire-panel","fire alarm control panel (FACP)","fire-life-safety","Addressable fire-alarm control panel / network node",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Control","fire-panel","clean-agent release panel","fire-life-safety","Suppression-release control panel (cross-zoned, abort/manual)",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","clean-agent","clean-agent cylinder (FM-200/Novec 1230)","fire-life-safety","Pressurized clean-agent storage cylinder + valve assembly",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","gas-suppression","inert-gas (IG-541/IG-55) cylinder","fire-life-safety","Inert-gas suppression cylinder + manifold valve",7,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","clean-agent","suppression nozzle / discharge head","fire-life-safety","Clean-agent / inert-gas discharge nozzle (orifice-sized)",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","sprinkler","pre-action / deluge valve","fire-life-safety","Pre-action (double-interlock) / deluge valve assembly + trim",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","sprinkler","sprinkler head","fire-life-safety","Quick-response / standard sprinkler head (consumable on activation)",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","fire-pump","electric fire pump + controller","fire-life-safety","Horizontal split-case electric fire pump + listed controller",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","fire-pump","diesel fire pump engine","fire-life-safety","Diesel-driven fire-pump engine + controller (standby)",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","fire-pump","jockey pump","fire-life-safety","Pressure-maintenance (jockey) pump for fire main",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Life-Safety — Egress","emergency-lighting","emergency luminaire / inverter","fire-life-safety","Self-contained emergency luminaire / central-battery inverter",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    # NETWORK-ICT
    ("Network — Fabric","spine-leaf-switch","data-center leaf/spine switch","network-ict","High-radix DC Ethernet/InfiniBand leaf or spine switch",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Fabric","spine-leaf-switch","switch power supply / fan module","network-ict","Hot-swap PSU / fan tray for DC switch",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Optics","optical-transceiver","optical transceiver (QSFP-DD/OSFP/QSFP28)","network-ict","Pluggable optical transceiver (100G-800G) for DC fabric",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Cabling","fiber-ODF","optical distribution frame module / cassette","network-ict","High-density ODF cassette / MTP-MPO module",3,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Cabling","structured-cabling","fiber trunk / patch assembly","network-ict","Pre-terminated fiber trunk or patch assembly (OS2/OM4)",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Cabling","patch-panel","copper patch panel (Cat6A)","network-ict","24/48-port Cat6A patch panel + cassettes",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,edge-micro"),
    ("Network — Management","console-server","serial console / OOB management server","network-ict","Out-of-band serial console server / smart PDU controller",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Network — Management","KVM","KVM-over-IP switch","network-ict","KVM-over-IP switch / IP-KVM module for remote console",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,edge-micro"),
    # BMS-CONTROLS
    ("Controls — BMS","DDC-PLC-controller","DDC plant controller","bms-controls","Direct-digital-control plant/AHU controller (BACnet/Niagara)",6,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — BMS","DDC-PLC-controller","programmable logic controller (PLC)","bms-controls","Safety/process PLC + I/O for electrical or cooling plant",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — BMS","LDC-panel","local display controller / HMI panel","bms-controls","Local display controller / touch HMI at plant skid (chiller, e-house, BMS room)",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — BMS","BACnet-gateway","BACnet / Modbus protocol gateway","bms-controls","Protocol gateway (BACnet/IP↔Modbus↔SNMP↔Niagara)",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — BMS","SCADA-RTU","SCADA RTU / IED for EPMS","bms-controls","Remote terminal unit / IED for electrical power-monitoring SCADA",5,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","sensor","temperature / humidity sensor (room)","bms-controls","Room / supply-air temperature + humidity sensor",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Controls — Field","sensor","pressure / flow sensor (hydronic)","bms-controls","Differential-pressure / flow sensor for chilled-water loop",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","sensor","coolant leak-detection cable/sensor","bms-controls","Conductive / fluorescent leak-detection cable + controller for liquid-cooling",5,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Controls — Field","actuator","damper / valve actuator","bms-controls","Spring-return / non-spring damper or valve actuator (24V/0-10V)",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","actuator","VFD (general HVAC)","bms-controls","General-purpose variable-frequency drive for fans/pumps",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # STRUCTURAL-CIVIL
    ("Structure — White Space","raised-floor-tile","raised-floor tile / pedestal","structural-civil","Bolted-stringer raised-floor panel + pedestal / perforated tile",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Structure — White Space","server-rack","server cabinet / rack frame","structural-civil","42-52U server cabinet with doors + cable management",2,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Structure — White Space","aisle-containment","hot/cold-aisle containment panel/door","structural-civil","Aisle-containment roof/door/wall panel + auto-release",2,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Structure — Pathways","cable-tray","cable tray / ladder rack section","structural-civil","Overhead cable tray / ladder section + fittings",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Structure — Seismic","seismic-brace","seismic bracing / isolation mount","structural-civil","Seismic bracing kit / vibration-isolation mount for equipment",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # MONITORING
    ("Monitoring — DCIM","DCIM-sensor","DCIM environmental sensor pod","monitoring","Wireless / wired DCIM sensor node (temp/humidity/door/leak)",2,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Monitoring — DCIM","power-meter","branch-circuit / busway power meter","monitoring","Branch-circuit or busway power-monitoring module",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — Security","access-control","access-control reader / controller","monitoring","Card/biometric reader + door controller for secure-zone access",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Monitoring — Security","video-surveillance","IP camera / NVR module","monitoring","IP surveillance camera / network-video-recorder module",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Monitoring — Detection","leak-detection","spot / rope water-leak detector","monitoring","Spot or rope-style water-leak detector + panel (under-floor / CRAC pans)",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # NEW TAXONOMY ROWS — enrichment pass
    # ELECTRICAL — new granular classes
    ("Power — Distribution","switchgear","LV moulded-case circuit breaker (MCCB)","electrical","Moulded-case circuit breaker 16–1600 A for LV distribution panels",6,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Power — Distribution","switchgear","surge protection device (SPD/TVSS)","electrical","Surge-protective device / TVSS for LV distribution boards and racks",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Power — Distribution","switchgear","earth-fault / arc-flash relay","electrical","Earth-fault monitoring relay or arc-flash detection relay for LV panels",7,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","switchgear","bus-tie breaker","electrical","Bus-tie / bus-section circuit breaker for paralleling two main bus sections",8,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","switchgear","ring-main unit (RMU) module","electrical","SF6 / vacuum ring-main unit switchgear module for campus MV ring feeds",8,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","transformer","on-load tap changer (OLTC)","electrical","On-load tap-changer mechanism for regulating transformer output voltage",7,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","transformer","transformer protection relay (Buchholz/breather)","electrical","Buchholz relay + silica-gel breather + thermostat for oil-immersed transformer monitoring",6,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","PDU","rack automatic transfer switch (in-rack ATS)","electrical","In-rack dual-feed automatic transfer switch for single-cord servers",7,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Distribution","PDU","PDU branch-circuit monitoring strip","electrical","Per-outlet or per-branch current/energy monitoring strip inside floor/rack PDU",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Power Quality","harmonic-filter","passive / active harmonic filter","electrical","Passive LC or active harmonic filter for UPS/VFD harmonic mitigation",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — DC","dc-busway","DC-bus capacitor bank (48V/400V DC busway)","electrical","DC-bus capacitor bank module for 48V/400V DC distribution systems",6,"cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","diesel-generator","generator AVR (automatic voltage regulator)","mechanical","Automatic voltage regulator module for diesel genset alternator",7,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","diesel-generator","generator load bank (resistive)","mechanical","Resistive load bank for periodic genset load testing (portable/permanent)",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","diesel-generator","genset coolant pump","mechanical","Engine jacket-water centrifugal coolant pump for diesel genset",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","diesel-generator","genset radiator core","mechanical","Engine radiator / heat exchanger core for remote genset cooling",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Power — Standby Generation","diesel-generator","genset fuel injector / common-rail","mechanical","Fuel injector or common-rail assembly for diesel genset engine",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","fuel-system","fuel-level transmitter / float switch","mechanical","Tank-level transmitter or float switch for diesel day-tank / bulk-tank",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Power — Standby Generation","fuel-system","fuel-tank leak-detection sensor","mechanical","Under-tank bund / double-wall leak detector for diesel fuel tanks",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # COOLING — new granular classes
    ("Cooling — Chilled Water","chiller","chiller oil filter / purge unit","cooling","Refrigerant-side oil filter cartridge or purge unit for centrifugal chiller",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Chilled Water","chiller","chiller refrigerant relief valve","cooling","Pressure-relief valve for chiller refrigerant circuit (code-required)",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Heat Rejection","cooling-tower","cooling-tower spray nozzle / distribution header","cooling","Replacement spray nozzle or hot-water distribution header for cooling tower",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Heat Rejection","cooling-tower","cooling-tower basin heater","cooling","Electric immersion heater for cooling-tower basin freeze protection",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Heat Rejection","cooling-tower","cooling-tower vibration switch","cooling","Vibration switch / accelerometer for cooling-tower fan shaft protection",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Cooling — Heat Rejection","cooling-tower","cooling-tower water-treatment dosing pump","cooling","Chemical dosing pump / controller for cooling-tower water treatment",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Heat Rejection","dry-cooler","plate-HX cleaning-in-place (CIP) skid","cooling","CIP skid (pump + heater + chemical vessel) for plate heat exchanger cleaning",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Air","CRAC-CRAH","CRAC reheat element / condensate pump","cooling","Electric reheat element or condensate transfer pump for CRAC/CRAH unit",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Cooling — Air","AHU","AHU heat-recovery wheel / UV-C lamp","cooling","Thermal wheel / enthalpy recovery wheel or UV-C germicidal lamp for AHU",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Air","CRAC-CRAH","perimeter CRAH valve actuator","cooling","Spring-return actuator for cooling-coil 2-way valve on perimeter CRAH",4,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Cooling — Air","RDHx","rear-door HX fan / coil cleaning kit","cooling","Replacement fan assembly or chemical coil-cleaning kit for rear-door HX",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # COOLING — liquid (AI factory) deep additions
    ("Cooling — Liquid","CDU-coolant-distribution","secondary CDU pump","cooling","Secondary or redundant coolant pump within CDU (built-in N+1 pump)",8,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","CDU-coolant-distribution","CDU expansion tank / accumulator","cooling","Pressurized expansion tank or accumulator for CDU coolant circuit",6,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","CDU-coolant-distribution","CDU filtration cartridge (5µm/50µm)","cooling","Consumable filtration cartridge (5 µm or 50 µm) for CDU coolant loop",5,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","CDU-coolant-distribution","CDU flow control valve","cooling","Motorized flow-control or proportional valve inside CDU coolant circuit",6,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","CDU-coolant-distribution","CDU coolant chemistry sensor","cooling","Inline pH / conductivity / turbidity sensor for CDU coolant-loop chemistry monitoring",6,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Cooling — Liquid","direct-to-chip-cooling","cold-plate gasket / O-ring kit","cooling","Replacement gasket and O-ring kit for GPU/CPU liquid cold plate maintenance",5,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","cooling-manifold","manifold quick-disconnect blanking plug","cooling","Dripless blanking / dummy plug for unused manifold QD ports (server removal)",5,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","immersion-cooling","dielectric fluid (bulk, per-litre)","cooling","Engineered dielectric immersion fluid — single-phase or two-phase (consumable replenishment)",6,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","immersion-cooling","immersion-tank lid seal / gasket","cooling","Tank lid / cover gasket or seal kit for immersion-cooling tank enclosure",5,"ai-factory-liquid-cooled"),
    ("Cooling — Liquid","immersion-cooling","immersion fluid filtration cartridge","cooling","Particulate / activated-carbon filter cartridge for dielectric immersion fluid polishing",5,"ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","vertical inline pump (VIL)","cooling","Vertical inline centrifugal pump for chilled-water or condenser-water circuits",7,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","double-suction split-case pump","cooling","Horizontally split-case double-suction centrifugal pump for large condenser-water / fire loops",7,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","submersible sump pump","cooling","Submersible sump / drainage pump for mechanical room flood management",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pump","pump coupling / flexible spider","cooling","Flexible jaw coupling / spider insert for pump-to-motor alignment (consumable)",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","valve","check valve (silent/spring-loaded)","cooling","Silent or spring-loaded check valve for hydronic pump discharge (no water-hammer)",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","valve","pressure relief valve (hydronic ASME)","cooling","ASME-coded pressure relief valve for hydronic system overpressure protection",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","valve","backflow preventer (RP / DC type)","cooling","Reduced-pressure or double-check backflow preventer for potable / condenser cross-connection",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pipework","flexible pipe connector / expansion joint","cooling","Rubber or stainless flexible pipe connector / expansion joint for vibration isolation",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Cooling — Hydronics","pipework","pipe spring hanger / support","cooling","Variable-spring or constant-spring pipe hanger for large CHW headers",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # FIRE-LIFE-SAFETY — new granular classes
    ("Fire — Detection","detection","linear heat detection cable","fire-life-safety","Analogue or digital linear-heat-detection cable for cable rooms and risers",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Detection","detection","beam smoke detector","fire-life-safety","Wide-area optical beam smoke detector for large open-plan spaces",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Fire — Detection","detection","flame detector (UV/IR)","fire-life-safety","UV/IR or multi-spectrum flame detector for generator rooms / fuel areas",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Detection","detection","duct smoke detector","fire-life-safety","In-duct sampling smoke detector for supply/return air HVAC systems",5,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Notification","notification","sounder / strobe (NAC device)","fire-life-safety","Notification appliance (horn/strobe) on notification appliance circuit",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Fire — Suppression","fire-pump","fire-pump test header / flow meter","fire-life-safety","Fire-pump test header assembly with flow measurement for annual certification",5,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Suppression","clean-agent","pre-action air compressor / nitrogen generator","fire-life-safety","Small air compressor or nitrogen generator maintaining dry-pipe/pre-action system supervisory air",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Control","fire-panel","fire-panel SLC isolator / relay module","fire-life-safety","Short-circuit isolator module or relay module on SLC signalling line circuit",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Control","fire-panel","EVAC amplifier / voice alarm module","fire-life-safety","Emergency voice / alarm communication (EVAC) amplifier or PA module in fire panel",5,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Fire — Detection","VESDA","VESDA aspirating-pipe sampling filter (consumable)","fire-life-safety","Replacement sampling-point filter element for VESDA / aspirating detection pipe",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # NETWORK-ICT — new granular classes
    ("Network — Fabric","spine-leaf-switch","spine chassis line card / fabric module","network-ict","Line card or fabric/supervisor module for modular spine-chassis switch",6,"cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Optics","optical-transceiver","AOC / DAC direct-attach cable","network-ict","Active optical cable (AOC) or passive direct-attach copper (DAC) for short-reach switch interconnect",3,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Cabling","fiber-ODF","fiber pigtail / splice tray","network-ict","Pre-terminated fiber pigtails and splice tray cassette for ODF termination",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Cabling","structured-cabling","MPO-MPO trunk / LC duplex patch cord","network-ict","Pre-terminated MPO-MPO trunk or LC duplex patch cord (OS2/OM4) for high-density patching",2,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Network — Timing","timing","PTP grandmaster / timing appliance","network-ict","IEEE 1588 PTP grandmaster clock or timing server for AI-factory precision time",5,"ai-factory-liquid-cooled,cloud-hyperscale"),
    ("Network — Management","console-server","out-of-band cellular gateway","network-ict","LTE/5G out-of-band management gateway for remote site access",4,"edge-micro,enterprise-tier3,colo-wholesale"),
    ("Network — Optics","optical-transceiver","WDM mux/demux module","network-ict","Passive CWDM/DWDM mux-demux module for fibre wavelength multiplexing",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # BMS-CONTROLS — new granular classes
    ("Controls — BMS","DDC-PLC-controller","I/O expansion module (DI/DO/AI/AO)","bms-controls","Digital / analogue I/O expansion module for DDC controller or PLC rack",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — BMS","DDC-PLC-controller","building controller UPS / power supply","bms-controls","Panel UPS or 24 V DC power supply for DDC/BMS controller room",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","sensor","CO2 / air-quality sensor","bms-controls","CO2 + TVOC air-quality sensor for generator room ventilation and occupant monitoring",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","sensor","differential-pressure transmitter (room/containment)","bms-controls","Room or containment differential-pressure transmitter for hot-aisle / clean-room monitoring",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","sensor","current transducer (sub-metering)","bms-controls","Split-core or through-hole CT for branch-circuit sub-metering",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Controls — Field","actuator","field-bus repeater (RS-485/MS-TP)","bms-controls","RS-485 / BACnet MS/TP bus repeater or segment coupler for extending control networks",3,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale"),
    ("Controls — SCADA","SCADA-RTU","SCADA HMI panel PC","bms-controls","Panel-mount industrial HMI / SCADA workstation for electrical or cooling plant visualization",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # STRUCTURAL-CIVIL — new granular classes
    ("Structure — White Space","raised-floor-tile","perforated floor tile with damper","structural-civil","Perforated raised-floor tile with adjustable airflow damper for floor-plenum balancing",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale"),
    ("Structure — White Space","server-rack","cabinet blanking panel (1U/2U)","structural-civil","1U or 2U rack blanking panel for airflow management in server cabinets",1,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled,edge-micro"),
    ("Structure — White Space","server-rack","cabinet earthing / bonding kit","structural-civil","Rack earthing / bonding strip and grounding hardware kit",2,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Structure — Pathways","cable-tray","cable basket (wire mesh tray) / divider","structural-civil","Wire-mesh cable basket tray section and divider insert for pathway separation",2,"legacy-raised-floor,enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Structure — Pathways","cable-tray","trapeze hanger / spring vibration isolator","structural-civil","Trapeze hanger assembly or spring-type vibration isolation pad for equipment / pipe support",2,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    # MONITORING — new granular classes
    ("Monitoring — DCIM","DCIM-sensor","rack temperature string (multi-point)","monitoring","Multi-point rack temperature sensor string (top/middle/bottom) for per-rack thermal profiling",3,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","DCIM-sensor","under-floor zoned leak rope","monitoring","Zoned leak-detection rope sensor for under-floor plenum or secondary-loop trench",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","DCIM-sensor","thermal imaging camera (rack hot-spot)","monitoring","Spot thermal / infrared camera for rack hot-spot detection without airflow disruption",4,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","power-meter","power-quality analyzer (portable)","monitoring","Portable power-quality analyzer for site survey / commissioning / maintenance",4,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","power-meter","UPS battery monitor (per-cell)","monitoring","Per-cell / per-module battery monitor for UPS VRLA or Li-ion state-of-health tracking",6,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","DCIM-sensor","vibration sensor (rotating equipment)","monitoring","Triaxial vibration sensor for online condition monitoring of pumps, fans, and compressors",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","DCIM-sensor","ultrasonic clamp-on flow meter","monitoring","Clamp-on ultrasonic flow meter for non-invasive pipe flow measurement on CHW / CDU loops",5,"enterprise-tier3,colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
    ("Monitoring — DCIM","DCIM-sensor","transformer dissolved-gas analyzer (DGA)","monitoring","Online dissolved-gas analysis unit for oil-immersed transformer incipient-fault detection",7,"colo-wholesale,cloud-hyperscale,ai-factory-liquid-cooled"),
]

# ---------------------------------------------------------------------------
# Part archetypes — each maps onto a TAXONOMY l3 and carries realistic ranges.
# (l3, [eligible_oem_ids], mtbf_min, mtbf_max, mttr_min, mttr_max,
#   lt_min, lt_typ_lo, lt_typ_hi, lt_max, cost_lo, cost_hi,
#   moq, ib_min_lo, ib_min_hi, ib_max_lo, ib_max_hi,
#   alts_max, eol_risk_lo, eol_risk_hi, refurb, print3d, hazmat,
#   weight_lo, weight_hi, ratings_kind)
# ratings_kind drives synthetic capacity/voltage/refrigerant fields.
# ---------------------------------------------------------------------------
def AT(l3, oems, mtbf, mttr, lt, cost, moq, ib, alts, eol, refurb, print3d, hazmat, weight, rk):
    return {
        "l3": l3, "oems": oems,
        "mtbf_lo": mtbf[0], "mtbf_hi": mtbf[1],
        "mttr_lo": mttr[0], "mttr_hi": mttr[1],
        "lt_min": lt[0], "lt_typ_lo": lt[1], "lt_typ_hi": lt[2], "lt_max": lt[3],
        "cost_lo": cost[0], "cost_hi": cost[1],
        "moq_lo": moq[0], "moq_hi": moq[1],
        "ib_min_lo": ib[0], "ib_min_hi": ib[1], "ib_max_lo": ib[2], "ib_max_hi": ib[3],
        "alts_max": alts,
        "eol_lo": eol[0], "eol_hi": eol[1],
        "refurb": refurb, "print3d": print3d, "hazmat": hazmat,
        "weight_lo": weight[0], "weight_hi": weight[1],
        "rk": rk,
    }

ARCHETYPES = [
    # ELECTRICAL — UPS
    AT("static UPS module", ["vertiv","schneider","eaton","abb"], (5,8), (4,12), (12,16,24,40), (80000,260000), (1,1), (4,8,8,16), 2, (3,6), 1, 0, 0, (350,1200), "kva"),
    AT("UPS rectifier/IGBT assembly", ["vertiv","schneider","eaton","abb"], (6,10), (3,8), (8,12,20,32), (8000,45000), (1,1), (4,8,8,16), 1, (4,7), 1, 0, 0, (15,60), "kva"),
    AT("UPS battery string (VRLA)", ["generic-elec","vertiv","schneider","eaton"], (4,7), (3,8), (4,8,12,18), (4000,30000), (1,2), (2,4,4,8), 3, (2,5), 1, 0, 1, (200,900), "kw"),
    AT("UPS battery module (Li-ion)", ["vertiv","schneider","eaton"], (8,12), (2,6), (8,12,20,28), (12000,55000), (1,1), (4,8,8,20), 2, (2,4), 1, 0, 1, (40,140), "kw"),
    AT("UPS static bypass switch", ["vertiv","schneider","eaton","abb"], (10,18), (3,8), (8,12,18,28), (10000,40000), (1,1), (1,2,2,4), 2, (3,6), 1, 0, 0, (20,80), "kva"),
    AT("UPS control / display board", ["vertiv","schneider","eaton","generic-elec"], (8,12), (2,6), (4,6,10,16), (1200,9000), (1,1), (1,2,2,4), 2, (5,8), 0, 0, 0, (1,5), None),
    # ELECTRICAL — switchgear / transformer / distribution
    AT("MV vacuum circuit breaker", ["abb","siemens","ge-grid","schneider","powell"], (15,25), (8,24), (24,30,48,72), (15000,80000), (1,1), (3,6,6,12), 2, (3,7), 1, 0, 0, (60,250), "kv"),
    AT("LV air circuit breaker", ["abb","siemens","schneider","eaton","generic-elec"], (12,20), (4,12), (10,16,28,44), (3000,35000), (1,2), (4,8,8,16), 3, (3,6), 1, 0, 0, (20,120), "amp"),
    AT("MV protection relay", ["abb","siemens","ge-grid","schneider"], (15,25), (3,8), (10,18,28,44), (3000,18000), (1,1), (3,6,6,12), 2, (5,8), 0, 0, 0, (2,8), "kv"),
    AT("cast-resin distribution transformer", ["abb","siemens","schneider","weg","ge-grid"], (20,30), (8,40), (16,24,36,56), (15000,90000), (1,1), (2,4,4,8), 2, (3,6), 1, 0, 0, (1500,8000), "kva"),
    AT("oil-immersed power transformer", ["abb","siemens","ge-grid","hyosung"], (25,40), (24,168), (40,60,90,140), (250000,2500000), (1,1), (1,2,2,4), 1, (3,6), 1, 0, 1, (15000,100000), "mva"),
    AT("transformer cooling fan / pump", ["abb","siemens","nidec","generic-elec"], (8,15), (2,8), (4,8,14,22), (800,8000), (1,2), (2,4,4,8), 3, (3,6), 1, 0, 0, (5,30), None),
    AT("floor PDU transformer/breaker", ["vertiv","schneider","eaton","legrand"], (12,20), (3,10), (8,12,18,28), (8000,45000), (1,1), (4,8,8,20), 3, (3,6), 1, 0, 0, (150,600), "kva"),
    AT("rack PDU (metered/switched)", ["legrand","eaton-tripp-lite","vertiv","chatsworth","schneider"], (8,14), (1,4), (2,6,10,16), (300,2500), (1,4), (10,40,40,200), 4, (3,6), 1, 0, 0, (3,12), "amp"),
    AT("busway / busduct section", ["legrand","schneider","eaton","abb","nvent"], (20,30), (8,40), (12,18,28,44), (5000,40000), (1,2), (4,12,12,40), 2, (3,6), 1, 0, 0, (40,300), "amp"),
    AT("busway plug-in tap-off unit", ["legrand","schneider","eaton","nvent"], (12,20), (2,6), (6,10,16,26), (1000,8000), (1,2), (8,24,24,120), 3, (3,6), 1, 0, 0, (8,40), "amp"),
    AT("automatic transfer switch", ["asco","russelectric","eaton","schneider","caterpillar"], (15,22), (4,16), (12,18,28,44), (8000,60000), (1,1), (2,4,4,10), 2, (3,6), 1, 0, 0, (60,400), "amp"),
    AT("ATS controller / logic board", ["asco","russelectric","eaton","generic-elec"], (10,16), (2,6), (4,8,14,22), (1500,9000), (1,1), (2,4,4,10), 2, (5,8), 0, 0, 0, (1,5), None),
    AT("static transfer switch (SCR)", ["cyberex","schneider","eaton","vertiv"], (12,20), (3,10), (12,16,26,40), (15000,70000), (1,1), (2,4,4,8), 2, (3,6), 1, 0, 0, (60,250), "amp"),
    AT("power-factor capacitor bank", ["abb","schneider","siemens","generic-elec"], (10,18), (4,12), (8,12,20,30), (5000,30000), (1,1), (1,2,2,4), 2, (3,6), 1, 0, 0, (100,500), "kva"),
    AT("DC plant rectifier module", ["vertiv","eaton","schneider"], (8,14), (1,4), (6,10,16,24), (1500,12000), (1,2), (4,8,8,24), 2, (3,6), 1, 0, 0, (5,20), "kw"),
    AT("revenue/PQ power meter", ["camille-bauer","schneider","abb","siemens","camille-bauer"], (12,20), (1,4), (4,8,12,18), (500,5000), (1,2), (4,12,12,40), 3, (4,7), 0, 0, 0, (1,4), None),
    # MECHANICAL — power generation
    AT("genset alternator (end)", ["nidec","weg","caterpillar","cummins","kohler"], (10,16), (12,48), (24,30,44,64), (40000,250000), (1,1), (2,4,4,12), 2, (3,6), 1, 0, 0, (1000,6000), "kva"),
    AT("genset controller / paralleling module", ["caterpillar","cummins","kohler","asco","russelectric"], (10,16), (3,10), (12,18,30,44), (5000,30000), (1,1), (2,4,4,12), 2, (5,8), 0, 0, 0, (5,25), None),
    AT("genset turbocharger", ["caterpillar","cummins","mtu","generic-mech"], (6,12), (8,24), (10,16,28,40), (8000,45000), (1,1), (2,4,4,12), 2, (4,7), 1, 0, 0, (40,200), None),
    AT("genset jacket-water heater", ["caterpillar","cummins","kohler","generic-mech"], (4,8), (2,6), (4,8,12,18), (800,6000), (1,2), (2,4,4,12), 3, (3,6), 1, 0, 0, (5,20), "kw"),
    AT("genset starter / battery", ["caterpillar","cummins","kohler","generic-mech","generic-elec"], (2,5), (2,6), (2,4,8,12), (400,5000), (1,2), (4,8,8,24), 4, (2,5), 1, 0, 1, (10,60), None),
    AT("genset fuel/oil/air filter set", ["caterpillar","cummins","kohler","mtu","generic-mech"], (0.5,1.2), (1,3), (1,3,6,10), (50,600), (1,12), (8,24,24,120), 5, (2,5), 0, 1, 0, (1,8), None),
    AT("diesel fuel transfer pump", ["franklin","grundfos","xylem","generic-fluid","generic-mech"], (6,12), (4,12), (4,8,14,22), (1500,15000), (1,2), (2,4,4,12), 3, (3,6), 1, 0, 0, (15,80), "kw"),
    AT("fuel polishing/filtration unit", ["generic-fluid","parker","generic-mech"], (5,10), (4,12), (6,10,16,24), (3000,25000), (1,1), (1,2,2,6), 2, (3,6), 1, 0, 0, (40,200), None),
    AT("genset exhaust silencer/SCR", ["caterpillar","cummins","mtu","generic-mech"], (10,20), (8,32), (12,18,30,44), (8000,60000), (1,1), (2,4,4,12), 2, (3,6), 1, 0, 0, (100,600), None),
    # COOLING — chilled water
    AT("centrifugal chiller compressor", ["carrier","trane","daikin","johnson-controls"], (8,12), (16,72), (16,22,34,52), (40000,160000), (1,1), (2,4,4,12), 2, (3,6), 1, 0, 1, (800,4000), "ton"),
    AT("magnetic-bearing chiller compressor", ["daikin","johnson-controls","carrier","trane"], (8,14), (12,48), (16,24,36,52), (60000,200000), (1,1), (2,4,4,12), 2, (3,5), 1, 0, 1, (400,1500), "ton"),
    AT("chiller control panel / VFD", ["carrier","trane","daikin","johnson-controls","stulz"], (7,12), (4,16), (8,14,24,36), (5000,40000), (1,1), (2,4,4,12), 2, (5,8), 0, 0, 0, (20,120), "ton"),
    AT("chiller evaporator/condenser tube bundle", ["carrier","trane","johnson-controls","alfa-laval","kelvion"], (10,18), (24,120), (14,20,32,48), (15000,90000), (1,1), (2,4,4,12), 2, (3,6), 1, 0, 0, (500,3000), "ton"),
    # COOLING — heat rejection
    AT("cooling-tower fan / gearbox", ["spx-cooling","baltimore-aircoil","evapco","generic-mech"], (6,12), (8,32), (8,14,24,36), (5000,40000), (1,2), (2,4,4,12), 3, (3,6), 1, 0, 0, (100,600), None),
    AT("cooling-tower fill / drift eliminator", ["spx-cooling","baltimore-aircoil","evapco"], (8,15), (8,24), (6,10,18,28), (2000,18000), (1,2), (2,4,4,12), 3, (3,6), 0, 0, 0, (50,300), None),
    AT("finned-tube dry cooler", ["guntner","kelvion","baltimore-aircoil","evapco","spx-cooling"], (12,20), (8,32), (12,18,28,44), (20000,150000), (1,1), (4,8,8,24), 2, (3,6), 1, 0, 0, (800,5000), "kw"),
    AT("dry-cooler EC fan", ["guntner","kelvion","stulz","generic-mech"], (8,14), (2,8), (6,10,18,28), (1500,12000), (1,4), (8,24,24,80), 3, (3,6), 1, 0, 0, (10,50), "kw"),
    # COOLING — air
    AT("CRAC/CRAH compressor", ["stulz","vertiv","schneider","carrier","daikin"], (6,10), (8,32), (8,14,24,36), (6000,45000), (1,1), (4,12,12,40), 3, (4,7), 1, 0, 1, (60,300), "kw"),
    AT("CRAC/CRAH EC fan array", ["stulz","vertiv","schneider","rittal","generic-mech"], (6,10), (2,8), (4,8,14,22), (1500,15000), (1,2), (8,24,24,80), 3, (3,6), 1, 0, 0, (8,40), "kw"),
    AT("CRAC/CRAH cooling coil", ["stulz","vertiv","schneider","carrier","alfa-laval"], (10,18), (8,24), (8,12,20,32), (3000,25000), (1,1), (4,12,12,40), 2, (3,6), 1, 0, 0, (40,200), "kw"),
    AT("CRAC/CRAH humidifier", ["stulz","vertiv","schneider","generic-mech"], (4,8), (2,8), (4,8,14,22), (1000,9000), (1,2), (4,12,12,40), 3, (3,6), 1, 0, 0, (10,50), "kw"),
    AT("air filter element", ["camfil","aaf","generic-mech"], (0.5,1.5), (0.5,2), (1,2,4,8), (30,400), (4,24), (12,40,40,200), 5, (2,5), 0, 0, 0, (1,8), None),
    AT("AHU supply/return fan", ["munters","stulz","carrier","trane","generic-mech"], (8,14), (4,16), (8,12,20,32), (3000,30000), (1,2), (2,4,4,16), 3, (3,6), 1, 0, 0, (30,200), "kw"),
    AT("adiabatic cooler media + pump", ["munters","baltimore-aircoil","evapco","generic-mech"], (3,8), (4,12), (4,8,14,22), (1500,18000), (1,2), (2,4,4,16), 3, (3,6), 0, 0, 0, (20,120), None),
    # COOLING — liquid (AI factory)
    AT("coolant distribution unit (CDU) pump", ["coolit","asetek","motivair","stulz","liquidstack","grundfos"], (6,10), (3,12), (8,12,20,32), (5000,35000), (1,2), (2,6,6,24), 2, (3,6), 1, 0, 0, (15,80), "kw"),
    AT("CDU plate heat exchanger", ["alfa-laval","kelvion","danfoss","boyd","motivair"], (10,18), (8,24), (8,12,20,32), (3000,30000), (1,1), (2,6,6,24), 2, (3,6), 1, 0, 0, (20,150), "kw"),
    AT("CDU control board / leak sensor", ["coolit","asetek","motivair","stulz","packet-power"], (7,12), (2,8), (6,10,16,24), (1500,12000), (1,2), (2,6,6,24), 2, (5,8), 0, 0, 0, (1,6), None),
    AT("GPU/CPU cold plate", ["coolit","asetek","boyd","zutacore"], (7,12), (1,6), (8,12,20,30), (200,2500), (1,4), (50,500,500,5000), 3, (4,7), 0, 0, 0, (0.3,2), None),
    AT("rack cooling manifold", ["coolit","asetek","boyd","motivair","nvent"], (10,16), (2,8), (6,10,18,28), (800,8000), (1,2), (10,40,40,200), 3, (3,6), 1, 0, 0, (5,30), None),
    AT("quick-disconnect coupling (dripless)", ["coolit","asetek","parker","swagelok","staubli" if False else "parker"], (8,14), (1,4), (4,8,14,22), (50,800), (4,40), (50,500,500,5000), 4, (3,6), 0, 0, 0, (0.1,1), None),
    AT("dielectric / coolant filter element", ["coolit","asetek","parker","generic-fluid"], (0.5,2), (1,4), (2,4,8,14), (100,1200), (2,12), (10,40,40,200), 4, (3,6), 0, 0, 0, (0.5,4), None),
    AT("immersion-tank circulation pump", ["grc","submer","liquidstack","iceotope","grundfos"], (6,10), (3,12), (8,12,20,32), (3000,25000), (1,2), (1,4,4,16), 2, (4,7), 1, 0, 0, (10,60), "kw"),
    AT("immersion-tank heat exchanger", ["grc","submer","liquidstack","alfa-laval","kelvion"], (10,16), (8,24), (8,12,20,32), (2000,20000), (1,1), (1,4,4,16), 2, (3,6), 1, 0, 0, (15,100), "kw"),
    AT("two-phase immersion condenser", ["liquidstack","zutacore","submer","kelvion"], (8,14), (8,24), (10,14,24,36), (3000,30000), (1,1), (1,4,4,16), 2, (4,7), 1, 0, 1, (20,150), "kw"),
    AT("rear-door heat exchanger coil", ["rittal","motivair","stulz","alfa-laval","coolit"], (10,16), (4,16), (8,12,20,32), (2000,20000), (1,1), (4,16,16,80), 2, (3,6), 1, 0, 0, (20,120), "kw"),
    # COOLING — hydronics
    AT("chilled-water circulation pump", ["grundfos","xylem","armstrong","wilo","bell-gossett","taco"], (8,15), (8,32), (8,12,20,32), (4000,40000), (1,2), (2,6,6,20), 3, (3,6), 1, 0, 0, (60,400), "kw"),
    AT("pump motor / VFD", ["nidec","weg","abb","danfoss","schneider"], (8,14), (4,16), (6,10,18,28), (2000,25000), (1,2), (2,6,6,20), 3, (3,6), 1, 0, 0, (30,200), "kw"),
    AT("pump mechanical seal / bearing", ["grundfos","xylem","generic-mech","generic-fluid"], (1.5,4), (2,8), (1,3,6,10), (100,1500), (1,4), (4,12,12,40), 4, (2,5), 0, 0, 0, (0.5,5), None),
    AT("motorized control valve (2-way/3-way)", ["belimo","danfoss","spirax-sarco","johnson-controls","generic-fluid"], (8,15), (2,8), (4,8,14,22), (300,5000), (1,4), (8,24,24,120), 4, (3,6), 1, 0, 0, (2,15), None),
    AT("butterfly / gate isolation valve", ["victaulic","spirax-sarco","danfoss","generic-fluid"], (15,25), (4,16), (4,8,14,22), (500,8000), (1,2), (8,24,24,120), 4, (2,5), 1, 0, 0, (5,40), None),
    AT("pressure-independent control valve (PICV)", ["belimo","danfoss","spirax-sarco"], (10,18), (2,8), (4,8,14,22), (300,3000), (1,4), (8,24,24,120), 3, (3,6), 0, 0, 0, (1,8), None),
    AT("plate-and-frame heat exchanger", ["alfa-laval","kelvion","danfoss","xylem","taco"], (12,20), (8,40), (8,14,24,36), (5000,60000), (1,1), (2,6,6,16), 2, (3,6), 1, 0, 0, (100,1500), "kw"),
    AT("HX gasket / plate set", ["alfa-laval","kelvion","danfoss","generic-fluid"], (3,8), (4,16), (4,8,14,22), (500,8000), (1,2), (2,6,6,16), 4, (2,5), 0, 0, 0, (5,50), None),
    AT("grooved pipe coupling / fitting", ["victaulic","victaulic-fire","generic-fluid"], (15,30), (1,4), (1,3,6,10), (20,600), (4,40), (20,80,80,400), 5, (2,4), 0, 0, 0, (0.2,5), None),
    AT("expansion / air-separation tank", ["taco","bell-gossett","xylem","generic-fluid"], (10,20), (4,16), (4,8,14,22), (500,8000), (1,1), (1,2,2,6), 4, (2,5), 1, 0, 0, (20,150), None),
    AT("strainer / Y-strainer basket", ["spirax-sarco","generic-fluid","victaulic"], (2,6), (1,4), (1,2,4,8), (50,1000), (1,4), (4,12,12,40), 5, (2,4), 0, 0, 0, (1,15), None),
    # FIRE-LIFE-SAFETY
    AT("aspirating smoke detector (VESDA)", ["xtralis","bosch-fire","honeywell"], (8,14), (3,12), (8,12,18,28), (3000,25000), (1,1), (4,12,12,40), 2, (4,8), 0, 0, 0, (2,12), None),
    AT("addressable smoke/heat detector", ["honeywell","bosch-fire","tyco-fire","generic-elec"], (8,14), (1,4), (2,6,10,16), (40,500), (2,12), (40,150,150,800), 4, (3,6), 0, 0, 0, (0.1,0.5), None),
    AT("fire alarm control panel (FACP)", ["honeywell","bosch-fire","tyco-fire","kidde"], (10,18), (4,16), (10,14,22,32), (4000,30000), (1,1), (1,2,2,6), 2, (5,8), 0, 0, 0, (10,60), None),
    AT("clean-agent release panel", ["kidde","fike","tyco-fire","honeywell"], (10,18), (4,16), (10,14,22,32), (3000,25000), (1,1), (1,3,3,10), 2, (5,8), 0, 0, 0, (5,30), None),
    AT("clean-agent cylinder (FM-200/Novec 1230)", ["kidde","fike","tyco-fire"], (10,20), (4,12), (8,12,20,30), (2000,20000), (1,2), (2,8,8,30), 3, (3,6), 1, 0, 1, (40,250), None),
    AT("inert-gas (IG-541/IG-55) cylinder", ["tyco-fire","fike","kidde"], (10,20), (4,12), (8,12,20,30), (1500,15000), (1,4), (4,16,16,60), 3, (3,6), 1, 0, 1, (60,200), None),
    AT("suppression nozzle / discharge head", ["kidde","fike","tyco-fire","viking-fire","generic-mech"], (15,30), (1,4), (2,6,10,16), (30,600), (4,40), (8,24,24,120), 5, (2,4), 0, 0, 0, (0.1,2), None),
    AT("pre-action / deluge valve", ["viking-fire","tyco-fire","victaulic-fire","generic-fluid"], (15,25), (4,16), (8,12,20,30), (2000,20000), (1,1), (1,3,3,10), 3, (3,6), 1, 0, 0, (20,120), None),
    AT("sprinkler head", ["viking-fire","tyco-fire","generic-mech"], (20,40), (0.5,2), (1,3,6,10), (8,80), (8,80), (40,200,200,1200), 5, (2,4), 0, 0, 0, (0.05,0.3), None),
    AT("electric fire pump + controller", ["pentair-fire","viking-fire","xylem","grundfos"], (12,20), (8,32), (12,18,28,44), (15000,90000), (1,1), (1,2,2,4), 2, (3,6), 1, 0, 0, (200,1200), "kw"),
    AT("diesel fire pump engine", ["pentair-fire","caterpillar","cummins","viking-fire"], (10,18), (12,48), (16,22,34,52), (20000,120000), (1,1), (1,2,2,4), 2, (3,6), 1, 0, 0, (300,1500), "kw"),
    AT("jockey pump", ["pentair-fire","grundfos","xylem","generic-fluid"], (8,14), (2,8), (4,8,14,22), (800,8000), (1,1), (1,2,2,4), 3, (3,6), 1, 0, 0, (10,60), "kw"),
    AT("emergency luminaire / inverter", ["honeywell","schneider","legrand","generic-elec"], (5,10), (1,4), (2,6,10,16), (40,1500), (2,20), (20,80,80,400), 5, (3,6), 0, 0, 0, (0.5,8), None),
    # NETWORK-ICT
    AT("data-center leaf/spine switch", ["arista","cisco","juniper","nvidia","hpe"], (8,14), (1,4), (6,10,18,28), (8000,120000), (1,1), (4,16,16,80), 2, (4,7), 1, 0, 0, (10,30), None),
    AT("switch power supply / fan module", ["arista","cisco","juniper","nvidia","hpe","generic-elec"], (8,14), (0.5,2), (2,6,10,16), (300,4000), (1,4), (8,32,32,160), 4, (3,6), 1, 0, 0, (1,5), None),
    AT("optical transceiver (QSFP-DD/OSFP/QSFP28)", ["arista","cisco","nvidia","corning","generic-elec"], (6,12), (0.2,1), (2,6,10,16), (100,5000), (2,20), (40,200,200,2000), 5, (3,6), 0, 0, 0, (0.05,0.3), None),
    AT("optical distribution frame module / cassette", ["corning","commscope","panduit","leviton"], (15,30), (1,4), (2,6,10,16), (100,2000), (1,8), (8,40,40,200), 4, (2,4), 0, 0, 0, (0.5,5), None),
    AT("fiber trunk / patch assembly", ["corning","commscope","panduit","leviton","generic-elec"], (15,30), (1,4), (2,4,8,14), (30,800), (4,40), (40,200,200,2000), 5, (2,4), 0, 0, 0, (0.1,3), None),
    AT("copper patch panel (Cat6A)", ["panduit","commscope","leviton","generic-elec"], (20,40), (0.5,2), (1,3,6,10), (40,400), (4,40), (20,100,100,600), 5, (1,3), 0, 0, 0, (1,4), None),
    AT("serial console / OOB management server", ["legrand","cisco","vertiv","generic-elec"], (8,14), (1,4), (4,8,14,22), (400,4000), (1,4), (4,16,16,80), 4, (3,6), 1, 0, 0, (1,5), None),
    AT("KVM-over-IP switch", ["legrand","eaton-tripp-lite","vertiv","generic-elec"], (8,14), (1,4), (4,8,14,22), (200,3000), (1,4), (2,8,8,40), 4, (3,6), 1, 0, 0, (1,5), None),
    # BMS-CONTROLS
    AT("DDC plant controller", ["distech","tridium","honeywell","schneider","siemens","johnson-controls"], (8,12), (2,8), (4,8,14,22), (500,6000), (1,2), (4,16,16,80), 3, (5,8), 0, 0, 0, (0.5,4), None),
    AT("programmable logic controller (PLC)", ["siemens","abb","schneider","honeywell","generic-elec"], (10,16), (3,12), (6,10,18,28), (1500,15000), (1,2), (2,8,8,30), 3, (5,8), 0, 0, 0, (1,8), None),
    AT("local display controller / HMI panel", ["siemens","schneider","tridium","honeywell","stulz","generic-elec"], (7,12), (2,8), (4,8,14,22), (800,8000), (1,2), (2,8,8,30), 3, (5,8), 0, 0, 0, (1,8), None),
    AT("BACnet / Modbus protocol gateway", ["tridium","distech","honeywell","schneider","generic-elec"], (8,14), (1,4), (2,6,10,16), (300,4000), (1,2), (2,8,8,30), 4, (4,7), 0, 0, 0, (0.2,2), None),
    AT("SCADA RTU / IED for EPMS", ["abb","siemens","schneider","ge-grid","honeywell"], (10,16), (3,12), (6,10,18,28), (1500,15000), (1,2), (2,8,8,30), 3, (5,8), 0, 0, 0, (1,8), None),
    AT("temperature / humidity sensor (room)", ["belimo","honeywell","distech","packet-power","generic-elec"], (5,10), (0.5,2), (1,3,6,10), (30,400), (4,40), (20,100,100,600), 5, (2,4), 0, 0, 0, (0.05,0.5), None),
    AT("pressure / flow sensor (hydronic)", ["belimo","danfoss","honeywell","generic-elec"], (6,12), (1,4), (2,4,8,14), (100,1500), (2,12), (8,32,32,160), 4, (3,6), 0, 0, 0, (0.1,2), None),
    AT("coolant leak-detection cable/sensor", ["packet-power","honeywell","coolit","generic-elec"], (5,10), (1,4), (2,4,8,14), (100,2500), (2,12), (8,40,40,200), 4, (4,7), 0, 0, 0, (0.1,3), None),
    AT("damper / valve actuator", ["belimo","danfoss","johnson-controls","honeywell","generic-elec"], (8,14), (1,4), (2,4,8,14), (50,1200), (2,12), (16,60,60,300), 5, (2,5), 0, 0, 0, (0.2,4), None),
    AT("VFD (general HVAC)", ["abb","danfoss","schneider","siemens","nidec"], (8,14), (2,8), (4,8,14,22), (500,12000), (1,2), (8,24,24,120), 3, (3,6), 1, 0, 0, (3,40), "kw"),
    # STRUCTURAL-CIVIL
    AT("raised-floor tile / pedestal", ["generic-mech","nvent","chatsworth"], (20,40), (0.2,1), (2,4,8,14), (30,300), (8,100), (200,2000,2000,20000), 5, (1,3), 1, 0, 0, (3,15), None),
    AT("server cabinet / rack frame", ["rittal","chatsworth","panduit","nvent","legrand"], (20,40), (1,4), (2,6,10,16), (500,5000), (1,8), (50,500,500,5000), 4, (1,3), 1, 0, 0, (60,200), None),
    AT("hot/cold-aisle containment panel/door", ["rittal","chatsworth","panduit","nvent"], (15,30), (1,4), (4,8,14,22), (200,4000), (1,8), (20,200,200,2000), 4, (1,3), 1, 0, 0, (5,40), None),
    AT("cable tray / ladder rack section", ["nvent","panduit","legrand","generic-mech"], (20,40), (0.5,2), (2,4,8,14), (20,400), (8,100), (50,500,500,5000), 5, (1,3), 1, 0, 0, (2,20), None),
    AT("seismic bracing / isolation mount", ["nvent","generic-mech"], (20,40), (1,4), (4,8,14,22), (50,1500), (2,20), (20,200,200,2000), 5, (1,3), 0, 0, 0, (1,15), None),
    # MONITORING
    AT("DCIM environmental sensor pod", ["packet-power","vertiv","schneider","generic-elec"], (5,10), (0.5,2), (1,3,6,10), (40,800), (4,40), (40,200,200,2000), 5, (2,4), 0, 0, 0, (0.05,1), None),
    AT("branch-circuit / busway power meter", ["packet-power","schneider","legrand","eaton","camille-bauer"], (8,14), (1,4), (2,6,10,16), (100,2500), (2,12), (8,40,40,200), 4, (3,6), 0, 0, 0, (0.1,2), None),
    AT("access-control reader / controller", ["honeywell","generic-elec"], (6,12), (1,4), (2,6,10,16), (100,2000), (2,12), (8,40,40,200), 4, (3,6), 0, 0, 0, (0.2,3), None),
    AT("IP camera / NVR module", ["honeywell","cisco","generic-elec"], (4,8), (1,4), (2,6,10,16), (80,2500), (2,12), (8,40,40,200), 5, (2,4), 0, 0, 0, (0.2,5), None),
    AT("spot / rope water-leak detector", ["packet-power","honeywell","generic-elec"], (5,10), (1,4), (2,4,8,14), (50,1500), (2,12), (8,40,40,200), 4, (3,6), 0, 0, 0, (0.1,2), None),
    # =====================================================================
    # NEW ARCHETYPES — enrichment pass
    # =====================================================================
    # ELECTRICAL — UPS & power quality additions
    AT("UPS communication / SNMP card", ["vertiv","schneider","eaton","generic-elec"], (8,14), (1,4), (2,4,8,14), (200,2500), (1,2), (1,4,4,16), 4, (4,7), 0, 0, 0, (0.1,0.5), None),
    AT("LV moulded-case circuit breaker (MCCB)", ["abb","siemens","schneider","eaton","generic-elec"], (15,25), (2,8), (4,8,14,22), (300,8000), (1,4), (8,40,40,200), 5, (2,5), 1, 0, 0, (3,30), "amp"),
    AT("surge protection device (SPD/TVSS)", ["schneider","eaton","abb","siemens","generic-elec"], (8,15), (1,4), (2,4,8,14), (100,3000), (2,20), (8,40,40,200), 5, (2,4), 0, 0, 0, (0.5,5), None),
    AT("earth-fault / arc-flash relay", ["abb","siemens","schneider","ge-grid","generic-elec"], (12,20), (2,6), (6,10,18,28), (1000,12000), (1,2), (4,16,16,60), 3, (4,7), 0, 0, 0, (1,6), None),
    AT("bus-tie breaker", ["abb","siemens","schneider","eaton","powell"], (15,22), (4,16), (16,22,34,52), (10000,60000), (1,1), (1,2,2,6), 2, (4,7), 1, 0, 0, (40,250), "amp"),
    AT("ring-main unit (RMU) module", ["abb","siemens","schneider","ge-grid","hyosung"], (20,30), (8,32), (24,32,48,72), (20000,120000), (1,1), (2,4,4,10), 2, (3,6), 1, 0, 0, (200,1200), "kv"),
    AT("on-load tap changer (OLTC)", ["abb","siemens","ge-grid","generic-mech"], (12,20), (8,40), (16,24,40,60), (8000,60000), (1,1), (1,2,2,6), 2, (4,7), 1, 0, 1, (100,600), None),
    AT("transformer protection relay (Buchholz/breather)", ["abb","siemens","ge-grid","honeywell","generic-elec"], (8,15), (2,6), (6,10,18,28), (500,5000), (1,4), (1,4,4,16), 4, (3,6), 0, 0, 0, (0.5,5), None),
    AT("rack automatic transfer switch (in-rack ATS)", ["asco","eaton","schneider","cyberex","vertiv"], (12,20), (2,6), (6,10,18,28), (2000,18000), (1,2), (8,40,40,200), 3, (3,6), 1, 0, 0, (4,20), "amp"),
    AT("PDU branch-circuit monitoring strip", ["legrand","eaton-tripp-lite","vertiv","schneider","packet-power"], (8,14), (1,4), (2,4,8,14), (200,3000), (1,4), (10,60,60,300), 4, (3,6), 0, 0, 0, (0.3,3), None),
    AT("passive / active harmonic filter", ["abb","schneider","siemens","danfoss","generic-elec"], (8,15), (4,16), (8,12,20,32), (5000,50000), (1,1), (1,4,4,16), 2, (3,6), 1, 0, 0, (60,500), "kva"),
    AT("DC-bus capacitor bank (48V/400V DC busway)", ["schneider","eaton","abb","generic-elec"], (8,14), (2,8), (6,10,18,28), (3000,25000), (1,2), (2,8,8,30), 2, (4,7), 1, 0, 0, (20,120), "kw"),
    # ELECTRICAL — genset additions
    AT("generator AVR (automatic voltage regulator)", ["nidec","weg","generic-elec","caterpillar","cummins"], (8,15), (2,6), (6,10,18,28), (800,8000), (1,2), (2,6,6,24), 3, (4,7), 0, 0, 0, (1,8), None),
    AT("generator load bank (resistive)", ["generic-mech","generic-elec","caterpillar","cummins"], (15,25), (2,8), (8,12,20,32), (5000,80000), (1,1), (1,2,2,4), 2, (2,4), 1, 0, 0, (200,3000), "kw"),
    AT("genset coolant pump", ["caterpillar","cummins","mtu","generic-mech"], (6,12), (4,12), (6,10,18,28), (1200,12000), (1,2), (2,6,6,24), 3, (3,6), 1, 0, 0, (15,80), "kw"),
    AT("genset radiator core", ["caterpillar","cummins","mtu","generic-mech"], (8,15), (8,32), (8,14,24,36), (3000,25000), (1,1), (2,6,6,24), 2, (3,6), 1, 0, 0, (100,600), None),
    AT("genset fuel injector / common-rail", ["caterpillar","cummins","mtu","donaldson","generic-mech"], (5,10), (4,16), (8,14,24,36), (2000,20000), (1,4), (2,8,8,32), 3, (3,6), 1, 0, 0, (5,40), None),
    AT("fuel-level transmitter / float switch", ["caterpillar","cummins","generic-mech","generic-fluid"], (5,10), (1,4), (2,4,8,14), (200,3000), (1,4), (2,6,6,24), 4, (3,6), 0, 0, 0, (0.2,3), None),
    AT("fuel-tank leak-detection sensor", ["generic-elec","honeywell","generic-fluid"], (8,14), (1,4), (2,4,8,14), (200,3000), (1,4), (2,6,6,24), 4, (4,7), 0, 0, 0, (0.2,3), None),
    # COOLING — chiller additions
    AT("chiller oil filter / purge unit", ["carrier","trane","daikin","johnson-controls","generic-fluid"], (3,8), (2,8), (2,6,12,18), (300,5000), (1,4), (4,12,12,40), 4, (3,6), 0, 0, 1, (2,20), None),
    AT("chiller refrigerant relief valve", ["carrier","trane","daikin","spirax-sarco","generic-fluid"], (15,25), (2,8), (4,8,14,22), (500,6000), (1,2), (2,6,6,20), 3, (3,6), 0, 0, 1, (1,8), None),
    # COOLING — cooling tower additions
    AT("cooling-tower spray nozzle / distribution header", ["spx-cooling","baltimore-aircoil","evapco","spraying-systems","generic-fluid"], (5,10), (2,8), (2,4,8,14), (30,800), (4,40), (8,40,40,200), 5, (2,4), 0, 0, 0, (0.1,3), None),
    AT("cooling-tower basin heater", ["generic-elec","spx-cooling","baltimore-aircoil"], (5,10), (2,6), (2,4,8,14), (300,3000), (1,4), (2,6,6,24), 4, (2,4), 0, 0, 0, (3,20), "kw"),
    AT("cooling-tower vibration switch", ["spx-cooling","baltimore-aircoil","honeywell","generic-elec"], (8,15), (1,4), (2,4,8,14), (200,2500), (1,4), (2,6,6,24), 4, (3,6), 0, 0, 0, (0.2,2), None),
    AT("cooling-tower water-treatment dosing pump", ["grundfos","marlo-culligan","generic-fluid","generic-mech"], (5,10), (2,8), (4,8,14,22), (500,6000), (1,2), (1,4,4,16), 3, (3,6), 1, 0, 1, (5,30), "kw"),
    AT("plate-HX cleaning-in-place (CIP) skid", ["alfa-laval","kelvion","xylem","generic-fluid"], (10,20), (4,16), (8,14,24,36), (5000,40000), (1,1), (1,2,2,6), 2, (2,4), 1, 0, 1, (80,400), None),
    # COOLING — air additions
    AT("CRAC reheat element / condensate pump", ["stulz","vertiv","schneider","generic-elec","generic-mech"], (4,8), (1,6), (2,6,12,18), (300,5000), (1,4), (4,16,16,60), 4, (3,6), 0, 0, 0, (2,15), "kw"),
    AT("AHU heat-recovery wheel / UV-C lamp", ["munters","stulz","carrier","generic-mech"], (5,12), (4,16), (6,10,18,28), (2000,25000), (1,2), (1,4,4,16), 3, (3,6), 1, 0, 0, (20,200), None),
    AT("perimeter CRAH valve actuator", ["belimo","danfoss","johnson-controls","generic-elec"], (8,14), (1,4), (2,4,8,14), (100,2000), (2,12), (8,40,40,200), 5, (2,5), 0, 0, 0, (0.2,3), None),
    AT("rear-door HX fan / coil cleaning kit", ["rittal","motivair","stulz","generic-mech","generic-fluid"], (4,8), (1,6), (2,4,8,14), (100,2500), (1,8), (4,16,16,80), 4, (3,6), 0, 0, 0, (1,15), None),
    # COOLING — liquid (AI factory) deep additions
    AT("secondary CDU pump", ["coolit","asetek","motivair","grundfos","xylem"], (6,10), (3,12), (8,12,20,32), (4000,30000), (1,2), (2,6,6,24), 2, (3,6), 1, 0, 0, (12,70), "kw"),
    AT("CDU expansion tank / accumulator", ["taco","bell-gossett","xylem","generic-fluid","coolit"], (10,20), (2,8), (4,8,14,22), (500,6000), (1,2), (2,6,6,24), 3, (2,5), 1, 0, 0, (5,30), None),
    AT("CDU filtration cartridge (5µm/50µm)", ["coolit","asetek","parker","donaldson","generic-fluid"], (0.3,1), (0.5,2), (1,2,4,8), (50,600), (4,40), (10,40,40,200), 5, (2,4), 0, 0, 0, (0.2,2), None),
    AT("CDU flow control valve", ["belimo","danfoss","coolit","spirax-sarco","generic-fluid"], (8,14), (2,8), (4,8,14,22), (500,6000), (1,4), (2,8,8,30), 3, (3,6), 0, 0, 0, (1,8), None),
    AT("CDU coolant chemistry sensor", ["packet-power","honeywell","coolit","generic-elec"], (4,8), (1,4), (4,8,14,22), (300,4000), (1,4), (2,8,8,30), 3, (5,8), 0, 0, 0, (0.2,2), None),
    AT("cold-plate gasket / O-ring kit", ["coolit","asetek","parker","swagelok","generic-fluid"], (1.5,4), (0.5,3), (1,2,6,10), (30,500), (4,40), (50,500,500,5000), 5, (3,6), 0, 0, 0, (0.05,0.5), None),
    AT("manifold quick-disconnect blanking plug", ["staubli","cpc-colder","parker","coolit","generic-fluid"], (8,15), (0.5,2), (2,4,8,14), (20,400), (4,100), (100,1000,1000,10000), 5, (2,4), 0, 1, 0, (0.05,0.3), None),
    AT("dielectric fluid (bulk, per-litre)", ["3m-novec","engineered-fluids","grc","submer","liquidstack"], (1,3), (1,4), (2,4,8,14), (20,120), (20,200), (50,500,500,5000), 4, (3,6), 0, 0, 1, (0.9,1.0), None),
    AT("immersion-tank lid seal / gasket", ["grc","submer","liquidstack","iceotope","generic-fluid"], (3,8), (1,6), (4,8,14,22), (100,2000), (1,8), (4,20,20,80), 3, (4,7), 0, 0, 0, (0.5,8), None),
    AT("immersion fluid filtration cartridge", ["grc","submer","3m-novec","donaldson","generic-fluid"], (0.5,2), (1,4), (2,4,8,14), (80,1000), (2,20), (4,20,20,80), 4, (3,6), 0, 0, 0, (0.3,3), None),
    # COOLING — hydronics (deep additions)
    AT("vertical inline pump (VIL)", ["grundfos","xylem","armstrong","wilo","ksb","goulds-itt"], (8,15), (6,24), (6,10,18,28), (3000,30000), (1,2), (2,8,8,24), 3, (3,6), 1, 0, 0, (40,250), "kw"),
    AT("double-suction split-case pump", ["goulds-itt","xylem","flowserve","ksb","grundfos"], (10,18), (8,32), (8,14,24,36), (8000,80000), (1,1), (1,4,4,12), 2, (3,6), 1, 0, 0, (200,2000), "kw"),
    AT("submersible sump pump", ["grundfos","xylem","franklin","generic-mech","generic-fluid"], (5,10), (2,8), (2,6,12,18), (300,5000), (1,4), (2,6,6,20), 4, (2,5), 1, 0, 0, (8,60), "kw"),
    AT("pump coupling / flexible spider", ["generic-mech","xylem","grundfos","flowserve"], (2,6), (1,4), (1,3,6,10), (50,1000), (2,20), (4,16,16,80), 5, (2,4), 0, 0, 0, (0.2,5), None),
    AT("check valve (silent/spring-loaded)", ["watts-water","apollo-valves","victaulic","spirax-sarco","generic-fluid"], (15,25), (2,8), (2,4,8,14), (100,3000), (1,8), (4,16,16,80), 5, (2,4), 0, 0, 0, (0.5,15), None),
    AT("pressure relief valve (hydronic ASME)", ["spirax-sarco","watts-water","apollo-valves","generic-fluid"], (10,20), (1,4), (2,4,8,14), (80,2500), (1,8), (4,16,16,60), 5, (2,4), 0, 0, 0, (0.3,8), None),
    AT("backflow preventer (RP / DC type)", ["watts-water","apollo-valves","victaulic","generic-fluid"], (10,20), (2,8), (2,6,12,18), (200,5000), (1,4), (2,8,8,30), 4, (2,5), 0, 0, 0, (1,20), None),
    AT("flexible pipe connector / expansion joint", ["victaulic","generic-fluid","generic-mech"], (10,20), (2,8), (2,6,12,18), (100,3000), (2,12), (4,16,16,80), 5, (2,4), 0, 0, 0, (0.5,15), None),
    AT("pipe spring hanger / support", ["generic-mech","nvent","generic-fluid"], (20,40), (1,4), (2,4,8,14), (30,600), (4,40), (10,80,80,400), 5, (1,3), 0, 0, 0, (0.3,8), None),
    # FIRE-LIFE-SAFETY — new archetypes
    AT("linear heat detection cable", ["honeywell","bosch-fire","tyco-fire","generic-elec"], (10,20), (2,8), (4,8,14,22), (200,5000), (1,4), (4,20,20,80), 3, (4,7), 0, 0, 0, (0.2,5), None),
    AT("beam smoke detector", ["honeywell","bosch-fire","xtralis","generic-elec"], (8,15), (2,6), (4,8,14,22), (800,6000), (1,2), (4,16,16,60), 3, (4,7), 0, 0, 0, (0.5,4), None),
    AT("flame detector (UV/IR)", ["honeywell","bosch-fire","generic-elec"], (8,14), (2,6), (4,8,14,22), (500,5000), (1,2), (2,8,8,30), 3, (4,7), 0, 0, 0, (0.5,3), None),
    AT("duct smoke detector", ["honeywell","bosch-fire","tyco-fire","generic-elec"], (8,14), (1,4), (2,6,10,16), (100,1500), (2,12), (8,40,40,200), 4, (3,6), 0, 0, 0, (0.1,1), None),
    AT("sounder / strobe (NAC device)", ["honeywell","bosch-fire","tyco-fire","generic-elec"], (8,14), (0.5,2), (2,6,10,16), (30,500), (4,40), (20,100,100,600), 5, (2,5), 0, 0, 0, (0.1,1), None),
    AT("fire-pump test header / flow meter", ["pentair-fire","viking-fire","generic-fluid","generic-mech"], (15,25), (2,8), (6,10,18,28), (1000,12000), (1,1), (1,2,2,4), 2, (2,4), 0, 0, 0, (10,80), None),
    AT("pre-action air compressor / nitrogen generator", ["generic-mech","generic-elec","pentair-fire"], (5,10), (2,8), (4,8,14,22), (1500,15000), (1,1), (1,2,2,6), 2, (3,6), 1, 0, 0, (30,200), "kw"),
    AT("fire-panel SLC isolator / relay module", ["honeywell","bosch-fire","tyco-fire","kidde","generic-elec"], (10,18), (1,4), (4,8,14,22), (100,1200), (2,20), (8,60,60,300), 5, (3,6), 0, 0, 0, (0.05,0.5), None),
    AT("EVAC amplifier / voice alarm module", ["honeywell","bosch-fire","generic-elec"], (8,15), (2,8), (6,10,18,28), (1000,12000), (1,2), (2,8,8,30), 3, (4,7), 0, 0, 0, (1,8), None),
    AT("VESDA aspirating-pipe sampling filter (consumable)", ["xtralis","honeywell","bosch-fire","generic-mech"], (0.5,1.5), (0.5,2), (1,2,4,8), (10,200), (4,40), (8,40,40,200), 5, (2,4), 0, 0, 0, (0.01,0.2), None),
    # NETWORK-ICT — new archetypes
    AT("spine chassis line card / fabric module", ["arista","cisco","juniper","nvidia","hpe"], (8,14), (1,4), (6,12,20,32), (5000,80000), (1,2), (4,16,16,80), 2, (4,7), 1, 0, 0, (3,20), None),
    AT("AOC / DAC direct-attach cable", ["arista","cisco","corning","afl-ofs","generic-elec"], (10,20), (0.2,1), (1,3,6,10), (30,800), (4,40), (40,200,200,2000), 5, (2,4), 0, 0, 0, (0.1,1), None),
    AT("fiber pigtail / splice tray", ["corning","commscope","afl-ofs","panduit","leviton"], (20,40), (0.5,2), (1,3,6,10), (10,300), (4,40), (20,100,100,600), 5, (1,3), 0, 0, 0, (0.05,1), None),
    AT("MPO-MPO trunk / LC duplex patch cord", ["corning","commscope","panduit","siemon","belden"], (20,40), (0.2,1), (1,2,4,8), (15,400), (4,100), (40,200,200,2000), 5, (1,3), 0, 0, 0, (0.05,1), None),
    AT("PTP grandmaster / timing appliance", ["cisco","arista","honeywell","generic-elec"], (8,14), (1,4), (8,14,24,36), (3000,25000), (1,2), (2,8,8,30), 2, (4,7), 0, 0, 0, (2,10), None),
    AT("out-of-band cellular gateway", ["cisco","generic-elec","honeywell"], (5,10), (1,4), (2,4,8,14), (200,3000), (1,4), (2,8,8,40), 4, (3,6), 0, 0, 0, (0.2,2), None),
    AT("WDM mux/demux module", ["corning","commscope","afl-ofs","marvell-tech","generic-elec"], (15,25), (1,4), (4,8,14,22), (500,8000), (1,8), (4,20,20,100), 3, (3,6), 0, 0, 0, (0.2,3), None),
    # BMS-CONTROLS — new archetypes
    AT("I/O expansion module (DI/DO/AI/AO)", ["siemens","schneider","honeywell","distech","tridium","generic-elec"], (8,14), (1,4), (4,8,14,22), (200,4000), (1,4), (4,20,20,100), 4, (4,7), 0, 0, 0, (0.3,3), None),
    AT("building controller UPS / power supply", ["vertiv","schneider","eaton","generic-elec"], (6,12), (1,4), (2,6,12,18), (200,5000), (1,4), (2,8,8,30), 4, (3,6), 1, 0, 0, (1,10), "kw"),
    AT("CO2 / air-quality sensor", ["honeywell","distech","belimo","generic-elec"], (4,8), (0.5,2), (2,4,8,14), (80,1500), (2,20), (8,40,40,200), 5, (2,4), 0, 0, 0, (0.1,1), None),
    AT("differential-pressure transmitter (room/containment)", ["belimo","danfoss","honeywell","generic-elec"], (6,12), (1,4), (2,4,8,14), (100,2000), (2,12), (8,40,40,200), 4, (3,6), 0, 0, 0, (0.1,2), None),
    AT("current transducer (sub-metering)", ["schneider","camille-bauer","packet-power","generic-elec"], (8,14), (1,3), (2,4,8,14), (30,600), (4,40), (16,80,80,400), 5, (2,4), 0, 0, 0, (0.1,1), None),
    AT("field-bus repeater (RS-485/MS-TP)", ["tridium","distech","generic-elec"], (8,14), (1,3), (2,4,8,14), (80,1200), (1,4), (4,20,20,80), 4, (3,6), 0, 0, 0, (0.1,1), None),
    AT("SCADA HMI panel PC", ["siemens","schneider","honeywell","generic-elec"], (5,10), (2,8), (6,10,18,28), (1500,15000), (1,2), (2,8,8,30), 3, (5,8), 0, 0, 0, (2,12), None),
    # STRUCTURAL-CIVIL — new archetypes
    AT("perforated floor tile with damper", ["generic-mech","nvent","chatsworth"], (15,30), (0.5,2), (2,4,8,14), (60,600), (4,100), (100,1000,1000,10000), 5, (1,3), 1, 1, 0, (4,18), None),
    AT("cabinet blanking panel (1U/2U)", ["rittal","chatsworth","panduit","nvent","generic-mech"], (20,40), (0.1,0.5), (1,2,4,8), (5,60), (8,200), (100,2000,2000,20000), 5, (1,2), 0, 1, 0, (0.1,0.5), None),
    AT("cabinet earthing / bonding kit", ["nvent","panduit","generic-elec","generic-mech"], (20,40), (0.5,2), (1,3,6,10), (20,300), (4,40), (50,500,500,5000), 5, (1,3), 0, 0, 0, (0.3,5), None),
    AT("cable basket (wire mesh tray) / divider", ["nvent","legrand","panduit","generic-mech"], (20,40), (0.5,2), (1,4,8,14), (20,400), (4,100), (20,200,200,2000), 5, (1,3), 0, 0, 0, (1,15), None),
    AT("trapeze hanger / spring vibration isolator", ["nvent","generic-mech"], (20,40), (0.5,2), (2,4,8,14), (30,500), (4,40), (20,200,200,2000), 5, (1,3), 0, 0, 0, (0.5,12), None),
    # MONITORING — new archetypes
    AT("rack temperature string (multi-point)", ["packet-power","vertiv","schneider","generic-elec"], (5,10), (0.5,2), (1,3,6,10), (50,1000), (4,40), (20,100,100,600), 5, (2,4), 0, 0, 0, (0.1,1), None),
    AT("under-floor zoned leak rope", ["packet-power","honeywell","generic-elec"], (5,10), (1,4), (2,4,8,14), (200,4000), (1,8), (4,20,20,100), 4, (3,6), 0, 0, 0, (0.2,5), None),
    AT("thermal imaging camera (rack hot-spot)", ["honeywell","generic-elec"], (4,8), (1,4), (4,8,14,22), (1000,15000), (1,2), (2,8,8,30), 3, (3,6), 0, 0, 0, (0.5,5), None),
    AT("power-quality analyzer (portable)", ["camille-bauer","schneider","abb","generic-elec"], (6,12), (1,4), (4,8,14,22), (2000,25000), (1,2), (1,4,4,16), 3, (3,6), 0, 0, 0, (2,15), None),
    AT("UPS battery monitor (per-cell)", ["vertiv","schneider","eaton","packet-power","generic-elec"], (6,12), (1,4), (4,8,14,22), (50,1500), (2,20), (4,20,20,100), 4, (4,7), 0, 0, 0, (0.05,0.5), None),
    AT("vibration sensor (rotating equipment)", ["packet-power","honeywell","generic-elec"], (5,10), (1,4), (2,4,8,14), (100,3000), (2,12), (4,20,20,100), 4, (3,6), 0, 0, 0, (0.1,2), None),
    AT("ultrasonic clamp-on flow meter", ["camille-bauer","honeywell","danfoss","generic-elec"], (6,12), (1,4), (4,8,14,22), (500,8000), (1,4), (2,8,8,30), 3, (3,6), 0, 0, 0, (0.5,5), None),
    AT("transformer dissolved-gas analyzer (DGA)", ["abb","siemens","ge-grid","honeywell","generic-elec"], (6,12), (2,8), (8,14,24,36), (3000,30000), (1,1), (1,4,4,16), 2, (5,8), 0, 0, 0, (5,30), None),
]

# Failure-mode pools keyed loosely by subsystem family
FM_POOLS = {
    "rotating": [
        ("bearing wear", "Increased vibration → seizure → loss of flow/output", 5, "fatigue / lubrication breakdown / contamination", 7, 1),
        ("shaft seal leak", "Coolant/oil leak → low level → trip / contamination", 4, "seal-face wear / thermal cycling / misalignment", 6, 1),
        ("imbalance / misalignment", "Vibration → bearing damage → trip", 6, "foundation movement / coupling wear / debris", 5, 1),
        ("motor winding insulation breakdown", "Phase fault → motor failure → loss of unit", 7, "thermal aging / moisture / overvoltage transients", 8, 1),
        ("VFD / drive fault", "Drive trip → unit offline", 4, "DC-bus capacitor aging / overtemp / firmware fault", 6, 1),
    ],
    "compressor": [
        ("compressor mechanical failure", "Loss of cooling capacity → thermal excursion", 6, "lubrication loss / liquid slugging / bearing wear", 9, 1),
        ("refrigerant loss / leak", "Reduced capacity → trip on low pressure", 4, "joint/braze leak / corrosion / vibration fatigue", 7, 1),
        ("oil management fault", "Compressor starvation → bearing damage", 6, "oil-return path blockage / charge migration", 8, 1),
        ("control board / sensor fault", "Spurious trip or unsafe operation", 5, "component aging / EMI / firmware", 6, 0),
    ],
    "electronic": [
        ("electrolytic capacitor dry-out", "Output ripple / shutdown of board/module", 6, "thermal aging beyond rated life", 7, 0),
        ("control board firmware/logic fault", "Module locks up / spurious alarm / unsafe state", 7, "firmware bug / corrupted config / EMI", 7, 0),
        ("connector / solder-joint fatigue", "Intermittent then hard fault", 8, "thermal cycling / vibration", 6, 0),
        ("display / HMI failure", "Loss of local visibility / operability", 4, "backlight aging / touch-panel wear", 4, 0),
    ],
    "power": [
        ("IGBT / SCR module failure", "Loss of power conversion path → load drop or bypass", 6, "thermal cycling / overcurrent / driver fault", 9, 1),
        ("contactor / breaker contact wear", "High resistance → heating → failure to make/break", 6, "arc erosion / corrosion / loose connection", 7, 1),
        ("battery string capacity loss", "Reduced autonomy → outage on utility loss", 5, "calendar/cycle aging / float-voltage error / heat", 6, 1),
        ("transformer winding hot-spot / partial discharge", "Insulation breakdown → fault", 7, "overload / cooling-aux failure / moisture ingress", 9, 1),
        ("protection relay mis-coordination / failure to trip", "Fault not cleared → escalation / equipment damage", 8, "setting error / relay failure / CT/PT issue", 9, 0),
    ],
    "fluid": [
        ("gasket / O-ring leak", "Fluid loss → low level → trip / floor leak", 4, "elastomer aging / over-torque / chemistry attack", 5, 0),
        ("fouling / scaling", "Reduced heat transfer / flow → capacity loss", 5, "water chemistry / poor filtration / biofilm", 4, 0),
        ("corrosion / pitting", "Wall thinning → leak / failure", 6, "galvanic / oxygen ingress / chloride attack", 6, 1),
        ("valve actuator stick / fail", "Loss of flow control → unstable operation", 4, "actuator gear wear / signal loss / debris", 4, 0),
        ("strainer / filter blockage", "Pump cavitation / low flow → trip", 3, "debris loading not maintained", 3, 0),
    ],
    "fire": [
        ("detector contamination / drift", "False alarm or failure to detect", 5, "dust loading / aspiration-pipe blockage / aging", 8, 0),
        ("cylinder pressure loss / valve seal failure", "Suppression unavailable on demand", 6, "valve seal aging / temperature cycling", 9, 0),
        ("control panel / release-circuit fault", "Failure to release or false release", 7, "component aging / EOL-resistor drift / config", 9, 0),
        ("pump failure to start", "No fire-water on demand", 7, "controller fault / battery / engine no-start", 9, 0),
    ],
    "cooling-liquid": [
        ("coolant leak at fitting/quick-disconnect", "Drip → server risk / loop low level → trip", 4, "QD wear / seal aging / over/under torque", 8, 0),
        ("pump cavitation / loss of flow", "Chip overtemp → throttling / shutdown", 5, "air ingress / strainer blockage / low NPSH", 9, 0),
        ("HX fouling / approach-temp rise", "Reduced cooling margin → high coolant temp", 5, "chemistry drift / particulate loading", 6, 0),
        ("leak-sensor false trip / failure", "Spurious shutdown or missed leak", 6, "sensor contamination / cable damage / calibration", 7, 0),
        ("cold-plate microchannel clog", "Localized hot spot → device damage", 7, "particulate / corrosion product / poor filtration", 7, 0),
    ],
    "generic": [
        ("wear-out / end-of-service-life", "Degraded performance → failure", 4, "normal aging beyond service life", 5, 0),
        ("manufacturing defect / infant mortality", "Early-life failure", 3, "latent defect / handling damage", 5, 0),
        ("contamination / debris ingress", "Performance loss → failure", 4, "poor housekeeping / filtration", 4, 0),
        ("connector / fastener loosening", "Intermittent fault / leak", 5, "vibration / thermal cycling / poor torque", 4, 0),
    ],
}

def fm_pool_for(subsystem: str, l3: str) -> str:
    s = (subsystem + " " + l3).lower()
    if any(k in s for k in ["cdu","cold plate","manifold","quick-disconnect","immersion","direct-to-chip","dielectric","coolant","blanking plug","filtration cartridge","gasket","o-ring"]):
        return "cooling-liquid"
    if any(k in s for k in ["compressor","chiller"]):
        return "compressor"
    if any(k in s for k in ["pump","fan","motor","gearbox","turbocharger","alternator","coupling","spider","load bank","radiator core"]):
        return "rotating"
    if any(k in s for k in ["ups","switchgear","transformer","breaker","ats","sts","busway","pdu","battery","capacitor","relay","rectifier","igbt","power-meter","avr","harmonic filter","spd","tvss","rmu","oltc","bus-tie","arc-flash"]):
        return "power"
    if any(k in s for k in ["valve","heat-exchanger","strainer","gasket","pipe","tank","fitting","hx","expansion joint","spring hanger","backflow","nozzle header","dosing pump","cip skid","spray nozzle","sump","injector","level transmitter","float switch","leak-detection sensor","oil filter","purge","relief"]):
        return "fluid"
    if any(k in s for k in ["vesda","sprinkler","clean-agent","fire-pump","fire-panel","suppression","deluge","detector","cylinder","sounder","strobe","evac","aspiration","beam smoke","flame detector","duct smoke","linear heat","isolator module"]):
        return "fire"
    if any(k in s for k in ["board","controller","plc","gateway","rtu","hmi","ldc","sensor","actuator","panel","display","transceiver","switch","module","snmp","monitoring strip","i/o expansion","timing","dga","vibration sensor","flow meter","power-quality","battery monitor","temperature string","leak rope","thermal imaging","cellular gateway"]):
        return "electronic"
    return "generic"


# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------
def tax_index():
    """Build a lookup l3 -> taxonomy row."""
    idx = {}
    for row in TAXONOMY:
        idx[row[2]] = row  # l3 is unique-ish; last wins on dupes
    return idx

def gens_for(taxrow):
    return [g.strip() for g in taxrow[6].split(",") if g.strip()]

def tiers_for_gens(gens):
    t = set()
    for g in gens:
        if g == "legacy-raised-floor": t.update(["II","III"])
        elif g == "enterprise-tier3": t.update(["III","IV"])
        elif g == "colo-wholesale": t.update(["III","IV"])
        elif g == "cloud-hyperscale": t.update(["III","IV"])
        elif g == "ai-factory-liquid-cooled": t.update(["III","IV"])
        elif g == "edge-micro": t.update(["I","II"])
    return ",".join(sorted(t, key=lambda x:["I","II","III","IV"].index(x)))

LIFECYCLE_BY_GEN_BIAS = {
    # if part is mostly legacy → higher chance NRND/LTB/obsolete
    "legacy-raised-floor": [("active",0.45),("nrnd",0.30),("last-time-buy",0.15),("obsolete",0.10)],
    "enterprise-tier3":   [("active",0.78),("nrnd",0.15),("last-time-buy",0.05),("obsolete",0.02)],
    "colo-wholesale":     [("active",0.90),("nrnd",0.07),("last-time-buy",0.02),("obsolete",0.01)],
    "cloud-hyperscale":   [("active",0.93),("nrnd",0.05),("last-time-buy",0.01),("obsolete",0.01)],
    "ai-factory-liquid-cooled": [("active",0.97),("nrnd",0.02),("last-time-buy",0.005),("obsolete",0.005)],
    "edge-micro":         [("active",0.88),("nrnd",0.08),("last-time-buy",0.03),("obsolete",0.01)],
}

def pick_lifecycle(rng, gens):
    # pick the "oldest" generation bias present
    order = ["legacy-raised-floor","enterprise-tier3","edge-micro","colo-wholesale","cloud-hyperscale","ai-factory-liquid-cooled"]
    chosen = None
    for g in order:
        if g in gens:
            chosen = g; break
    dist = LIFECYCLE_BY_GEN_BIAS.get(chosen or "enterprise-tier3")
    r = rng.random(); acc = 0.0
    for status, p in dist:
        acc += p
        if r <= acc: return status
    return "active"

def round_sig(x, n=3):
    if x == 0: return 0.0
    d = math.ceil(math.log10(abs(x)))
    power = n - d
    return round(x, power)

def ratings_field(rng, rk, cost):
    """Return (capacity_rating, voltage_rating, current_rating_a, refrigerant_type)."""
    cap = None; volt = None; amp = None; refr = None
    if rk == "kva":
        cap = f"{rng.choice([250,400,500,750,800,1000,1250,1600,2000,2500,3000])} kVA"; volt = rng.choice(["400V AC","415V AC","480V AC"])
    elif rk == "kw":
        cap = f"{rng.choice([10,15,25,40,50,75,100,150,200,300,400])} kW"; volt = rng.choice(["400V AC","415V AC","480V AC","48V DC"])
    elif rk == "mva":
        cap = f"{rng.choice([10,16,25,40,63,80,100])} MVA"; volt = rng.choice(["11kV/0.4kV","22kV/0.4kV","33kV/11kV","132kV/33kV"])
    elif rk == "kv":
        volt = rng.choice(["7.2kV","12kV","15kV","17.5kV","24kV","36kV"])
    elif rk == "amp":
        amp = float(rng.choice([100,200,400,630,800,1200,1600,2000,2500,3200,4000,5000,6300])); volt = rng.choice(["400V AC","415V AC","480V AC","690V AC"])
    elif rk == "ton":
        cap = f"{rng.choice([200,300,400,500,700,900,1200,1500,2000,2500,3000])} ton"; refr = rng.choice(["R-134a","R-513A","R-1233zd(E)","R-1234ze","R-514A"])
    return cap, volt, amp, refr

def gen_part_number(rng, oem_id, archetype_l3, idx):
    pre = "".join(w[0] for w in oem_id.replace("-"," ").split())[:3].upper()
    mid = "".join(w[0] for w in archetype_l3.replace("/"," ").replace("-"," ").split())[:3].upper()
    return f"{pre}-{mid}{rng.randint(100,999)}-{rng.randint(10,99)}{rng.choice(['A','B','C','D','E','F',''])}"

def gen_model_family(rng, oem_id):
    fams = {
        "vertiv":["Liebert","EXL","APM","PowerNexus"],"schneider":["Galaxy","Symmetra","NetShelter","EcoStruxure"],
        "eaton":["93PM","9395","Power Xpert","xStorage"],"abb":["DPA","UNIGEAR","RMU","HiPerGuard"],
        "siemens":["SIVACON","SENTRON","8DJH","Desigo"],"carrier":["AquaForce","AquaEdge","19XR","19DV"],
        "trane":["CenTraVac","Sintesis","Series R","Stealth"],"daikin":["Magnitude","Pathfinder","Rebel","WGZ"],
        "johnson-controls":["YK","YZ","Metasys","Sapphire"],"stulz":["CyberAir","CyberRow","CyberCool","CMC"],
        "coolit":["CHx","DCLC","Rack DCLC"],"asetek":["InRackCDU","RackCDU"],"motivair":["MCDU","ChilledDoor"],
        "grundfos":["NB","TP","CR","MAGNA3"],"xylem":["e-1510","Series 1531","BPHE"],"alfa-laval":["M-line","T-line","CB","AC"],
        "rittal":["TS IT","LCP","RiLine","VX25"],"legrand":["PX","PXC","Starline","Master Switch"],
        "caterpillar":["C-Series","XQ","D-Series"],"cummins":["QSK","PowerCommand","C-Series"],
        "honeywell":["NOTIFIER","Gamewell","ComfortPoint","WEBs"],"tridium":["JACE","Niagara"],
        "arista":["7280R3","7050X4","7800R3"],"cisco":["Nexus 9000","Nexus 3000","Catalyst"],
        "corning":["EDGE8","SYSTIMAX","Pretium"],"commscope":["SYSTIMAX","Propel","HD"],
        "staubli":["RBE","SPI","RC","KDP"],"cpc-colder":["SS","SQ","NS","PMC"],
        "goulds-itt":["e-1510","ANSI-1511","AF","3657"],"ksb":["EtaLine","Etanorm","ZETA","Delta"],
        "flowserve":["Durco","Mark 3","Valtek","SIHI"],"watts-water":["LF25AUB","Series 009","LFBV","Series N600"],
        "apollo-valves":["77C-200","70-100","Serie 3000","S1C"],"spraying-systems":["UniJet","FullJet","Veejet","WhirlJet"],
        "marlo-culligan":["Softener Series","WS4","Twin-Alt","HiFlow"],"donaldson":["Torit","P-Series","Ultra-Web","SRF"],
        "mann-hummel":["H Series","WK","W","PU"],"3m-novec":["Novec 1230","Novec 7100","Novec 7200","Novec 649"],
        "engineered-fluids":["BioNovaTek EC-110","ElectriCool EC-100","EC-55","EC-250"],
        "afl-ofs":["Riser Bundle","AFL-FS","OFS TrueWave","AFL OPGW"],
        "belden":["Bonded Pair","9697","DataTwist 350","7964E"],"siemon":["Z-MAX","TERA","MAP","HD-MAX"],
        "marvell-tech":["COLORZ-II","ALASKA C","Prestera","Octeon"],
    }
    return rng.choice(fams.get(oem_id, ["Series " + str(rng.randint(100,9000)), "Pro", "X", "DC"]))


def build(scale: int):
    rng = random.Random(SEED)
    tidx = tax_index()
    oem_by_id = {o[0]:o for o in OEMS}

    parts_rows = []
    fm_rows = []
    compat_rows = []
    pid = 0

    variants_base = 3  # base variants per (archetype, oem)
    for arch in ARCHETYPES:
        l3 = arch["l3"]
        taxrow = tidx.get(l3)
        if not taxrow:
            # fall back: search by substring
            cands = [t for t in TAXONOMY if t[2].lower() in l3.lower() or l3.lower() in t[2].lower()]
            taxrow = cands[0] if cands else None
        if not taxrow:
            continue
        l1, l2, _l3, system, desc, tcrit, _gens = taxrow
        gens = gens_for(taxrow)
        subsystem = l2
        eligible_oems = [o for o in arch["oems"] if o in oem_by_id]
        if not eligible_oems:
            eligible_oems = ["generic-mech"]
        for oem_id in eligible_oems:
            oem = oem_by_id[oem_id]
            n_variants = max(1, variants_base * scale)
            for _v in range(n_variants):
                pid += 1
                part_id = f"RZ-SP-{pid:06d}"
                part_number = gen_part_number(rng, oem_id, l3, pid)
                model_family = gen_model_family(rng, oem_id)
                # dc_generation: a 1-3 generation subset of the eligible gens
                k = rng.randint(1, min(3, len(gens)))
                pgens = rng.sample(gens, k)
                # keep ordering stable-ish
                pgens = [g for g in DC_GENS if g in pgens]
                dc_generation = "|".join(pgens)
                dc_tier = tiers_for_gens(pgens)
                criticality = max(1, min(10, tcrit + rng.choice([-1,0,0,0,1])))
                mtbf = round_sig(rng.uniform(arch["mtbf_lo"], arch["mtbf_hi"]), 3)
                mttr = round_sig(rng.uniform(arch["mttr_lo"], arch["mttr_hi"]), 3)
                lt_min = arch["lt_min"]
                lt_typ = rng.randint(arch["lt_typ_lo"], arch["lt_typ_hi"])
                lt_max = max(lt_typ + 2, rng.randint(lt_typ, arch["lt_max"]))
                # OEM lead-time bias
                lt_typ = max(lt_min, int(round(lt_typ * (0.85 + (oem[6]) * 0.0))))  # placeholder neutral
                c_typ = round_sig(rng.uniform(arch["cost_lo"], arch["cost_hi"]), 3)
                c_min = round_sig(c_typ * rng.uniform(0.75, 0.92), 3)
                c_max = round_sig(c_typ * rng.uniform(1.10, 1.45), 3)
                moq = rng.randint(arch["moq_lo"], arch["moq_hi"])
                ib_min = rng.randint(arch["ib_min_lo"], arch["ib_min_hi"])
                ib_max = max(ib_min + 1, rng.randint(arch["ib_max_lo"], arch["ib_max_hi"]))
                lifecycle = pick_lifecycle(rng, pgens)
                # alternates: generic OEM → more; specialist/cutting-edge → fewer
                amax = arch["alts_max"]
                if oem[5] in ("specialist",) and "ai-factory-liquid-cooled" in pgens: amax = max(0, amax - 1)
                if oem[5] == "generic": amax = amax + 2
                alts = rng.randint(0, amax)
                if lifecycle in ("nrnd","last-time-buy") and rng.random() < 0.4: alts = max(0, alts - 1)
                if lifecycle == "obsolete": alts = rng.randint(0, max(0, amax - 1))
                eol = max(1, min(10, rng.randint(arch["eol_lo"], arch["eol_hi"]) + (2 if lifecycle in ("nrnd","last-time-buy") else 0) + (3 if lifecycle == "obsolete" else 0) + (1 if "legacy-raised-floor" in pgens else 0)))
                eol = min(10, eol)
                refurb = arch["refurb"] if rng.random() < 0.85 else (1 - arch["refurb"])
                print3d = arch["print3d"]
                hazmat = arch["hazmat"]
                weight = round_sig(rng.uniform(arch["weight_lo"], arch["weight_hi"]), 3)
                dims = None
                w_dim = max(50, int(weight ** 0.4 * 80))
                dims = f"{rng.randint(w_dim,int(w_dim*2.2))}x{rng.randint(int(w_dim*0.5),w_dim)}x{rng.randint(int(w_dim*0.6),int(w_dim*1.4))}"
                cap, volt, amp, refr = ratings_field(rng, arch["rk"], c_typ)
                certs = ",".join(rng.sample(["UL","cUL","CE","CSA","FM","ASHRAE-90.4","NFPA-75","NFPA-76","IEC-62040","IEEE-1547","UL-1741","EN-50600","ISO-50001"], k=rng.randint(2,4)))
                coo = rng.choice([oem[2], oem[2], "China","Mexico","Germany","United States","Japan","Italy","Czech Republic","Poland","India","Taiwan","Vietnam"])
                if oem_id.startswith("generic"): coo = rng.choice(["China","Mexico","India","Vietnam","Taiwan","Poland"])
                source_basis = "FMECA-style archetype ranges; lifecycle per DMSMS; lead-time/cost per industry-typical 2024-2026 values; OEM mapping from public product lines."
                notes = f"{desc}. Typical for: {', '.join(pgens)}. Lifecycle {lifecycle}; EOL risk {eol}/10; {alts} qualified alternate(s)."
                parts_rows.append((
                    part_id, part_number, oem_id, model_family, f"{desc} — {oem[1]} {model_family}",
                    system, subsystem, l1, l2, l3,
                    dc_generation, dc_tier,
                    criticality, mtbf, mttr,
                    lt_min, lt_typ, lt_max,
                    c_min, c_typ, c_max,
                    moq, lifecycle, ib_min, ib_max,
                    alts, eol,
                    refurb, print3d, weight, dims, volt, amp, cap, refr, None, certs,
                    coo, hazmat,
                    notes, source_basis,
                ))
                # failure modes
                pool = FM_POOLS[fm_pool_for(subsystem, l3)]
                nfm = rng.randint(2, min(5, len(pool)))
                for fm in rng.sample(pool, nfm):
                    mode, effect, detect, cause, sev, cm = fm
                    detect_j = max(1, min(10, detect + rng.choice([-1,0,1])))
                    sev_j = max(1, min(10, max(sev, criticality - 1) + rng.choice([-1,0])))
                    fm_rows.append((part_id, mode, effect, detect_j, cause, sev_j, cm, None))
                # compatibility: fits 1-3 facility types from pgens
                for g in pgens[:3]:
                    compat_rows.append((part_id, g, f"{oem[1]} {l2} equipment", "fits", None, None))
                if alts > 0 and rng.random() < 0.5:
                    compat_rows.append((part_id, None, None, "alternate", None, f"{alts} qualified alternate(s) available — see sourcing notes."))
                if lifecycle in ("nrnd","last-time-buy","obsolete") and rng.random() < 0.5:
                    compat_rows.append((part_id, None, None, "superseded-by", None, "Superseded by current-generation equivalent — requalification recommended."))

    return parts_rows, fm_rows, compat_rows


# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------
PARTS_COLS = [
    "part_id","part_number","oem_id","model_family","description",
    "system","subsystem","commodity_l1","commodity_l2","commodity_l3",
    "dc_generation","dc_tier_applicability",
    "criticality_default","mtbf_years","mttr_hours",
    "lead_time_weeks_min","lead_time_weeks_typ","lead_time_weeks_max",
    "unit_cost_usd_min","unit_cost_usd_typ","unit_cost_usd_max",
    "moq","lifecycle_status","typical_installed_base_per_site_min","typical_installed_base_per_site_max",
    "qualified_alternates_count","eol_risk",
    "refurbishable","printable_3d","weight_kg","dimensions_mm","voltage_rating","current_rating_a","capacity_rating","refrigerant_type","ip_rating","certifications",
    "country_of_origin","hazmat",
    "notes","source_basis",
]

def write_db(parts_rows, fm_rows, compat_rows):
    DATA_DIR.mkdir(exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    # remove WAL/SHM if present
    for ext in ("-wal","-shm"):
        p = Path(str(DB_PATH) + ext)
        if p.exists(): p.unlink()
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA.read_text())
    cur = con.cursor()
    # facility types
    cur.executemany(
        "INSERT INTO dc_facility_types(facility_type_id,name,era,typical_it_load_mw_min,typical_it_load_mw_max,typical_pue,cooling_architecture,power_architecture,typical_rack_density_kw_min,typical_rack_density_kw_max,key_equipment,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        FACILITY_TYPES,
    )
    # oems
    cur.executemany(
        "INSERT INTO oems(oem_id,name,hq_country,founded_year,commodities_supplied,dc_market_position,financial_health_score,typical_lead_time_weeks,typical_otif_pct,contract_models,single_source_risk,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        OEMS,
    )
    # taxonomy
    cur.executemany(
        "INSERT INTO commodity_taxonomy(l1,l2,l3,system,description,typical_criticality,typical_dc_generations) VALUES (?,?,?,?,?,?,?)",
        [(r[0],r[1],r[2],r[3],r[4],r[5],r[6]) for r in TAXONOMY],
    )
    # parts
    cur.executemany(
        f"INSERT INTO parts({','.join(PARTS_COLS)}) VALUES ({','.join('?'*len(PARTS_COLS))})",
        parts_rows,
    )
    # failure modes
    cur.executemany(
        "INSERT INTO failure_modes(part_id,failure_mode,failure_effect,detectability,typical_cause,fmeca_severity,condition_monitorable,notes) VALUES (?,?,?,?,?,?,?,?)",
        fm_rows,
    )
    # compatibility
    cur.executemany(
        "INSERT INTO compatibility(part_id,fits_facility_type_id,fits_oem_equipment,relationship,related_part_id,notes) VALUES (?,?,?,?,?,?)",
        compat_rows,
    )
    con.commit()
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.execute("VACUUM")
    con.close()


def write_csvs(parts_rows):
    DATA_DIR.mkdir(exist_ok=True)
    # gzipped parts CSV (gitignored)
    with gzip.open(DATA_DIR / "spares-parts.csv.gz", "wt", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(PARTS_COLS)
        w.writerows(parts_rows)
    # small CSVs (committed)
    with open(DATA_DIR / "spares-oems.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["oem_id","name","hq_country","founded_year","commodities_supplied","dc_market_position","financial_health_score","typical_lead_time_weeks","typical_otif_pct","contract_models","single_source_risk","notes"])
        w.writerows(OEMS)
    with open(DATA_DIR / "spares-taxonomy.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["l1","l2","l3","system","description","typical_criticality","typical_dc_generations"])
        w.writerows([(r[0],r[1],r[2],r[3],r[4],r[5],r[6]) for r in TAXONOMY])
    with open(DATA_DIR / "spares-facility-types.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["facility_type_id","name","era","typical_it_load_mw_min","typical_it_load_mw_max","typical_pue","cooling_architecture","power_architecture","typical_rack_density_kw_min","typical_rack_density_kw_max","key_equipment","notes"])
        w.writerows(FACILITY_TYPES)


def write_js_catalog(parts_rows):
    """Curated subset (~1-2 representative parts per archetype×OEM, capped) for the browser."""
    rng = random.Random(SEED + 7)
    # group by (commodity_l3, oem_id), keep at most 2 per group, cap total ~700
    by_group = {}
    for row in parts_rows:
        key = (row[9], row[2])  # commodity_l3, oem_id
        by_group.setdefault(key, []).append(row)
    curated = []
    for key, rows in by_group.items():
        rows = sorted(rows, key=lambda r: r[0])
        for r in rows[:2]:
            curated.append(r)
    rng.shuffle(curated)
    curated = curated[:445]
    curated = sorted(curated, key=lambda r: (r[5], r[6], r[2], r[0]))
    # compact records (drop verbose notes/source_basis to keep size down)
    def rec(r):
        d = dict(zip(PARTS_COLS, r))
        return {
            "id": d["part_id"], "pn": d["part_number"], "oem": d["oem_id"], "fam": d["model_family"],
            "desc": d["description"], "sys": d["system"], "sub": d["subsystem"],
            "l1": d["commodity_l1"], "l2": d["commodity_l2"], "l3": d["commodity_l3"],
            "gen": d["dc_generation"], "tier": d["dc_tier_applicability"],
            "crit": d["criticality_default"], "mtbf": d["mtbf_years"], "mttr": d["mttr_hours"],
            "ltMin": d["lead_time_weeks_min"], "ltTyp": d["lead_time_weeks_typ"], "ltMax": d["lead_time_weeks_max"],
            "cMin": d["unit_cost_usd_min"], "cTyp": d["unit_cost_usd_typ"], "cMax": d["unit_cost_usd_max"],
            "moq": d["moq"], "life": d["lifecycle_status"],
            "ibMin": d["typical_installed_base_per_site_min"], "ibMax": d["typical_installed_base_per_site_max"],
            "alts": d["qualified_alternates_count"], "eol": d["eol_risk"],
            "refurb": d["refurbishable"], "p3d": d["printable_3d"], "wkg": d["weight_kg"],
            "cap": d["capacity_rating"], "volt": d["voltage_rating"], "refr": d["refrigerant_type"],
        }
    oem_recs = [dict(zip(["id","name","hq","founded","commodities","position","fin","leadWk","otif","contracts","ssr","notes"], o)) for o in OEMS]
    tax_recs = [dict(zip(["l1","l2","l3","system","desc","crit","gens"], (r[0],r[1],r[2],r[3],r[4],r[5],r[6]))) for r in TAXONOMY]
    fac_recs = [dict(zip(["id","name","era","mwMin","mwMax","pue","cooling","power","rackKwMin","rackKwMax","keyEquip","notes"], f)) for f in FACILITY_TYPES]
    payload = {
        "meta": {"generated": "build-spares-db.py", "curatedParts": len(curated), "schema": "tools/spares-db-schema.sql"},
        "parts": [rec(r) for r in curated],
        "oems": oem_recs,
        "taxonomy": tax_recs,
        "facilityTypes": fac_recs,
    }
    js = "/* Auto-generated by tools/build-spares-db.py — curated subset of the DC spare-parts DB.\n"
    js += "   Full DB: data/spares-parts.sqlite (gitignored, regenerate with `python3 tools/build-spares-db.py`).\n"
    js += "   Do not edit by hand. */\n"
    js += "window.SPARES_CATALOG = " + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + ";\n"
    out = ROOT / "js" / "spares-parts-catalog.js"
    out.write_text(js, encoding="utf-8")
    return out, len(js.encode("utf-8")), len(curated)


def audit(parts_rows, fm_rows, compat_rows):
    print("\n=== AUDIT ===")
    print(f"parts:          {len(parts_rows):,}")
    print(f"failure_modes:  {len(fm_rows):,}")
    print(f"compatibility:  {len(compat_rows):,}")
    print(f"oems:           {len(OEMS)}")
    print(f"taxonomy rows:  {len(TAXONOMY)}")
    print(f"facility types: {len(FACILITY_TYPES)}")
    di = {c:i for i,c in enumerate(PARTS_COLS)}
    from collections import Counter
    sys_c = Counter(r[di["system"]] for r in parts_rows)
    sub_c = Counter(r[di["subsystem"]] for r in parts_rows)
    life_c = Counter(r[di["lifecycle_status"]] for r in parts_rows)
    gen_c = Counter()
    for r in parts_rows:
        for g in r[di["dc_generation"]].split("|"): gen_c[g]+=1
    oem_c = Counter(r[di["oem_id"]] for r in parts_rows)
    print(f"\ndistinct OEMs in parts: {len(oem_c)}")
    print(f"distinct subsystems:    {len(sub_c)}")
    print(f"system distribution:    {dict(sys_c)}")
    print(f"lifecycle distribution: {dict(life_c)}")
    print(f"dc-generation tag counts: {dict(gen_c)}")
    print(f"top 8 OEMs by part count: {oem_c.most_common(8)}")
    # sanity
    bad = 0
    for r in parts_rows:
        if not r[di["part_id"]]: bad+=1
        if (r[di["mtbf_years"]] or 0) <= 0: bad+=1
        if not (r[di["unit_cost_usd_min"]] <= r[di["unit_cost_usd_typ"]] <= r[di["unit_cost_usd_max"]]): bad+=1
        if not (r[di["lead_time_weeks_min"]] <= r[di["lead_time_weeks_typ"]] <= r[di["lead_time_weeks_max"]]): bad+=1
        if not (1 <= (r[di["criticality_default"]] or 0) <= 10): bad+=1
    print(f"\nsanity violations: {bad}")
    if bad: print("  !! some rows violate invariants — investigate");
    else: print("  ✓ all parts pass invariants (part_id non-null, mtbf>0, cost min≤typ≤max, lt min≤typ≤max, crit 1-10)")


def main():
    ap = argparse.ArgumentParser(description="Build the DC spare-parts SQLite database.")
    ap.add_argument("--scale", type=int, default=1, help="row-count multiplier (1 ≈ baseline; 5 ≈ ~5x; 20 ≈ toward millions)")
    ap.add_argument("--audit", action="store_true", help="print row counts + distributions + sanity checks")
    ap.add_argument("--no-js", action="store_true", help="skip writing js/spares-parts-catalog.js")
    args = ap.parse_args()
    if not SCHEMA.exists():
        sys.exit(f"[error] schema not found: {SCHEMA}")
    print(f"Building DC spare-parts DB · scale={args.scale} · seed={SEED}")
    parts_rows, fm_rows, compat_rows = build(args.scale)
    write_db(parts_rows, fm_rows, compat_rows)
    write_csvs(parts_rows)
    db_size = DB_PATH.stat().st_size
    print(f"  → {DB_PATH}  ({db_size/1e6:.1f} MB)  ·  parts={len(parts_rows):,}  failure_modes={len(fm_rows):,}  compat={len(compat_rows):,}")
    print(f"  → data/spares-parts.csv.gz, data/spares-oems.csv, data/spares-taxonomy.csv, data/spares-facility-types.csv")
    if not args.no_js:
        jp, jsz, jn = write_js_catalog(parts_rows)
        print(f"  → {jp}  ({jsz/1024:.0f} KB, {jn} curated parts)")
    if args.audit:
        audit(parts_rows, fm_rows, compat_rows)


if __name__ == "__main__":
    main()
