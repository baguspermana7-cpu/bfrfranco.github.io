MEDIUM DRAFT SETTINGS (fill these in before publishing):
SEO Title: No Incident Is Not Evidence of Safety
(Preview: "No Incident Is Not Evidence of Safety | by Bagusdpermana | Medium" = 65 chars, fits 74 limit)
SEO Description: 70% of data center outages had detectable precursors weeks before failure. Drift-to-failure theory, weak signal taxonomy, leading indicators, and Safety Health Index for critical infrastructure.
(194 / 195 chars)
Tags: Data Center Safety, Leading Indicators, Safety Culture, Critical Infrastructure, Reliability Engineering
Images: Cover image (shift operations), Rasmussen boundary model diagram screenshot, case study comparison table screenshot
---

# Why "No Incident" Is Not Evidence of Safety

## The Green Dashboard Problem

Your data center has been incident-free for 18 months. The dashboard is green. Management is celebrating. KPI targets are met. Budgets are maintained -- or reduced, because if nothing is breaking, perhaps less investment is needed.

And you might be closer to a catastrophic failure than you were a year ago.

That sounds counterintuitive, but safety science backs it up. Uptime Institute's 2023 Annual Outage Analysis found that 70% of data center outages were caused by factors that had been present -- and potentially detectable -- for weeks or months before the incident occurred. The 2024 report confirmed that human error, often manifesting as procedural drift during "stable" periods, remained the leading root cause category.

The incidents did not appear suddenly. They accumulated quietly while the dashboard stayed green.

This is the central paradox of incident-free operations: the absence of incidents is not evidence of safety. It is evidence that boundaries have not yet been crossed. In complex socio-technical systems, those are fundamentally different propositions, and confusing them is the first step toward catastrophe.

---

# The Dangerous Comfort of Zero

The logic appears sound on the surface. If the goal of safety management is to prevent incidents, then the absence of incidents must indicate successful safety management. But this reasoning commits what philosophers call the fallacy of absence of evidence as evidence of absence. The fact that we have not observed a failure does not mean the conditions for failure are not present. It means only that those conditions have not yet been sufficient to produce an observable outcome.

Consider a data center operating for 365 days without a power-related incident. Management interprets this as confirmation that the electrical infrastructure is performing well. But during those 365 days, several conditions may have developed silently.

UPS battery strings may have lost capacity below manufacturer specifications, but because no utility outage occurred, the degradation went untested by real-world demand. HVAC performance may have degraded gradually, with hot spots developing that remained within alarm thresholds but represented a shrinking safety margin. Maintenance procedures may have been shortened or skipped under operational pressure, with each successful shortcut reinforcing the belief that the full procedure was unnecessary. Recurring nuisance alarms may have been acknowledged without investigation, training operators to ignore signals that could indicate early-stage failures.

None of these conditions produce incidents on their own. They accumulate quietly, each one narrowing the gap between normal operations and catastrophic failure. James Reason described this as the Swiss cheese model -- each degraded condition represents a hole in a defensive layer, and it is only when the holes align that an accident passes through all defenses simultaneously.

The danger is compounded by organizational incentive structures. When zero incidents are achieved, the behavior that produced the zero is rewarded -- regardless of whether that behavior was genuinely safe or merely lucky. Erik Hollnagel identifies this as the core problem with Safety-I thinking: the organization learns to optimize for the absence of negative outcomes rather than the presence of positive safety behaviors.

In practice, this means the team that cuts a maintenance window short to meet operational targets and suffers no incident is rewarded equally -- or more -- than the team that takes the full maintenance window and identifies a latent defect. The first team delivered efficiency. The second team delivered safety. But the KPI dashboard cannot distinguish between the two.

Perhaps most insidiously, the comfort of zero creates normative pressure against reporting. When an organization celebrates its incident-free record, individual operators face social and professional pressure not to be the person who breaks the streak. Near-misses go unreported. Anomalies are rationalized. Workarounds become standard practice.

