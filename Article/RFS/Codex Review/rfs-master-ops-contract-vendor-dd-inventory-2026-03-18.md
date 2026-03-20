# RFS Master Inventory - SOP, Contracts, Vendor DD, Documentation, and Commercial Readiness

Date: 2026-03-18

Purpose: this is the complete non-testing RFS inventory that should sit beside L0-L5 technical commissioning. It is designed to be usable as:
- app taxonomy
- checklist source
- gate requirement library
- owner matrix input
- customer review pack structure

Primary draft basis:
- SOP, spares, maintenance, fuel, insurance, staffing in [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md#L1172)
- closure, documentation, permits, certifications in [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md#L1009)
- customer and commercial readiness in [dc-commissioning-calculator-spec.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-calculator-spec.md#L1715)
- IST gating logic in [dc-commissioning-test-protocols.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-test-protocols.md#L1061) and [dc-commissioning-test-protocols.md](/home/baguspermana7/rz-work/Article/RFS/Draft/dc-commissioning-test-protocols.md#L1329)

This document extends the draft with a more mature vendor due diligence structure, contract clauses, and app-ready classification rules.

## 1. How This Inventory Should Be Used

Every item below should be modeled in the app with at least:
- `domain`
- `subdomain`
- `item code`
- `title`
- `description`
- `why it matters`
- `owner role`
- `evidence required`
- `gate relevance`
- `blocker class`
- `source class`
- `customer overlay allowed`
- `status`

Recommended blocker classes:
- `hard`: gate cannot close without it
- `soft`: gate can progress with waiver or risk acceptance
- `info`: tracking only

Recommended gate relevance:
- `G0` baseline locked
- `G1` safe to energize
- `G2` startup ready
- `G3` FPT ready
- `G4` IST ready
- `G5` facility RFS ready
- `G6` customer acceptance ready
- `G7` turnover complete

## 2. Master RFS Taxonomy

The full non-testing RFS domain should be grouped as:
- `B` Project closure and documentation
- `C` Certificates, permits, and regulatory
- `D` SOPs, MOPs, EOPs, and operational playbooks
- `E` Spares and consumables
- `F` Maintenance and support contracts
- `G` Fuel, utility, and infrastructure supply contracts
- `H` Insurance and risk transfer
- `I` Staffing, training, competency, and on-call readiness
- `J` Customer, commercial, legal, and service readiness
- `K` Vendor due diligence and serviceability assurance

`K` is the major enhancement that must be added to your app model. It is only partially implied in the draft and should become explicit.

## 3. SOP, MOP, EOP, and Playbook Library

### 3.1 Governance and management SOPs

These are baseline management controls and should exist before any live operation.

Required items:
- operations policy
- roles and responsibilities matrix
- shift handover procedure
- management of change procedure
- risk assessment procedure
- incident management procedure
- problem management procedure
- escalation matrix
- communications matrix
- vendor management procedure
- contract management procedure
- document control procedure
- audit and compliance procedure
- KPI reporting procedure
- capacity management procedure
- asset lifecycle management procedure
- budget and financial management procedure
- continuous improvement procedure
- lessons learned procedure
- management review meeting cadence

Recommended app classification:
- gate relevance: `G0`, `G5`, `G7`
- blocker class: mostly `hard` for MOC, escalation, incident, document control; `soft` for KPI and continuous improvement

### 3.2 Normal operations SOPs

These are day-1 live operations procedures.

Electrical:
- daily electrical rounds
- UPS monitoring and alarm response
- generator readiness check
- ATS and STS monitoring
- power quality review
- PDU load balancing check
- EPMS reading and logging

Mechanical:
- daily mechanical rounds
- chiller plant monitoring
- cooling tower monitoring
- CRAH and CRAC monitoring
- CDU monitoring for DLC systems
- water treatment monitoring
- pump and valve status review

Fire and safety:
- fire panel status check
- VESDA status review
- fire suppression system status
- EPO status review
- emergency lighting check

Controls and visibility:
- BMS alarm review
- environmental trend review
- DCIM dashboard review
- alarm threshold management

Security:
- security console monitoring
- access log review
- CCTV review
- perimeter patrol
- badge inventory control

Fuel:
- bulk tank level check
- day tank check
- fuel transfer test schedule
- delivery receiving protocol
- fuel quality review

Recommended app classification:
- gate relevance: `G5`
- blocker class: `hard` where normal operation of critical systems has no approved procedure

### 3.3 Emergency procedures

These are EOP-grade playbooks and should be treated as gate-critical for RFS.

Required emergency procedures:
- total utility failure
- partial utility loss
- UPS failure
- generator fail to start
- generator fail during run
- single cooling failure
- full cooling loss
- fire alarm response
- suppression discharge response
- water leak response
- flood response
- earthquake response
- severe weather response
- security breach response
- suspicious package response
- chemical spill response
- medical emergency response
- building evacuation
- cyber incident escalation
- pandemic or mass casualty response
- EPO activation and recovery
- cascading multi-system failure response

Recommended app classification:
- gate relevance: `G4`, `G5`
- blocker class: `hard`

### 3.4 Maintenance procedures

These are not optional because they determine operability after handover.

Preventive maintenance procedures:
- PM program by discipline
- PM frequencies
- PM work order creation and closure

Corrective maintenance procedures:
- fault diagnosis
- repair versus replace logic
- spare part requisition
- OEM call-out
- post-repair testing

Predictive maintenance procedures:
- thermal imaging
- vibration analysis
- fluid analysis
- power quality trending
- predictive analytics workflow if used

Generator-specific:
- weekly no-load test
- monthly load test
- annual full-load test
- oil and filter change
- coolant service
- fuel system service
- ATS and STS test

UPS and battery-specific:
- monthly inspection
- quarterly test
- annual discharge test
- battery replacement
- module replacement
- firmware update

Recommended app classification:
- gate relevance: `G5`, `G7`
- blocker class: `hard` for core PM structure, `soft` for predictive enhancements

### 3.5 EHS procedures

Required EHS items:
- arc flash safety procedure
- LOTO procedure
- confined space procedure
- work at height procedure
- hot work permit procedure
- chemical handling procedure
- PPE requirements
- visitor and contractor safety induction
- incident investigation
- near-miss reporting
- toolbox talk procedure
- first aid procedure
- fire warden duty
- evacuation drill procedure
- environmental monitoring procedure

Recommended app classification:
- gate relevance: `G1`, `G4`, `G5`
- blocker class: `hard`

### 3.6 Access and customer service SOPs

Required items:
- customer access procedure
- visitor access procedure
- contractor access procedure
- emergency after-hours access
- receiving and delivery procedure
- move-in and move-out procedure
- remote hands procedure
- cross-connect install procedure
- customer orientation and training
- complaint handling
- SLA reporting
- planned maintenance and incident communication

Recommended app classification:
- gate relevance: `G6`, `G7`
- blocker class: mixed `hard` and `soft`

### 3.7 MOP and change execution library

Your draft mentions MOC, but the app should explicitly model MOPs, not just generic SOPs.

Required MOP classes:
- UPS maintenance bypass MOP
- ATS or STS isolation MOP
- generator service MOP
- transformer outage MOP
- chiller shutdown and recovery MOP
- cooling train isolation MOP
- CDU maintenance MOP
- BMS software update MOP
- fire system impairment MOP
- security zone maintenance MOP
- fuel transfer system maintenance MOP
- cross-connect or carrier work MOP

Required fields:
- preconditions
- risk statement
- step sequence
- backout plan
- communication requirements
- witness requirements
- approver list

Recommended app classification:
- gate relevance: `G5`, `G6`
- blocker class: `hard` for critical infrastructure

### 3.8 EOP and response drill library

For app maturity, EOPs should be separate from SOPs.

Required EOP classes:
- power path failure
- cooling path failure
- fire event
- BMS or EPMS visibility loss
- leak event
- generator fuel contamination
- security breach
- concurrent systems degradation

Required evidence:
- drill completion
- attendance sheet
- action review
- improvement log

## 4. Contracts and Agreements Required in RFS

### 4.1 Maintenance contracts

These should be explicit entities in the app, not checklist comments.

Core signed contracts required before RFS:
- UPS maintenance
- generator maintenance
- chiller and cooling maintenance
- fire suppression and detection maintenance
- BMS and DCIM support
- electrical testing and thermography support
- security systems maintenance
- lift or elevator maintenance
- pest control
- white space cleaning
- waste and hazardous waste disposal
- landscaping and grounds

Mandatory contract data fields:
- provider name
- service type
- start date
- end date
- response SLA
- resolution SLA
- coverage window
- included assets
- included labor
- included parts
- excluded parts
- escalation contact
- call-out process
- OEM authorization yes or no

Mandatory contract clauses to verify:
- response times
- resolution times
- 24/7 support availability where required
- spare part support model
- warranty preservation language
- OEM certification or authorized service status
- access and site safety obligations
- liability and indemnity
- subcontractor control
- reporting obligations
- termination rights

### 4.2 Fuel and energy contracts

Required agreements:
- primary fuel supply
- backup fuel supply
- emergency fuel supply
- fuel polishing service
- fuel testing service if not bundled
- utility power purchase agreement
- grid interconnection agreement
- renewable PPA if applicable
- RECs procurement if applicable
- on-site generation agreement if solar or BESS exists
- water supply agreement
- water treatment chemical supply agreement
- water discharge agreement

Mandatory clauses:
- guaranteed delivery window
- 24/7 call-out
- quality specification
- emergency surge support
- escalation path
- delivery access constraints
- dual-supplier diversity
- indexation mechanism
- termination and continuity obligations

### 4.3 Commercial and customer contracts

Required items:
- MSA
- SLA
- SLA credit schedule
- commercial schedule and pricing appendix
- legal clauses schedule
- customer acceptance criteria
- customer witness rights
- inspection rights
- phased delivery milestones
- hold point schedule
- liquidated damages or delay clauses if applicable
- capacity ramp plan
- change order process
- invoicing and payment terms
- portal access and credential obligations

Mandatory clauses to model in the app:
- service definitions
- availability methodology
- response and resolution targets
- measurement formulas
- reporting cadence
- credit cap
- force majeure
- liability cap
- insurance obligations
- customer access constraints
- maintenance notice windows
- data sovereignty and privacy obligations

### 4.4 Regulatory and third-party service agreements

Required items:
- telecom and carrier agreements
- internet transit agreements
- dark fiber or IRU agreements
- fire authority interface agreements where applicable
- waste disposal contracts
- environmental monitoring contracts where required
- emergency response support contracts if contracted

## 5. Vendor Due Diligence

This is the major missing domain that should be explicit in RFS.

## 5.1 Vendor DD philosophy

RFS should not only ask "is the contract signed?" It must also ask:
- can this vendor actually deliver safely and repeatedly
- are they authorized, solvent, staffed, insurable, and responsive
- do they preserve OEM warranty
- can they support emergency conditions

## 5.2 Universal vendor DD checklist

Every critical vendor should have a DD pack with:
- legal entity verification
- business registration
- tax registration
- beneficial ownership disclosure where required
- sanctions and watchlist screening
- litigation or claims review
- insurance certificates
- HSE statistics
- reference sites
- financial health review
- local support footprint
- after-hours support capability
- escalation contacts
- subcontractor disclosure
- cyber and remote access posture if digital systems involved
- data privacy obligations if customer data or access involved
- OEM authorization status
- spare parts stocking approach
- warranty compatibility
- business continuity plan
- disaster recovery approach
- staffing adequacy
- training and certification records

Recommended app classification:
- gate relevance: `G0`, `G5`, `G7`
- blocker class: `hard` for critical vendors; `soft` for low-risk service vendors

## 5.3 Vendor DD by vendor type

### UPS, generator, chiller, fire, and other OEMs

Required DD:
- OEM identity and support structure
- local service branch or authorized partner
- authorized engineer list
- parts availability
- emergency response coverage
- warranty terms
- recommended PM schedule
- escalation matrix
- end-of-life and obsolescence notices

### Authorized service partners

Required DD:
- OEM authorization letter
- valid certifications
- named technicians
- local stock of critical parts
- emergency call-out history
- reference sites of similar scale
- method statements and safety plans

### Fuel suppliers

Required DD:
- fleet capacity
- depot locations
- emergency delivery capability
- quality assurance process
- contamination controls
- delivery time history
- alternate route planning
- disaster continuity plan

### Water treatment vendors

Required DD:
- chemical handling competence
- laboratory testing capability
- compliance with discharge standards
- emergency call-out response
- stocking of chemicals
- records and reporting format

### Fire protection vendors

Required DD:
- local authority registration if required
- licensed technicians
- room integrity test capability
- VESDA competence
- suppression refill capability
- spare nozzle and cylinder support
- emergency response commitment

### BMS, EPMS, and DCIM integrators

Required DD:
- controls architecture competence
- source code escrow or access policy if relevant
- alarm management support
- remote access security controls
- patching and upgrade policy
- sensor calibration capability
- 24/7 support availability

### Security integrators

Required DD:
- access control platform competence
- camera and storage support
- credential issuance governance
- after-hours support
- cybersecurity posture for connected systems

### Network carriers and structured cabling vendors

Required DD:
- route diversity proof
- service availability commitments
- field response time
- spares and optics support
- test and certification capability
- change control discipline

### Cleaning, waste, pest, and grounds vendors

Required DD:
- site safety induction
- method statements
- chemical controls
- white space cleanliness competence
- hazardous waste chain of custody
- controlled access compliance

## 5.4 Vendor DD decision outcomes

The app should support four statuses:
- `approved`
- `approved with conditions`
- `pending remediation`
- `rejected`

Mandatory DD evidence examples:
- OEM authorization letter
- insurance cert
- HSE metrics
- reference project list
- audited financial summary or credit statement
- emergency contact sheet
- escalation matrix
- BCP summary

## 5.5 Vendor DD red flags

The following should trigger either hard block or major risk:
- no OEM authorization for warranty-sensitive equipment
- no 24/7 emergency support where required
- no valid insurance
- no local emergency presence
- unresolved sanctions or compliance flags
- financially distressed supplier for critical scope
- no reference site at comparable criticality
- no spare parts support model
- no cyber control for remote-access vendor

## 6. Documentation and Evidence Packs

### 6.1 Project closure and design records

Required packs:
- architectural as-builts
- structural as-builts
- electrical as-builts
- mechanical as-builts
- fire as-builts
- security as-builts
- BMS and DCIM as-builts
- network and ICT as-builts
- site and utility as-builts
- final design calculations
- equipment selection records
- value engineering log
- change order log
- submittal and RFI log

### 6.2 Equipment and asset records

Required packs:
- O&M manuals
- datasheets
- nameplate and serial records
- warranties
- OEM spare recommendations
- PM recommendations
- lifecycle data
- asset registry
- CMMS upload confirmation

### 6.3 Test and commissioning evidence

Required packs:
- all L1-L5 reports
- punch list and deficiency register
- closure evidence
- load bank records
- thermal imaging
- power quality
- vibration analysis
- water treatment test records
- NETA reports
- IST scripts
- IST logs
- witness sign-offs

### 6.4 Training evidence

Required packs:
- OEM training certificates
- safety training certificates
- competency assessments
- attendance records
- recorded sessions if required
- drill evidence

## 7. Certificates, Permits, and Compliance

### 7.1 Building and occupancy

Required items:
- certificate of occupancy or temporary CO
- building permit final sign-off
- structural sign-off
- architect completion certificate
- accessibility compliance
- zoning compliance

### 7.2 Electrical and infrastructure

Required items:
- installation certificates
- NETA acceptance certification
- grid connection agreement
- transformer commissioning certificate
- generator emissions permit
- UPS commissioning certificate
- lightning protection certificate
- grounding certificate

### 7.3 Fire and life safety

Required items:
- fire safety certificate
- suppression commissioning cert
- VESDA commissioning cert
- fire alarm commissioning cert
- fire door cert
- fire stopping cert
- evacuation plan approval
- fire drill completion record

### 7.4 Environmental

Required items:
- environmental impact approval
- air emissions permit
- water discharge permit
- noise assessment
- hazardous materials permit
- SPCC plan if relevant
- waste management license

### 7.5 HSE

Required items:
- OH&S certification or local equivalent
- arc flash study and labels
- signage verification
- AED and first aid readiness
- PPE stock
- emergency egress posting

### 7.6 Industry certification set

Possible items:
- Uptime design and constructed facility certifications
- Uptime operational sustainability
- ISO 27001
- ISO 14001
- ISO 45001
- ISO 50001
- SOC 2
- PCI-DSS
- HIPAA where relevant
- LEED where relevant
- EN 50600 where relevant

### 7.7 Telecom and network compliance

Required items:
- telecom license or carrier agreements
- internet transit agreements
- peering agreements
- dark fiber agreements
- diversity verification

## 8. Insurance and Risk Transfer

Required policies or certificates:
- property insurance
- business interruption
- cyber liability
- general liability
- professional liability or technology E&O
- equipment breakdown or EDP
- builder's risk to property transition
- delay in start-up coverage
- contractor all-risk during defects liability if applicable

Mandatory app fields:
- insurer
- broker
- policy number
- policy period
- insured limit
- deductible
- covered perils
- exclusions
- claims contact
- certificate file reference
- renewal status

Critical policy checks:
- no gap between builder's risk and property cover
- equipment breakdown cover exists for internal failure
- BI waiting period understood
- cyber exclusions reviewed
- liability caps align with customer contracts

## 9. Spares, Consumables, and Initial Operating Stock

Required categories:
- electrical spares
- cooling spares
- fire spares
- controls spares
- security spares
- network spares
- general consumables

Mandatory app attributes:
- item code
- system
- min stock
- actual stock
- lead time
- criticality
- reorder point
- storage condition
- vendor

RFS blockers:
- critical spare stock below minimum for high-impact systems
- no reserve agent stock where required
- no coolant or oil reserve for critical equipment

## 10. Staffing, Competency, and On-Call Readiness

### 10.1 Minimum staffing readiness

Required roles:
- facility or operations manager
- shift leads or duty managers
- electrical technicians
- mechanical technicians
- controls operators
- IT or network support if offered
- admin support
- security manager
- security officers
- reception or visitor control
- SOC operator if relevant

### 10.2 Mandatory training completions

System training:
- UPS
- generator
- chiller plant
- fire suppression
- BMS and DCIM
- EPMS
- security system

Safety training:
- arc flash
- LOTO
- confined space
- work at height
- chemical handling
- fire warden
- first aid
- evacuation

Competency evidence:
- written exam
- practical demonstration
- emergency scenario simulation

### 10.3 On-call and support readiness

Required items:
- 24/7 roster
- escalation chain
- tested communication method
- response targets
- OEM emergency contact
- utility emergency contact
- fire liaison
- insurance claims contact

### 10.4 Knowledge management

Required items:
- runbook compiled
- dashboards live
- ticketing system live
- CMMS populated
- knowledge base live

## 11. Customer, Commercial, and Turnover Readiness

### 11.1 MSA and SLA package

Required:
- signed MSA
- SLA terms
- SLA credit mechanics
- pricing schedule
- payment terms
- renewal options
- early termination clauses
- legal clauses

### 11.2 Customer physical readiness

Required:
- cage or suite buildout complete
- rack install complete if included
- power whips installed
- A and B feed tested
- cooling verified
- fire coverage verified
- cable management in place
- customer area clean

### 11.3 Connectivity readiness

Required:
- cross-connects tested
- MMR access provisioned
- transit provisioned
- carriers active
- diversity verified
- DNS, NTP, DHCP if managed

### 11.4 Access and digital enablement

Required:
- customer badges
- portal access
- emergency contacts
- authorized user list
- access zones mapped

### 11.5 Customer acceptance

Required:
- walkthrough
- acceptance test
- burn-in period if required
- sign-off certificate
- confirmed RFS date

### 11.6 Commercial systems

Required:
- billing configured
- metering calibrated
- invoice template approved
- payment processing set
- reconciliation agreed

### 11.7 Hyperscale or wholesale-specific items

Required where relevant:
- shell and core readiness
- white space readiness
- phased delivery milestones
- performance acceptance criteria
- capacity ramp schedule
- hold points and inspection rights
- LD or delay settlement if contractual

### 11.8 Reporting and communication

Required:
- SLA report template
- incident notification procedure
- maintenance notice procedure
- communication channel
- QBR schedule

## 12. What the App Must Explicitly Model

For this inventory to be usable, the app must not reduce these items to one generic checklist bucket.

The app should explicitly model:
- SOP library
- MOP library
- EOP library
- contract register
- vendor DD register
- certificate and permit register
- insurance register
- spare stock register
- staffing and training matrix
- customer acceptance register
- commercial obligations register

Each register should support:
- owner
- due date
- status
- evidence
- blocker class
- linked delivery unit
- linked gate
- notes
- waiver yes or no

## 13. Suggested Register Names for the App

To make implementation cleaner, use these domain names:
- `opsProcedures`
- `changeProcedures`
- `emergencyProcedures`
- `contractRegister`
- `vendorRegister`
- `vendorDdRegister`
- `permitRegister`
- `insuranceRegister`
- `sparesRegister`
- `staffingRegister`
- `trainingRegister`
- `customerReadinessRegister`
- `commercialRegister`
- `evidenceRegister`

## 14. Recommended Hard Blockers in Non-Testing RFS

Examples of non-testing hard blockers:
- no approved incident escalation procedure
- no MOC procedure for critical systems
- no emergency response playbooks
- no signed critical maintenance contract
- no fuel continuity arrangement where generators are part of resilience design
- no property or equipment breakdown insurance where contractually required
- no minimum operations staffing
- no mandatory operator training
- no certificate of occupancy or equivalent legal operating basis
- no customer sign-off where customer acceptance is contractually required
- no vendor authorization for warranty-sensitive critical assets

## 15. Immediate Product Recommendation

Your app should stop treating RFS as only:
- commissioning checklist
- schedule estimate
- cost estimate

It should treat RFS as:

`technical readiness + operational readiness + vendor serviceability + commercial acceptance + legal operability`

That is the level of maturity needed if you want the app to be taken seriously by cloud, colo, or hyperscale-facing users.
