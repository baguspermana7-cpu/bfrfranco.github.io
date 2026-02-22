MEDIUM DRAFT SETTINGS (fill these in before publishing):
SEO Title: Alarm Fatigue Is a System Design Failure, Not a Human One
(Preview: "Alarm Fatigue Is a System Design Failure, Not a Human One | by Bagusdpermana | Medium" = 74 chars, fits 74 limit)
SEO Description: When data center operators ignore alarms, the system has failed them. ISA-18.2 rationalization achieved 90% alarm reduction and 75% faster response times in a live facility.
(173 / 195 chars)
Tags: Alarm Management, Data Center, Safety Engineering, Human Factors, ISA 18.2
Images: Cover image (article-2-cover.jpg), Generator ops photo (2.1.jpg), Alarm taxonomy photo (2.2.jpg)
---

# Alarm Fatigue Is Not a Human Problem. It Is a System Design Failure.

An operator sits down to begin his 12-hour shift. Before he can take off his jacket, the BMS console shows 847 active alarms. By 07:00, 63 new alarms have arrived. He acknowledges them in batches, not because he has assessed them, but because the screen is full and new alarms stop appearing when the queue is at capacity.

At 07:23, a genuine chiller fault triggers. It is buried under 34 consequential downstream alarms. He sees it. He clicks acknowledge. He moves on.

At 09:15, the data hall reaches 27C, four degrees above threshold. The root fault was there for 112 minutes.

This operator was not negligent. He was not undertrained. He was operating a system that had been engineered to fail him.

---

# The Misattribution Problem

When a critical alarm is missed and an incident occurs, the organizational response follows a predictable pattern. Investigate the operator. Check training records. Issue corrective actions. Increase supervision.

This approach feels intuitively correct. An alarm sounded, a person failed to respond, therefore the person is the problem. But this reasoning commits a well-known cognitive error, the fundamental attribution error, the tendency to attribute behavior to personal characteristics while underestimating situational factors.

James Reason's Swiss cheese model of organizational accidents demonstrates that incidents are never caused by a single human error at the sharp end. They result from the alignment of latent conditions: system design decisions, management choices, and organizational cultures that create the conditions for error. When 800 alarms arrive per day and 95% are known nuisance conditions, the operator who stops investigating each one is not being negligent. They are adapting rationally to an irrational system.

Erik Hollnagel's Safety-II perspective extends this further. Human variability is not the enemy of safety but the source of it. Operators who learn to filter noise and focus on what matters are performing a necessary cognitive function that the alarm system has failed to perform for them. The problem is that this human filtering is unreliable, imprecise, and degrades with fatigue, which is exactly why it should have been an engineering function in the first place.

Organizations that blame operators for alarm fatigue will never solve it. They are treating a symptom while reinforcing the root cause. Every disciplinary action for a missed alarm sends the message that the system is fine and the people are broken. The opposite is true.

---

# Cognitive Architecture Under Alarm Overload

The reason alarm fatigue is inevitable under poor system design is rooted in fundamental human cognitive architecture.

Endsley's situation awareness model operates at three levels. Level 1 is perception: detecting that an alarm has occurred. Level 2 is comprehension: understanding what the alarm means in context. Level 3 is projection: predicting what will happen if action is not taken.

Under alarm overload, operators cannot progress beyond Level 1. They perceive the alarm, but lack the cognitive bandwidth to comprehend it or project its consequences. They click acknowledge and move on. This is not complacency. It is the predictable behavior of a cognitive system operating beyond its design capacity.

Wickens' multiple resource theory demonstrated that human attention is not a single resource but a set of parallel channels, each with finite capacity. When the visual-cognitive channel is saturated by alarm notifications, the operator cannot simultaneously perform other visual-cognitive tasks, such as monitoring trends, reviewing procedures, or interpreting system states. The alarm system, intended to improve safety, actually degrades it by consuming the attentional resources needed for safe operation.