The HSE Research Report 367 documented this phenomenon across multiple industries, finding that organizations with the strongest incident-free cultures often had the weakest near-miss reporting rates. The correlation was not incidental -- it was causal. The pursuit of zero had created silence where there should have been signal.

---

# Drift-to-Failure: How Organizations Migrate Toward Catastrophe

Jens Rasmussen's 1997 paper "Risk Management in a Dynamic Society" introduced the concept of drift-to-failure as a systemic property of complex socio-technical systems. Rather than viewing accidents as the result of individual errors or component failures, Rasmussen demonstrated that accidents emerge from the gradual migration of organizational behavior toward and eventually across safety boundaries.

His model describes system behavior as existing within a space bounded by three constraints: the economic failure boundary (too much cost, too little revenue), the unacceptable workload boundary (burnout, turnover, errors), and the safety boundary (equipment failure, environmental hazard, human harm).

Two forces drive systematic drift. The gradient toward least effort pushes behavior toward the safety boundary. The gradient toward efficiency pushes behavior toward the safety boundary. Combined, they produce systematic migration toward that boundary over time, even without any individual decision to be unsafe.

The critical insight is that each individual step in the drift is locally rational. A maintenance team reduces a 4-hour procedure to 3 hours. It saves time, reduces workload, and faces no immediate consequence because the safety boundary is still some distance away. The 3-hour procedure becomes the new standard. Six months later, pressure reduces it to 2.5 hours. Then to 2 hours. At no point does anyone make a conscious decision to be unsafe. Each step is a marginal adaptation to competing pressures. But the cumulative effect is progressive erosion of the safety margin until the system operates at the very edge of its boundary -- where even a small perturbation can cause it to cross over into failure.

Drift is invisible for three reasons. First, the boundary itself is invisible. The point at which a UPS system transitions from "operating with adequate margin" to "operating with insufficient margin to survive a dual utility failure" is not accompanied by a dashboard change. Second, drift is rewarded. Each step closer to the boundary typically comes with efficiency gains. Third, drift is normalized. Once a deviation from original design becomes established practice, it ceases to be perceived as a deviation. It becomes the way things are done.

Sidney Dekker further developed this concept, noting that drift into failure is a property of systems, not of individuals. The drift occurs because the system is doing exactly what it was designed to do: adapt to local pressures while maintaining production. The problem is that adaptation, in the absence of equally strong safety feedback, always tends in one direction.

---

# Normalization of Deviance: When Unacceptable Becomes Standard

Diane Vaughan's concept of the normalization of deviance, developed in her landmark study of the 1986 Challenger disaster, describes the process by which organizations gradually accept previously unacceptable conditions as normal.

The mechanism follows a predictable sequence. An initial deviation occurs -- a PM task performed with a simplified checklist rather than the full manufacturer protocol, or a Management of Change process bypassed for "minor" changes. No immediate consequence follows. Because nothing went wrong, the deviation is rationalized: the full procedure takes too long, the MoC process is too bureaucratic for something this simple. The rationalized deviation becomes the new standard. New team members are trained on the deviated procedure, not the original. Then a new deviation occurs from the already-deviated standard, and the cycle repeats.

In critical facilities, this manifests in consistent patterns. Lock-out/tag-out procedures gradually simplified from multi-step verification to single-check processes. CMMS work orders closed as "complete" with incomplete testing, driven by pressure to clear the backlog. BMS alarm thresholds widened to reduce nuisance alarms, inadvertently narrowing the warning window between normal operation and failure. Changes classified as like-for-like to avoid the change management process. Critical operations performed by one person instead of the designed two-person protocol.

Vaughan's most important finding was that normalization is not a failure of vigilance. The engineers and managers at NASA who normalized the O-ring erosion problem were not negligent. They were following the organizational logic available to them: the erosion had been observed, analyzed, and determined to be within acceptable limits based on prior successful flights. Each successful flight reinforced the conclusion. The deviance was not hidden -- it was visible but reclassified as acceptable. This is precisely what happens in data centers when a known deviation produces no incident.

