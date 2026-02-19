export interface LevelDetail {
    value: number;
    label: string;
    description: string;
}

export interface DimensionDetail {
    id: string;
    label: string;
    weight: string;
    summary: string;
    levels: LevelDetail[];
}

export const dimensionDetails: Record<string, DimensionDetail> = {
    'doc': {
        id: 'doc',
        label: 'Documentation',
        weight: '10%',
        summary: 'SOPs, MOPs, EOPs, as-built drawings, version control, CMMS integration.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'No formal docs; tribal knowledge only' },
            { value: 2, label: 'Repeatable', description: 'Some docs exist but outdated or incomplete' },
            { value: 3, label: 'Defined', description: 'All critical SOPs documented, version-controlled' },
            { value: 4, label: 'Managed', description: 'Docs linked to CMMS, audit trail, regular reviews' },
            { value: 5, label: 'Optimized', description: 'Automated doc workflows, real-time as-builts, integrated knowledge base' }
        ]
    },
    'train': {
        id: 'train',
        label: 'Training',
        weight: '15%',
        summary: 'Competency programs, cross-training, certifications, drill frequency, skill gap analysis.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'OJT only, no structured program' },
            { value: 2, label: 'Repeatable', description: 'Annual training schedule, basic orientation' },
            { value: 3, label: 'Defined', description: 'Role-based competency matrix, regular drills' },
            { value: 4, label: 'Managed', description: 'Cross-training across systems, skill gap tracking, certifications required' },
            { value: 5, label: 'Optimized', description: 'Continuous learning culture, external benchmarking, advanced simulation drills' }
        ]
    },
    'change': {
        id: 'change',
        label: 'Change Management',
        weight: '15%',
        summary: 'MOC process, risk assessment, CAB governance, rollback procedures. Prevents ~70% of human-caused outages.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'Changes made without formal process or approval' },
            { value: 2, label: 'Repeatable', description: 'Change requests logged, basic approvals' },
            { value: 3, label: 'Defined', description: 'Formal MOC with risk assessment, CAB reviews' },
            { value: 4, label: 'Managed', description: 'Automated workflows, rollback plans mandatory, post-change verification' },
            { value: 5, label: 'Optimized', description: 'Predictive impact analysis, zero-downtime change windows, automated validation' }
        ]
    },
    'monitor': {
        id: 'monitor',
        label: 'Monitoring',
        weight: '15%',
        summary: 'BMS/DCIM coverage, alarm hierarchy, dashboards, trend analysis, predictive analytics.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'Manual readings, no centralized monitoring' },
            { value: 2, label: 'Repeatable', description: 'BMS installed but limited coverage, alarm fatigue' },
            { value: 3, label: 'Defined', description: 'Full BMS coverage, tiered alarm hierarchy, basic dashboards' },
            { value: 4, label: 'Managed', description: 'DCIM integrated, trend analysis, KPI dashboards, automated reporting' },
            { value: 5, label: 'Optimized', description: 'Predictive analytics (ML/AI), anomaly detection, digital twin integration' }
        ]
    },
    'maint': {
        id: 'maint',
        label: 'Maintenance',
        weight: '15%',
        summary: 'PM program, CMMS utilization, PdM integration, spare parts strategy, vendor management.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'Reactive only (fix when broken), no PM schedule' },
            { value: 2, label: 'Repeatable', description: 'Basic PM schedule, manual tracking' },
            { value: 3, label: 'Defined', description: 'CMMS-driven PM program, work order tracking, spare parts inventory' },
            { value: 4, label: 'Managed', description: 'PdM integration (vibration, thermal), vendor SLA tracking, KPIs' },
            { value: 5, label: 'Optimized', description: 'Condition-based maintenance, AI-driven scheduling, RCM methodology' }
        ]
    },
    'emergency': {
        id: 'emergency',
        label: 'Emergency Readiness',
        weight: '10%',
        summary: 'EOP completeness, drill realism, escalation matrix, communication protocols, RTO/RPO.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'No written EOPs, ad-hoc response' },
            { value: 2, label: 'Repeatable', description: 'Basic EOPs exist, annual drills' },
            { value: 3, label: 'Defined', description: 'Comprehensive EOPs, quarterly drills, clear escalation matrix' },
            { value: 4, label: 'Managed', description: 'Realistic drills with measured MTTR, automated communication, tabletop exercises' },
            { value: 5, label: 'Optimized', description: 'Continuous readiness assessment, cross-site drills, post-incident improvement loop' }
        ]
    },
    'improve': {
        id: 'improve',
        label: 'Continuous Improvement',
        weight: '10%',
        summary: 'RCA depth, CAPA tracking, lessons learned, benchmarking practices.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'No formal RCA process, repeat incidents' },
            { value: 2, label: 'Repeatable', description: 'Basic incident reports, some follow-up' },
            { value: 3, label: 'Defined', description: 'Structured RCA (5-Why, Ishikawa), CAPA tracking' },
            { value: 4, label: 'Managed', description: 'Lessons learned database, proactive CAPA, industry benchmarking' },
            { value: 5, label: 'Optimized', description: 'Self-improving system (Safety-II), data-driven optimization, cross-industry learning' }
        ]
    },
    'leadership': {
        id: 'leadership',
        label: 'Leadership',
        weight: '10%',
        summary: 'Management commitment, resource allocation, safety culture, strategic planning. Impact multiplier: 1.5x.',
        levels: [
            { value: 1, label: 'Ad-hoc', description: 'No executive sponsorship, ops seen as cost center' },
            { value: 2, label: 'Repeatable', description: 'Basic management oversight, reactive budget allocation' },
            { value: 3, label: 'Defined', description: 'Dedicated ops leadership, annual budget planning, safety awareness' },
            { value: 4, label: 'Managed', description: 'Just culture established, cross-functional alignment, strategic roadmap' },
            { value: 5, label: 'Optimized', description: 'Ops excellence as competitive advantage, full executive buy-in, generative culture' }
        ]
    }
};