ISA-18.2 provides concrete benchmarks for alarm rates based on human factors research. An operator can reliably process a maximum of approximately 1 alarm per 10-minute period. Beyond this threshold, cognitive load exceeds sustainable levels and response quality degrades not gradually, but as a cliff-edge collapse. An operator receiving 5 alarms per 10 minutes is not five times busier than one receiving 1. They are effectively unable to process any of them reliably.

The ISA-18.2 performance benchmarks break down as follows:

Very Likely Acceptable: 1 or fewer alarms per operator per 10 minutes (72 or fewer per 12-hour day)

Maximum Manageable: up to 2 per 10 minutes (up to 144 per day)

Overloaded: 2 to 5 per 10 minutes (144 to 360 per day)

Very Likely Unacceptable: more than 5 per 10 minutes (more than 360 per day)

---

# Three Standards That Govern Alarm Management

Three major standards govern alarm management in industrial and critical infrastructure environments.

ISA-18.2-2022 is the North American standard. It defines the complete alarm management lifecycle from philosophy through ongoing audit. Its core principle: every alarm must require a specific operator action within a defined timeframe. No action required means it is not an alarm.

EEMUA Publication 191 is the foundational UK publication, first published in 1999. It established the alarm rate benchmarks later formalized by ISA-18.2. Each alarm must provide information not available from any other source on the console.

IEC 62682:2022 is the international equivalent, focused on alarm timeliness. An alarm that arrives after the safety limit is exceeded is not an alarm. It is a post-incident log entry.

The three standards share a common philosophical foundation. An alarm is not a notification. It is a demand for human action. Systems that blur this distinction, by treating alarms as status indicators, event logs, or informational messages, are engineering failures regardless of how sophisticated the underlying technology may be.

---

# A Taxonomy of Alarm System Design Failures

Chattering alarms cycle rapidly between active and clear states when a process variable oscillates near its setpoint. A single chattering temperature alarm on an AHU return air sensor can generate 30 to 50 alarm events per hour if the deadband is insufficiently configured. This is a pure engineering failure. The solution is proper deadband configuration, not operator discipline.

Standing alarms remain permanently active, often for days, weeks, or months. They typically represent known conditions that cannot be immediately resolved. Standing alarms are the single largest contributor to alarm list clutter and operator desensitization.

Stale alarms are configured for conditions that are no longer operationally relevant. A temperature alarm for a decommissioned space, a flow alarm for a redesigned system. These accumulate over years of system changes without corresponding alarm system updates.

Consequential alarms are downstream effects of a single root cause. When a chiller trips, the effects may include high supply temperature, low flow, high return temperature, high room temperature across multiple zones, and low differential pressure, each generating its own alarm. A single event can produce 20 to 50 consequential alarms within minutes, burying the root cause in noise.

Nuisance alarms are technically correct but operationally useless. A communication fault alarm that occurs every time a BMS controller performs a routine polling cycle. A door open alarm for a door that is legitimately open during occupied hours. These alarms meet their technical trigger conditions but provide no information that requires or enables operator action.

---

# Quantifying the Problem: Alarm Flood Analysis

An alarm flood is defined by ISA-18.2 as the condition where more than 10 alarms arrive within a 10-minute period for a single operator. During alarm floods, effective human response capacity approaches zero.

Alarm arrivals during steady-state operations can be modeled as a Poisson process. At a daily rate of 800 alarms (approximately 5.6 alarms per 10-minute window), the probability of experiencing an alarm flood in any given 10-minute window is approximately 7%. Over a 12-hour shift with 72 such windows, the probability that at least one alarm flood occurs is approximately 99.5%.

The operator will be overwhelmed. The question is not whether, but when.

During a cascade event, an operator may receive 50 to 100 alarms in 10 minutes. Research from the ASM Consortium and Hollifield and Habibi demonstrates that effective attention drops to near zero under these conditions. The operator is not failing. The system has created conditions in which success is impossible. No amount of training can overcome a 50-to-1 alarm-to-capacity ratio.

---

# The Pre-Intervention Reality

The following case comes from a live data center during the construction-to-operations transition, one of the highest-risk periods in facility lifecycle management.