The most dangerous aspect is accumulation. A data center may simultaneously have simplified LOTO procedures, widened BMS alarm thresholds, deferred maintenance items, single-person operations for two-person tasks, and bypassed MoC processes. Each individual normalization may represent an acceptable risk. But collectively, they create a system state that the original designers never intended and the original risk assessment never evaluated. This is what Charles Perrow called a normal accident -- a failure emerging not from any single cause but from the unexpected interaction of multiple degraded conditions that were each individually "acceptable."

---

# Weak Signals: What the Dashboard Cannot Show

If incident-free periods mask accumulating risk, then the critical question becomes: what signals exist that could reveal the hidden drift? Weick and Sutcliffe, in their study of High Reliability Organizations, identified preoccupation with failure as a defining characteristic of organizations that successfully detect and respond to emerging risk. This preoccupation manifests as systematic attention to weak signals -- subtle deviations that individually appear insignificant but collectively indicate systemic drift.

Five categories of weak signals are relevant to data center operations.

Operational anomalies include recurring nuisance alarms acknowledged but not investigated, HVAC temperature variations showing increasing amplitude while remaining within thresholds, UPS battery test results meeting minimum requirements but showing declining trends, and generator start times increasing even when still within specification.

Procedural drift signals include maintenance tasks consistently completed faster than estimated duration, CMMS work orders with identical completion notes across different tasks, increasing use of "N/A" in checklist items, and SOP versions that no longer match actual practice.

Organizational stress signals include rising overtime hours for key technical personnel, increasing turnover in experienced operators, declining participation in safety meetings, and knowledge concentration in a small number of individuals.

Reporting suppression signals include declining near-miss report rates during high operational tempo, near-miss reports with decreasing detail, and informal resolution of safety concerns without documentation.

System coupling signals include growing numbers of systems sharing single points of failure, reduced isolation capability between independent systems, and maintenance windows requiring multiple systems to be at elevated risk simultaneously.

Barry Turner demonstrated in 1978 that every major disaster he studied was preceded by an incubation period during which weak signals were present but unrecognized. The signals were not absent. They were unstructured, unowned, and unacted upon.

---

# The 18-Month Case: What Silent Drift Looks Like

Consider a composite case drawn from patterns observed across multiple critical facilities. A Tier III data center serving financial services clients operates for 18 consecutive months without a reportable incident.

During months 1 through 6, the facility maintains full compliance with all maintenance protocols. Near-miss reports average 4 to 5 per month. FMEA reviews are conducted quarterly. Safety meetings are well-attended with active participation.

During months 7 through 12, maintenance window pressures increase as client load grows. Two experienced operators leave, replaced by less experienced staff. Near-miss reports decline to 1 to 2 per month. RCA completion times extend from 5 days to 15 days. Management celebrates the zero-incident milestone.

During months 13 through 18, informal workarounds become standard for three maintenance procedures. BMS alarm thresholds are widened twice to reduce noise. Near-miss reports drop to zero -- interpreted as evidence of improving safety. A budget request for additional training is deferred because the numbers look great.

At month 18, the dashboard shows perfect performance. Every lagging indicator is green. But the leading indicator profile tells a different story. Near-miss reports went from 4.5 per month to zero. RCA completion time went from 5 days to 15-plus. Training hours per quarter dropped from 16 to 6. Open audit findings rose from 3 to 14. Management safety walks fell from 4 per month to 1. Three procedure deviations had been normalized.

The system has drifted substantially toward its safety boundary. The conditions for a significant failure are present. Only the triggering event -- a utility outage, an equipment demand beyond degraded capacity, a human error in a simplified procedure -- is missing. And the organization, looking at its lagging indicator dashboard, has no awareness of the accumulated risk.

---

# Lagging vs Leading: The Measurement Problem

To understand why this happens, we must distinguish between two fundamentally different types of safety measurement. Lagging indicators measure outcomes after failure has occurred. Leading indicators measure conditions before failure becomes possible.

