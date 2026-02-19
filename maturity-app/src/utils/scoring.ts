export interface Dimension {
    id: string;
    label: string;
    weight: number;
    impact: number;
    value: number; // 1-5
}

export interface SubDimension {
    id: string;
    label: string;
    desc: string;
}

export interface Benchmark {
    tier: string;
    avg: number;
    description?: string;
}

export interface MaturityLevel {
    label: string;
    level: number;
    color: string;
    minScore: number;
    maxScore: number;
}

export const initialDimensions: Dimension[] = [
    { id: 'doc', label: 'Documentation', weight: 0.10, impact: 1.0, value: 3 },
    { id: 'train', label: 'Training', weight: 0.15, impact: 1.2, value: 3 },
    { id: 'change', label: 'Change Mgmt', weight: 0.15, impact: 1.3, value: 3 },
    { id: 'monitor', label: 'Monitoring', weight: 0.15, impact: 1.1, value: 3 },
    { id: 'maint', label: 'Maintenance', weight: 0.15, impact: 1.2, value: 3 },
    { id: 'emergency', label: 'Emergency', weight: 0.10, impact: 1.4, value: 3 },
    { id: 'improve', label: 'Improvement', weight: 0.10, impact: 1.0, value: 3 },
    { id: 'leadership', label: 'Leadership', weight: 0.10, impact: 1.5, value: 3 }
];

export const benchmarks: Benchmark[] = [
    { tier: 'Tier I', avg: 25 },
    { tier: 'Tier II', avg: 45 },
    { tier: 'Tier III', avg: 65 },
    { tier: 'Tier IV', avg: 82 }
];

export const weightPresets: Record<string, { label: string; weights: number[] }> = {
    default: { label: 'Default', weights: [0.10, 0.15, 0.15, 0.15, 0.15, 0.10, 0.10, 0.10] },
    'ai-hpc': { label: 'AI / HPC', weights: [0.08, 0.12, 0.12, 0.20, 0.20, 0.08, 0.10, 0.10] },
    colocation: { label: 'Colocation', weights: [0.12, 0.10, 0.18, 0.15, 0.15, 0.12, 0.08, 0.10] },
    enterprise: { label: 'Enterprise', weights: [0.10, 0.15, 0.12, 0.12, 0.12, 0.12, 0.12, 0.15] }
};

export const subDimensions: Record<string, SubDimension[]> = {
    doc: [
        { id: 'sop', label: 'SOP/MOP Quality', desc: 'Standard & Method of Procedure completeness' },
        { id: 'eop', label: 'EOP Coverage', desc: 'Emergency Operating Procedures for all scenarios' },
        { id: 'asbuilt', label: 'As-Built Accuracy', desc: 'Drawings match physical infrastructure' },
        { id: 'version', label: 'Version Control', desc: 'Document change tracking and audit trails' },
        { id: 'cmms', label: 'CMMS Integration', desc: 'Docs linked to work orders and assets' }
    ],
    train: [
        { id: 'competency', label: 'Competency Program', desc: 'Structured role-based training paths' },
        { id: 'cross', label: 'Cross-Training', desc: 'Multi-skill coverage for redundancy' },
        { id: 'cert', label: 'Certifications', desc: 'Industry certs (CDCP, ATD, K3 Listrik)' },
        { id: 'drill', label: 'Drill Frequency', desc: 'Tabletop and live drill cadence' },
        { id: 'gap', label: 'Skill Gap Analysis', desc: 'Regular assessment and remediation' }
    ],
    change: [
        { id: 'moc', label: 'MOC Process', desc: 'Management of Change formalization' },
        { id: 'risk', label: 'Risk Assessment', desc: 'Pre-change risk scoring methodology' },
        { id: 'cab', label: 'CAB Governance', desc: 'Change Advisory Board effectiveness' },
        { id: 'rollback', label: 'Rollback Plans', desc: 'Documented rollback for every change' },
        { id: 'postchange', label: 'Post-Change Review', desc: 'Verification and lessons learned' }
    ],
    monitor: [
        { id: 'bms', label: 'BMS/DCIM Coverage', desc: 'Sensor density and system coverage' },
        { id: 'alarm', label: 'Alarm Hierarchy', desc: 'Prioritized alarm tiers (info/warn/critical)' },
        { id: 'dashboard', label: 'Dashboards', desc: 'Real-time operational visibility' },
        { id: 'trend', label: 'Trend Analysis', desc: 'Historical pattern recognition' },
        { id: 'predictive', label: 'Predictive Analytics', desc: 'ML/AI-based anomaly detection' }
    ],
    maint: [
        { id: 'pm', label: 'PM Program', desc: 'Preventive maintenance scheduling' },
        { id: 'cmmsutil', label: 'CMMS Utilization', desc: 'Work order completion and tracking' },
        { id: 'pdm', label: 'PdM Integration', desc: 'Predictive maintenance (vibration, thermal)' },
        { id: 'spares', label: 'Spare Parts Strategy', desc: 'Critical spares inventory management' },
        { id: 'vendor', label: 'Vendor Management', desc: 'SLA tracking and performance review' }
    ],
    emergency: [
        { id: 'eopcomp', label: 'EOP Completeness', desc: 'All failure scenarios documented' },
        { id: 'drillreal', label: 'Drill Realism', desc: 'Exercises simulate actual conditions' },
        { id: 'escalation', label: 'Escalation Matrix', desc: 'Clear chain of command and contacts' },
        { id: 'comms', label: 'Communication Protocol', desc: 'Internal and external notification plans' }
    ],
    improve: [
        { id: 'rca', label: 'RCA Depth', desc: 'Root cause analysis methodology (5-Why, Ishikawa)' },
        { id: 'capa', label: 'CAPA Tracking', desc: 'Corrective/preventive action closure rate' },
        { id: 'lessons', label: 'Lessons Learned DB', desc: 'Searchable knowledge base of incidents' },
        { id: 'benchmark', label: 'Benchmarking', desc: 'Regular comparison against industry peers' }
    ],
    leadership: [
        { id: 'commitment', label: 'Mgmt Commitment', desc: 'Visible leadership support for operations' },
        { id: 'resources', label: 'Resource Allocation', desc: 'Adequate staffing, budget, and tools' },
        { id: 'culture', label: 'Safety Culture', desc: 'Just culture, blameless post-mortems' },
        { id: 'alignment', label: 'Cross-Functional', desc: 'IT-Facilities-Business alignment' }
    ]
};

export function getMaturityLabel(score: number): MaturityLevel {
    if (score <= 20) return { label: 'Reactive', level: 1, color: '#ef4444', minScore: 0, maxScore: 20 };
    if (score <= 40) return { label: 'Preventive', level: 2, color: '#f97316', minScore: 21, maxScore: 40 };
    if (score <= 60) return { label: 'Predictive', level: 3, color: '#eab308', minScore: 41, maxScore: 60 };
    if (score <= 80) return { label: 'Proactive', level: 4, color: '#22c55e', minScore: 61, maxScore: 80 };
    return { label: 'Generative', level: 5, color: '#3b82f6', minScore: 81, maxScore: 100 };
}

export function calculateCompositeScore(values: number[], weights: number[]): number {
    const weightedSum = values.reduce((sum, v, i) => sum + v * weights[i], 0);
    return ((weightedSum - 1) / 4) * 100;
}

export function calculateWeightedSum(values: number[], weights: number[]): number {
    return values.reduce((sum, v, i) => sum + v * weights[i], 0);
}