Daily alarm count: 800 to 1,200 alarms per 24-hour period.
Per-operator rate: 33 to 50 alarms per operator per hour with 2 operators per shift.
ISA-18.2 rate: 5.6 to 8.3 alarms per operator per 10 minutes, classified as Very Likely Unacceptable.
Standing alarms: 120 to 180 at any given time.
Nuisance percentage: approximately 95% of all alarms were known conditions requiring no action.

Operators were acknowledging alarms without investigation because 95% were known nuisance conditions. This behavior was entirely rational. Investigating each alarm at a rate of 50 per hour would consume the operator's entire cognitive capacity for alarm processing alone, leaving zero capacity for actual facility monitoring, trend analysis, or emergency response. Yet this rational adaptation meant that the 5% of genuine critical alarms were being treated identically to the 95% that were noise.

The system had trained the operators to ignore it.

Management's initial response followed the predictable pattern: propose more training, suggest performance improvement plans, discuss adding a third operator per shift. None of these would have solved the underlying problem. Adding a third operator would have reduced the per-capita rate from approximately 8 to approximately 5.5 alarms per 10 minutes, still in the Overloaded category per ISA-18.2.

---

# The 6-Step Rationalization

Alarm rationalization is the ISA-18.2 term for the systematic process of reviewing every alarm against defined engineering criteria. The following methodology was implemented over a 10-week period while the facility remained fully operational.

Step 1: Alarm Census. Every configured alarm point was extracted from the BMS and SCADA systems. Total configured alarm points: 3,847. Each was documented with its tag, description, setpoint, deadband, priority, and associated equipment.

Step 2: Classification by Type. Each active alarm was classified as chattering, standing, stale, consequential, or nuisance. This was performed jointly by the operations team and controls engineering to ensure both operational context and technical accuracy.

Step 3: Master Alarm Database (MAD) Creation. The MAD became the single source of truth. Every surviving alarm was documented with rationalized priority, setpoint and deadband with engineering justification, required operator response (specific, actionable, time-bounded), and management of change requirements for future modifications.

Step 4: Isolation Matrices for Construction Zones. Construction zones were logically isolated from the operational alarm system. Alarms from areas under active construction were routed to construction management systems rather than operations consoles. This single step eliminated approximately 40% of all operational alarms. Both populations received more relevant information. Operations saw fewer nuisance alarms. Construction saw alarms specific to their work areas.

Step 5: Permit-to-Work Integration. When a maintenance permit was active, associated alarms were automatically contextualized or suppressed based on pre-defined rules. A chiller offline alarm during a scheduled maintenance window was annotated rather than generating a critical alarm.

Step 6: Tiered Response Protocol. Alarms were restructured into four tiers. Critical required immediate response within 5 minutes. High required response within 15 minutes. Medium required response within 1 hour. Low was addressed on the next routine round. Only Critical and High alarms generated audible notifications. Medium alarms appeared on the summary screen. Low-priority conditions were logged for trending without generating real-time events.

---

# Results Over 90 Days

Alarm volume reduction: more than 90%. Daily alarm count went from 800 to 1,200 down to fewer than 80. The ISA-18.2 rate dropped from 5.6 to 8.3 alarms per operator per 10 minutes to 0.56, well within the Very Likely Acceptable range.

Response time improvement: 75%. Mean time from alarm activation to first operator action decreased from 180 seconds to 45 seconds. More importantly, response quality improved. Operators were executing defined response procedures rather than simply acknowledging and moving on.

ISA-18.2 compliance: from 12% to 89%. The composite score went from failing on all four primary metrics to meeting or exceeding targets on alarm rate, actionable ratio, and standing alarm percentage.

Zero missed critical alarms over a 6-month post-intervention tracking period.

Zero false evacuations in the 90-day post-intervention period, compared to three in the preceding 90 days.

Operator confidence: 100% of operators reported improved confidence in the alarm system and 90% reported reduced stress levels. Operators began proactively reporting alarm configuration issues rather than silently adapting around them, indicating a cultural shift toward alarm system ownership.

No additional staff were hired. No new technology was purchased. The system itself was the problem, and restructuring it was the solution.

---

# The Organizational Dimension