By the time a lagging indicator moves, control is already lost. The incident has occurred, the SLA has been breached, the injury has happened. Lagging indicators are useful for accountability and learning from failure, but they are structurally incapable of preventing the next failure. An organization that relies exclusively on lagging indicators is, by definition, operating blind to emerging risk.

The fundamental challenge is measurement asymmetry. Lagging indicators are binary and unambiguous: an incident either occurred or it did not. Leading indicators are continuous and interpretive: a near-miss report requires judgment about what constitutes "near," an audit finding requires assessment of severity. This asymmetry creates organizational preference for lagging indicators. They are easier to collect, easier to report, and easier to benchmark.

A facility manager can state with confidence that the site had zero safety incidents in Q4. Stating that the leading indicator profile suggests elevated systemic risk despite zero incidents requires far more nuance, carries career risk, and may be met with skepticism by management that conflates absence of incidents with presence of safety.

Patrick Hudson's safety culture maturity model places organizations relying primarily on lagging indicators at the reactive or calculative stages of safety maturity. Only at the proactive and generative stages do organizations systematically measure and act on leading indicators.

---

# Eight Leading Indicators That Move Before Failure

Based on the theoretical foundations of drift-to-failure, normalization of deviance, and HRO principles, eight leading indicators are specifically designed for critical facility operations.

Near-miss report rate, measured as reports per month per 100 staff, with a target of 10 or more. This indicates reporting culture health. Declining rates signal suppression.

Weak signal identification rate, measured as documented weak signals per month, targeting 15 or more. This measures organizational sensitivity to emerging risk.

Open audit finding count, measured as unresolved findings at month-end, targeting 5 or fewer. Rising count indicates organizational overload.

Safety training hours, measured per person per quarter, targeting 20 or more. Declining hours correlate directly with procedural drift.

Management safety walks, targeting 8 or more per month per facility. These demonstrate leadership commitment and provide independent observation data.

Hazard action close rate, measuring the percentage of identified hazards resolved within SLA, targeting 85% or above. Declining rate indicates normalization.

Safety meeting frequency, targeting weekly cadence. Less frequent meetings correlate with drift.

MTTR variance coefficient, measuring standard deviation divided by mean of repair times, targeting 0.3 or below. High variance indicates inconsistent competency.

The critical observation is that these indicators are designed to move before an incident occurs. A declining composite score during an incident-free period is precisely the paradox this analysis addresses: the leading indicators are deteriorating while the lagging indicators remain green. This is drift-to-failure in quantitative form.

---

# Culture Determines Everything: The Westrum Typology

The theoretical and practical frameworks presented here converge on a single conclusion: the transition from lagging-indicator dependence to leading-indicator competence requires cultural transformation. Ron Westrum's organizational culture typology provides the framework.

In pathological organizations, power-oriented cultures hoard information. Messengers are penalized for bad news. Responsibilities are shirked. Failure leads to scapegoating. Leading indicator programs will fail here because the information they generate threatens power structures. Near-miss reports will be suppressed. Audit findings will be buried.

In bureaucratic organizations, rule-oriented cultures follow channels. Information flows through standard processes. Leading indicator programs can function mechanistically -- data is collected, reports generated, meetings held -- but the information rarely drives genuine change. The metrics become compliance artifacts rather than decision-making tools.

In generative organizations, performance-oriented cultures actively seek and share information. Messengers are trained and rewarded. Failure leads to inquiry, not blame. Responsibilities are shared. Leading indicators are valued precisely because they provide early warning. The Safety Health Index becomes a genuine operational tool.

The relationship is not one-directional. Implementing a leading indicator program can itself shift organizational culture, provided leadership demonstrates genuine commitment to acting on the information. When operators see that their near-miss reports lead to visible improvements, reporting increases. When audit findings are closed promptly, the value of the audit process is reinforced. Each cycle builds trust in the system, moving the organization from bureaucratic compliance toward generative engagement.

