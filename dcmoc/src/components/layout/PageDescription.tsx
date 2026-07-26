'use client';

import React from 'react';
import { Info } from 'lucide-react';

/* Workstream H — per-page "what this page is for" descriptions. ONE registry +
 * ONE component, injected once in the Shell above every tab's content, keyed by
 * the active tab id — so a user never has to guess what a page does. Keep each
 * `what` to a single plain sentence; `use` (optional) says when/why to use it. */
export interface PageDescriptionEntry {
    title: string;   // human page name (matches the breadcrumb)
    what: string;    // what this page shows / computes
    use?: string;    // when to use it / what decision it supports
}

export const PAGE_DESCRIPTIONS: Record<string, PageDescriptionEntry> = {
    dashboard: { title: 'Executive Overview', what: 'A one-screen summary of the project — capacity, cost, availability and sustainability headlines pulled from every engine.', use: 'Start here for the current state; drill into a specific engine from the sidebar.' },
    requirements: { title: 'Requirements', what: 'The single source of truth for the project inputs — IT load, tier, cooling, redundancy, location, workload mix and business targets.', use: 'Set these first; every other page computes from them.' },
    site: { title: 'Site Intelligence', what: 'Location screening — grid reliability, climate, seismic/flood risk, talent and tax by candidate country/city.', use: 'Compare sites before committing a location.' },
    capacity: { title: 'Capacity Planning', what: 'Phased build-out of IT and facility capacity, with per-component headroom and utilization checks.', use: 'Plan how the hall fills over time and spot under-sized systems.' },
    'fuel-gen': { title: 'Fuel & Generator', what: 'Generator sizing, fuel consumption, cost and CO₂ — by power-source topology (utility-backup / prime off-grid / hybrid) and fuel type.', use: 'Model standby vs continuous prime power and compare diesel/HVO/gas/solar.' },
    cdu: { title: 'CDU / Liquid Cooling', what: 'Coolant-loop hydraulics, refrigerant selection, deep-sea option, and the water & glycol balance (evaporation, blowdown, drift, WUE).', use: 'Size the liquid-cooling loop and understand its water footprint.' },
    architecture: { title: 'Architecture', what: 'A single-line diagram of the power and cooling trains generated live from the requirements (redundancy, feeds, gensets, chillers).', use: 'See how the design topology changes as you edit requirements.' },
    capex: { title: 'CAPEX Engine', what: 'Bottom-up capital cost by discipline with soft costs, contingency and front-of-meter, plus a full bill-of-quantities dossier.', use: 'Get the build cost and trace where every dollar comes from.' },
    finance: { title: 'Financial', what: 'Project economics — NPV, IRR, payback and TCO at the configured revenue and cost assumptions.', use: 'Test whether the project clears the investment hurdle.' },
    'phased-finance': { title: 'Phased Financial', what: 'Multi-phase capital and revenue schedule with per-phase and blended returns.', use: 'Model a staged build where capacity and revenue ramp over years.' },
    invest: { title: 'Investment Committee', what: 'A committee-style verdict on the project (NPV/IRR/MoIC) with bull/bear framing.', use: 'Summarise the investment case for a decision.' },
    strategic: { title: 'Strategic', what: 'Fund-grade strategic assessment — return metrics, scenarios and committee verdicts.', use: 'Frame the deal at portfolio/fund level.' },
    carbon: { title: 'Carbon & ESG', what: 'Scope 1/2/3 emissions, WUE, and the cost of carbon at the site grid mix and cooling choice.', use: 'Assess the sustainability profile and offset/compliance cost.' },
    reliability: { title: 'Reliability Engine', what: 'Availability, expected downtime and the nines by tier and redundancy (RAM model).', use: 'Check the design meets the SLA before committing redundancy spend.' },
    risk: { title: 'Risk', what: 'Downtime risk and its financial impact under the current configuration.', use: 'Quantify what an outage would cost.' },
    ops: { title: 'Operations Overview', what: 'The operating model — staffing, shifts, maintenance strategy and campus topology.', use: 'See how the site is run day-to-day.' },
    sim: { title: 'Staff Model Config', what: 'A what-if simulator for staffing cost — headcount, shift model, vendor mix, AQI and turnover, with a cause-effect lever map.', use: 'Trade off in-house vs vendor and see the cost levers.' },
    staff: { title: 'Staffing', what: 'Detailed headcount build-up by role, shift and coverage.', use: 'Size and cost the operations team.' },
    maint: { title: 'Maintenance', what: 'Maintenance strategy mix (reactive/planned/predictive), vendor SLA and its availability impact.', use: 'Choose a maintenance model and see its cost/uptime trade.' },
    talent: { title: 'Talent', what: 'Local talent availability, wage and attrition drivers by location.', use: 'Understand staffing risk in a given market.' },
    spares: { title: 'Spares', what: 'Critical-spares stocking by component using a newsvendor model.', use: 'Decide how many spares to hold to hit an availability target.' },
    'asset-lifecycle': { title: 'Asset Lifecycle', what: 'Equipment life, replacement timing and lifecycle cost.', use: 'Plan capital replacements over the asset life.' },
    'asset-health': { title: 'Asset Health', what: 'Condition and health scoring across the installed asset base.', use: 'Spot assets trending toward failure.' },
    cbm: { title: 'Condition-Based Maintenance', what: 'Sensor-driven maintenance triggers and remaining-useful-life estimates.', use: 'Move from calendar to condition-based servicing.' },
    construction: { title: 'Construction', what: 'Work-breakdown structure, schedule and construction labor/cost by phase.', use: 'Plan and track the build programme.' },
    commissioning: { title: 'Commissioning', what: 'The Cx programme — checklist, integrated systems tests and Monte-Carlo schedule/cost.', use: 'Plan Level 1–5 commissioning and its duration/cost.' },
    grid: { title: 'Grid Reliability', what: 'Utility outage frequency and duration for the site, feeding generator run-hours.', use: 'Understand grid quality and its impact on backup runtime.' },
    tax: { title: 'Tax & Incentives', what: 'Corporate tax, duties and incentive regimes by country, with sub-tabs for tax/disaster/grid.', use: 'Factor tax and grants into the economics.' },
    disaster: { title: 'Disaster & Resilience', what: 'Natural-hazard exposure (seismic, flood, storm) and resilience measures.', use: 'Assess and price site resilience.' },
    compliance: { title: 'Compliance', what: 'Regulatory and standards compliance status for the project.', use: 'Track permits and standards obligations.' },
    benchmark: { title: 'Benchmark', what: 'The project versus industry benchmarks (PUE, WUE, cost/MW, availability).', use: 'See how the design compares to the market.' },
    montecarlo: { title: 'Monte Carlo', what: 'Probabilistic ranges on cost/schedule/availability by sampling the input uncertainties.', use: 'Understand the spread of outcomes, not just a point estimate.' },
    portfolio: { title: 'Portfolio', what: 'Roll-up of multiple projects/sites into one portfolio view.', use: 'Compare and aggregate across sites.' },
    scenarios: { title: 'Scenarios', what: 'Saved what-if scenarios of the project configuration.', use: 'Capture and revisit alternative designs.' },
    'scenario-compare': { title: 'Scenario Compare', what: 'Side-by-side comparison of saved scenarios across key metrics.', use: 'Pick between design alternatives.' },
    diagnostics: { title: 'Diagnostics Center', what: 'A cross-engine list of at-risk metrics with the reason, threshold and levers to fix each.', use: 'Find and act on everything currently out of band.' },
    tier: { title: 'Tier Classification', what: 'The Uptime tier the design qualifies for and what each tier requires.', use: 'Confirm the design meets the target tier.' },
    fire: { title: 'Fire Suppression', what: 'Fire detection/suppression sizing and agent selection.', use: 'Size the fire system and its cost.' },
    report: { title: 'Report', what: 'A printable executive report assembled from every engine.', use: 'Export a shareable project summary.' },
    projects: { title: 'Projects', what: 'Your saved projects — open, duplicate or start a new one.', use: 'Manage which project you are working on.' },
    templates: { title: 'Templates', what: 'Starter project templates for common designs.', use: 'Begin from a proven configuration.' },
    'data-library': { title: 'Data Library', what: 'The sourced reference data behind the engines (arch profiles, cooling tech, markets, supply chain).', use: 'Inspect and cite the underlying assumptions.' },
    knowledge: { title: 'Knowledge Base', what: 'The engine catalog and methodology — models, parameters and their sources, rendered live.', use: 'Understand how a number is computed and where it comes from.' },
    integrations: { title: 'Integrations', what: 'External system connections and data feeds.', use: 'Configure integrations.' },
    settings: { title: 'Settings', what: 'Application preferences and defaults.', use: 'Adjust how the app behaves.' },
    audit: { title: 'Audit Log', what: 'A record of changes made in the app.', use: 'Review who changed what.' },
    users: { title: 'Users', what: 'User and access management.', use: 'Manage who can access the project.' },
    faq: { title: 'FAQ', what: 'Glossary, analogies and answers to common questions about the model.', use: 'Look up a term or how something works.' },
};

/** Injected once in the Shell — renders the description for the active tab. */
export function PageDescription({ tabId }: { tabId: string }) {
    const entry = PAGE_DESCRIPTIONS[tabId];
    if (!entry) return null;
    return (
        <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40 px-3.5 py-2.5"
            role="note" aria-label={`About the ${entry.title} page`}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" />
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{entry.title}.</span>{' '}
                {entry.what}
                {entry.use && <span className="text-slate-400 dark:text-slate-500"> {entry.use}</span>}
            </p>
        </div>
    );
}