The technical interventions are necessary but not sufficient. Sustainable alarm management requires organizational change.

Management must stop blaming operators. When an alarm is missed, the first question should be: why did the system present this alarm in a way that made it easy to miss? Not: why did the operator fail to respond?

Alarm rationalization is not a one-time project. It is a continuous process that must be integrated into management of change. Every new piece of equipment, every control modification, every procedure change can introduce new alarms. Without MOC integration, the system will drift back toward its pre-rationalization state within 12 to 18 months.

Alarm metrics should be treated as leading safety indicators. The daily alarm rate, standing alarm count, chattering count, and ISA-18.2 compliance score are all predictive of future incident probability. A rising alarm rate is a warning signal that should trigger proactive intervention.

The most consequential example of alarm system failure in industrial history occurred at Three Mile Island in 1979. During the initial phase of the accident, operators were confronted with over 100 alarms within the first few minutes, many of them contradictory. The alarm system, rather than guiding operators toward the correct diagnosis, actively impeded their ability to understand what was happening.

Decades later, the same fundamental design failures continue to be replicated in data centers, hospitals, chemical plants, and other critical infrastructure. The standards exist. The knowledge exists. The solutions exist. What too often does not exist is the organizational willingness to implement them.

---

# The Measure of a Good Alarm System

Alarm fatigue is a predictable, quantifiable, and solvable engineering problem.

It arises from alarm systems that generate more information than human operators can cognitively process. The failure is in the design, not the operator.

International standards provide clear guidance. ISA-18.2, EEMUA 191, and IEC 62682 define the alarm management lifecycle, performance benchmarks, and rationalization methodology. These are practical engineering frameworks validated across decades of industrial experience.

The mathematics are unambiguous. At 800+ alarms per day for two operators, alarm floods are a statistical certainty, cognitive overload is inevitable, and the alarm system provides negative safety value. It degrades rather than enhances operator performance.

Structured rationalization works. A systematic, standards-based approach achieved more than 90% alarm reduction, 75% response time improvement, and ISA-18.2 compliance improvement from 12% to 89% in a live data center, without adding staff, purchasing new technology, or compromising safety coverage.

The measure of a good alarm system is not how many alarms it generates, but how few, while still catching every genuine problem.

---

Originally published at resistancezero.com.

The full interactive version of this article includes an ISA-18.2 compliance calculator, Poisson alarm flood probability modeling, a Monte Carlo risk simulation with 10,000 iterations, and an interactive Sankey diagram showing how 3,847 configured alarm points were rationalized down to 391 active points:

https://resistancezero.com/article-2.html

---

# References

[1] Reason, J. (1997). Managing the Risks of Organizational Accidents. Ashgate Publishing.

[2] Hollnagel, E. (2014). Safety-I and Safety-II: The Past and Future of Safety Management. CRC Press.

[3] Endsley, M. R. (1995). Toward a Theory of Situation Awareness in Dynamic Systems. Human Factors, 37(1), 32-64.

[4] ISA-18.2-2022. Management of Alarm Systems for the Process Industries. International Society of Automation.

[5] EEMUA Publication 191 (2013). Alarm Systems: A Guide to Design, Management and Procurement. 3rd Edition.

[6] IEC 62682:2022. Management of alarm systems for the process industries. International Electrotechnical Commission.

[7] Hollifield, B. and Habibi, E. (2010). The Alarm Management Handbook. 2nd Edition. PAS/ISA.

[8] Wickens, C. D. (2008). Multiple Resources and Mental Workload. Human Factors, 50(3), 449-455.

[9] Uptime Institute (2024). Annual Outage Analysis 2024.

[10] Uptime Institute (2024). Global Data Center Survey 2024.

[11] NRC (1979). Three Mile Island: A Report to the Commissioners and to the Public. NUREG/CR-1250.

[12] ASM Consortium (2013). Effective Alarm Management Practices.

[13] Nimmo, I. (2002). Adequately Address Abnormal Situations. Chemical Engineering Progress, 98(9), 36-44.

[14] UK Health and Safety Executive (2003). HSG48: Reducing Error and Influencing Behaviour. 2nd Edition.