---

# The Central Argument

"No incident" is a lagging indicator masquerading as a safety statement. It tells us that boundaries have not been crossed. It tells us nothing about how close to those boundaries the organization is operating, how fast it is drifting toward them, or how many normalized deviances have accumulated along the way.

Drift is systematic. Organizations under production pressure inevitably migrate toward safety boundaries. The drift is driven by predictable forces and follows a predictable trajectory.

Normalization masks drift. As deviations accumulate without consequence, they are reclassified from deviance to normal. The organization loses the ability to perceive its own degradation.

Weak signals precede failure. Every major failure is preceded by an incubation period during which detectable signals are present. The question is whether the organization has the structures, culture, and will to detect and act on them.

Leading indicators can reveal the invisible. A well-designed set of leading indicators -- measuring near-miss reporting, weak signal detection, audit health, training investment, management engagement, hazard closure, and meeting cadence -- can make the invisible drift visible.

Culture determines effectiveness. The Westrum typology demonstrates that leading indicators function as intended only in organizational cultures that value information flow and respond to bad news with inquiry rather than blame.

For data center operators managing UPS, PDU, HVAC, BMS, and associated infrastructure, the practical implication is clear: celebrate incident-free periods cautiously, and complement them with rigorous leading indicator programs that measure the conditions under which the next incident becomes possible.

A green dashboard does not mean the system is safe. It means the system has not yet failed. Safety lives in signals that precede failure, not in the absence of visible harm. Organizations that learn to see weak signals trade false confidence for true resilience. Those that do not will continue to be surprised by failures that, in retrospect, were always visible -- just not measured.

The full interactive article includes a Safety Health Index calculator that quantifies the gap between perceived safety and systemic drift risk using all eight leading indicators.

---

# References

[1] Rasmussen, J. (1997). "Risk Management in a Dynamic Society: A Modelling Problem." Safety Science, 27(2-3), 183-213.

[2] Vaughan, D. (1996). The Challenger Launch Decision: Risky Technology, Culture, and Deviance at NASA. University of Chicago Press.

[3] Hollnagel, E. (2014). Safety-I and Safety-II: The Past and Future of Safety Management. Ashgate Publishing.

[4] Reason, J. (1997). Managing the Risks of Organizational Accidents. Ashgate Publishing.

[5] Uptime Institute. (2023). Annual Outage Analysis 2023. Uptime Institute Research.

[6] Uptime Institute. (2024). Annual Outage Analysis 2024. Uptime Institute Research.

[7] Health and Safety Executive. (2005). A Review of Safety Culture and Safety Climate Literature for the Development of the Safety Culture Inspection Toolkit. Research Report 367.

[8] Hudson, P. (2007). "Implementing a Safety Culture in a Major Multi-National." Safety Science, 45(6), 697-722.

[9] Dekker, S. (2011). Drift into Failure: From Hunting Broken Components to Understanding Complex Systems. Ashgate Publishing.

[10] Perrow, C. (1999). Normal Accidents: Living with High-Risk Technologies. Princeton University Press (Updated Edition).

[11] Weick, K. E., & Sutcliffe, K. M. (2007). Managing the Unexpected: Resilient Performance in an Age of Uncertainty. 2nd Edition. Jossey-Bass.

[12] Leveson, N. (2011). Engineering a Safer World: Systems Thinking Applied to Safety. MIT Press.

[13] Turner, B. A. (1978). Man-Made Disasters. Wykeham Publications.

[14] IAEA. (2016). Leadership and Management for Safety. IAEA Safety Standards Series No. GSR Part 2.

[15] ICAO. (2018). Safety Management Manual (SMM). Doc 9859, 4th Edition.

[16] Westrum, R. (2004). "A Typology of Organisational Cultures." Quality & Safety in Health Care, 13(suppl 2), ii22-ii27.

---

Originally published at [resistancezero.com](https://resistancezero.com/article-8.html)
