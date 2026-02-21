
export interface MaintenanceTask {
    id: string;
    name: string;
    frequency: 'Monthly' | 'Quarterly' | 'Bi-Annual' | 'Annual';
    category: 'Mechanical' | 'Electrical' | 'Civil' | 'Specialist' | 'Security' | 'BMS & IT';
    criticality: 'Statutory' | 'Optimal' | 'Discretionary'; // SFG20 Red/Amber/Green
    standardHours: number; // Man-hours per task
    requiresShutdown: boolean;
}

export interface AssetTemplate {
    id: string;
    name: string;
    category: 'Critical Power' | 'Cooling' | 'Security' | 'Fire Safety' | 'BMS & IT' | 'Fuel System' | 'Water Treatment' | 'Civil';
    defaultRedundancy: 'N+1' | '2N' | 'N' | string;
    maintenanceTasks: MaintenanceTask[];
    consumables?: {
        name: string;
        baseLifeMonths: number;
        costPerUnit: number; // USD baseline
    }[];
    criticalSpares?: {
        name: string;
        stockPercent: number;   // % of population to keep as spare (e.g. 0.05 = 5%)
        minStock: number;       // Minimum units regardless of population
        costPerUnit: number;    // USD per unit
        leadTimeWeeks: number;  // Typical procurement lead time
    }[];
}

export const ASSETS: AssetTemplate[] = [
    // --- CRITICAL POWER ---
    {
        id: 'gen-set',
        name: 'Diesel Generator (2.5MW)',
        category: 'Critical Power',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'gen-m', name: 'Visual Inspection & Run Test (No Load)', frequency: 'Monthly', category: 'Mechanical', criticality: 'Statutory', standardHours: 0.5, requiresShutdown: false },
            { id: 'gen-q', name: 'Fuel Cleaning & Filter Check', frequency: 'Quarterly', category: 'Mechanical', criticality: 'Optimal', standardHours: 4, requiresShutdown: false },
            { id: 'gen-a', name: 'Full Load Bank Test (4 Hours)', frequency: 'Annual', category: 'Electrical', criticality: 'Statutory', standardHours: 12, requiresShutdown: true },
            { id: 'gen-bi', name: 'Vibration Analysis', frequency: 'Bi-Annual', category: 'Mechanical', criticality: 'Optimal', standardHours: 2, requiresShutdown: false },
        ],
        consumables: [
            { name: 'Fuel Filters', baseLifeMonths: 12, costPerUnit: 150 },
            { name: 'Air Filters', baseLifeMonths: 12, costPerUnit: 200 },
            { name: 'Engine Oil (200L)', baseLifeMonths: 12, costPerUnit: 1200 },
            { name: 'Coolant (50L)', baseLifeMonths: 24, costPerUnit: 350 },
            { name: 'Oil Filters', baseLifeMonths: 6, costPerUnit: 85 }
        ],
        criticalSpares: [
            { name: 'AVR (Automatic Voltage Regulator)', stockPercent: 0.25, minStock: 1, costPerUnit: 8500, leadTimeWeeks: 12 },
            { name: 'Fuel Injector Set', stockPercent: 0.10, minStock: 1, costPerUnit: 4200, leadTimeWeeks: 8 },
            { name: 'Turbocharger Assembly', stockPercent: 0.10, minStock: 1, costPerUnit: 12000, leadTimeWeeks: 16 },
            { name: 'Water Pump', stockPercent: 0.25, minStock: 1, costPerUnit: 2800, leadTimeWeeks: 6 },
            { name: 'Starter Motor', stockPercent: 0.25, minStock: 1, costPerUnit: 3500, leadTimeWeeks: 8 },
            { name: 'Gasket & Seal Kit', stockPercent: 0.50, minStock: 2, costPerUnit: 1200, leadTimeWeeks: 4 },
            { name: 'Belt Kit (Alternator/Fan)', stockPercent: 0.50, minStock: 2, costPerUnit: 450, leadTimeWeeks: 2 },
            { name: 'Radiator Core', stockPercent: 0.10, minStock: 1, costPerUnit: 6500, leadTimeWeeks: 12 },
        ]
    },
    {
        id: 'ups-module',
        name: 'UPS Module (500kVA)',
        category: 'Critical Power',
        defaultRedundancy: '2N',
        maintenanceTasks: [
            { id: 'ups-m', name: 'Display Check & Environment Log', frequency: 'Monthly', category: 'Electrical', criticality: 'Optimal', standardHours: 0.5, requiresShutdown: false },
            { id: 'ups-bi', name: 'Capacitor & Fan Inspection', frequency: 'Bi-Annual', category: 'Electrical', criticality: 'Statutory', standardHours: 4, requiresShutdown: true },
            { id: 'ups-a', name: 'Thermal Scan & Battery Discharge', frequency: 'Annual', category: 'Electrical', criticality: 'Statutory', standardHours: 6, requiresShutdown: false },
            { id: 'ups-firm', name: 'Firmware Update', frequency: 'Annual', category: 'Electrical', criticality: 'Discretionary', standardHours: 2, requiresShutdown: true },
        ],
        consumables: [
            { name: 'DC Capacitors', baseLifeMonths: 60, costPerUnit: 1200 },
            { name: 'Fans', baseLifeMonths: 48, costPerUnit: 300 }
        ],
        criticalSpares: [
            { name: 'UPS Power Module (500kVA)', stockPercent: 0.05, minStock: 1, costPerUnit: 45000, leadTimeWeeks: 16 },
            { name: 'Static Switch / SCR Module', stockPercent: 0.05, minStock: 1, costPerUnit: 18000, leadTimeWeeks: 12 },
            { name: 'Control Board / Logic Card', stockPercent: 0.10, minStock: 1, costPerUnit: 8500, leadTimeWeeks: 8 },
            { name: 'DC Bus Capacitor Bank', stockPercent: 0.10, minStock: 1, costPerUnit: 5200, leadTimeWeeks: 10 },
            { name: 'Fan Tray Assembly', stockPercent: 0.15, minStock: 2, costPerUnit: 1800, leadTimeWeeks: 4 },
        ]
    },
    {
        id: 'lv-switchgear',
        name: 'LV Switchboard (Main)',
        category: 'Critical Power',
        defaultRedundancy: '2N',
        maintenanceTasks: [
            { id: 'lvsb-m', name: 'Visual Inspection & Meter Reading', frequency: 'Monthly', category: 'Electrical', criticality: 'Statutory', standardHours: 0.5, requiresShutdown: false },
            { id: 'lvsb-a', name: 'Thermal Scanning (Terminations)', frequency: 'Annual', category: 'Electrical', criticality: 'Statutory', standardHours: 2, requiresShutdown: false },
            { id: 'lvsb-3y', name: 'Busbar Torque Check & Clean', frequency: 'Annual', category: 'Electrical', criticality: 'Optimal', standardHours: 8, requiresShutdown: true },
            { id: 'lvsb-pd', name: 'Partial Discharge Testing', frequency: 'Annual', category: 'Specialist', criticality: 'Optimal', standardHours: 4, requiresShutdown: false },
        ],
        criticalSpares: [
            { name: 'ACB (Air Circuit Breaker) 3200A', stockPercent: 0.05, minStock: 1, costPerUnit: 28000, leadTimeWeeks: 16 },
            { name: 'ACB (Air Circuit Breaker) 1600A', stockPercent: 0.05, minStock: 1, costPerUnit: 18000, leadTimeWeeks: 12 },
            { name: 'MCCB 630A', stockPercent: 0.10, minStock: 2, costPerUnit: 2800, leadTimeWeeks: 4 },
            { name: 'MCCB 250A', stockPercent: 0.10, minStock: 2, costPerUnit: 1200, leadTimeWeeks: 3 },
            { name: 'Shunt Trip Coil', stockPercent: 0.15, minStock: 3, costPerUnit: 350, leadTimeWeeks: 2 },
            { name: 'CT (Current Transformer) Set', stockPercent: 0.10, minStock: 2, costPerUnit: 800, leadTimeWeeks: 4 },
            { name: 'Power Meter Module', stockPercent: 0.10, minStock: 2, costPerUnit: 1500, leadTimeWeeks: 6 },
        ]
    },
    {
        id: 'transformer',
        name: 'MV/LV Transformer (2.5MVA)',
        category: 'Critical Power',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'tx-m', name: 'Temp/Pressure Gauge Check', frequency: 'Monthly', category: 'Electrical', criticality: 'Statutory', standardHours: 0.25, requiresShutdown: false },
            { id: 'tx-a', name: 'Oil Sampling (DGA Analysis)', frequency: 'Annual', category: 'Specialist', criticality: 'Statutory', standardHours: 1, requiresShutdown: false },
            { id: 'tx-bi', name: 'Enclosure Cleaning & Bolt Torque', frequency: 'Annual', category: 'Electrical', criticality: 'Optimal', standardHours: 4, requiresShutdown: true },
        ]
    },

    // --- COOLING ---
    {
        id: 'chiller-air',
        name: 'Air Cooled Chiller (1000kW)',
        category: 'Cooling',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'chi-m', name: 'Refrigerant Pressure & Leak Check', frequency: 'Monthly', category: 'Mechanical', criticality: 'Statutory', standardHours: 1, requiresShutdown: false },
            { id: 'chi-q', name: 'Condenser Coil Cleaning', frequency: 'Quarterly', category: 'Mechanical', criticality: 'Optimal', standardHours: 6, requiresShutdown: false },
            { id: 'chi-leg', name: 'Legionella Water Testing', frequency: 'Monthly', category: 'Mechanical', criticality: 'Statutory', standardHours: 2, requiresShutdown: false },
            { id: 'chi-tube', name: 'Condenser Tube Brushing', frequency: 'Annual', category: 'Mechanical', criticality: 'Optimal', standardHours: 16, requiresShutdown: true },
        ],
        consumables: [
            { name: 'Compressor Oil', baseLifeMonths: 24, costPerUnit: 400 },
            { name: 'Biocide Chemicals', baseLifeMonths: 1, costPerUnit: 100 }
        ],
        criticalSpares: [
            { name: 'Compressor Assembly', stockPercent: 0.10, minStock: 1, costPerUnit: 35000, leadTimeWeeks: 20 },
            { name: 'VFD (Variable Frequency Drive)', stockPercent: 0.10, minStock: 1, costPerUnit: 12000, leadTimeWeeks: 12 },
            { name: 'Expansion Valve', stockPercent: 0.15, minStock: 1, costPerUnit: 3200, leadTimeWeeks: 6 },
            { name: 'Pressure Transducer Set', stockPercent: 0.20, minStock: 2, costPerUnit: 800, leadTimeWeeks: 4 },
            { name: 'Temperature Sensor (PT1000)', stockPercent: 0.20, minStock: 4, costPerUnit: 250, leadTimeWeeks: 2 },
            { name: 'Condenser Fan Motor', stockPercent: 0.10, minStock: 1, costPerUnit: 4500, leadTimeWeeks: 8 },
        ]
    },
    {
        id: 'pac-unit',
        name: 'CRAC/CRAH Unit (100kW)',
        category: 'Cooling',
        defaultRedundancy: 'N+20%',
        maintenanceTasks: [
            { id: 'pac-m', name: 'Filter Check & Belt Tension', frequency: 'Monthly', category: 'Mechanical', criticality: 'Statutory', standardHours: 0.5, requiresShutdown: false },
            { id: 'pac-q-hum', name: 'Humidifier Canister Check', frequency: 'Quarterly', category: 'Mechanical', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
            { id: 'pac-a-motor', name: 'Motor Bearing Inspection', frequency: 'Annual', category: 'Mechanical', criticality: 'Optimal', standardHours: 2, requiresShutdown: true },
        ],
        consumables: [
            { name: 'G4 Pre-Filters', baseLifeMonths: 3, costPerUnit: 45 },
            { name: 'Humidifier Bottle', baseLifeMonths: 12, costPerUnit: 180 },
            { name: 'Fan Belts', baseLifeMonths: 12, costPerUnit: 60 }
        ],
        criticalSpares: [
            { name: 'EC Fan Motor Assembly', stockPercent: 0.10, minStock: 1, costPerUnit: 3800, leadTimeWeeks: 8 },
            { name: 'Control Valve Actuator', stockPercent: 0.15, minStock: 1, costPerUnit: 1200, leadTimeWeeks: 4 },
            { name: 'Humidity Sensor', stockPercent: 0.20, minStock: 2, costPerUnit: 450, leadTimeWeeks: 2 },
            { name: 'Controller Board', stockPercent: 0.10, minStock: 1, costPerUnit: 2800, leadTimeWeeks: 8 },
        ]
    },
    {
        id: 'fcu',
        name: 'FCU / VRV (Office/Corridor)',
        category: 'Cooling',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'fcu-q', name: 'Filter Cleaning & Drain Tray', frequency: 'Quarterly', category: 'Mechanical', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
            { id: 'fcu-a', name: 'Chemical Coil Cleaning', frequency: 'Annual', category: 'Mechanical', criticality: 'Optimal', standardHours: 2, requiresShutdown: false },
        ]
    },

    // --- FIRE SAFETY ---
    {
        id: 'fire-suppression',
        name: 'Gas Suppression Cylinder (Novec/IG541)',
        category: 'Fire Safety',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'gas-ba', name: 'Level/Pressure Check & Weighing', frequency: 'Bi-Annual', category: 'Specialist', criticality: 'Statutory', standardHours: 0.5, requiresShutdown: false },
            { id: 'gas-5y', name: 'Hydrostatic Testing', frequency: 'Annual', category: 'Specialist', criticality: 'Statutory', standardHours: 4, requiresShutdown: false }, // Logic handles 5y interval actually
        ]
    },
    {
        id: 'vesda',
        name: 'VESDA Detector',
        category: 'Fire Safety',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'vesda-q', name: 'Filter Check & Purge', frequency: 'Quarterly', category: 'Specialist', criticality: 'Optimal', standardHours: 0.5, requiresShutdown: false },
            { id: 'vesda-a', name: 'Sampling Pipe Blow-through', frequency: 'Annual', category: 'Specialist', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
        ],
        consumables: [
            { name: 'VESDA Filter Cartridge', baseLifeMonths: 12, costPerUnit: 120 }
        ]
    },
    {
        id: 'fire-panel',
        name: 'Fire Alarm Control Panel (Addressable)',
        category: 'Fire Safety',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'fip-w', name: 'System Status Check', frequency: 'Monthly', category: 'Security', criticality: 'Statutory', standardHours: 0.2, requiresShutdown: false }, // Weekly by security
            { id: 'fip-a', name: 'Full Loop Test (100% Devices)', frequency: 'Annual', category: 'Specialist', criticality: 'Statutory', standardHours: 24, requiresShutdown: false },
        ]
    },

    // --- FUEL SYSTEM ---
    {
        id: 'fuel-polisher',
        name: 'Fuel Polishing Unit',
        category: 'Fuel System',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'fuel-m', name: 'Filter DP Check', frequency: 'Monthly', category: 'Mechanical', criticality: 'Optimal', standardHours: 0.25, requiresShutdown: false },
            { id: 'fuel-bi', name: 'Filter Replacement', frequency: 'Bi-Annual', category: 'Mechanical', criticality: 'Optimal', standardHours: 2, requiresShutdown: true },
        ],
        consumables: [
            { name: 'Coalescer Filters', baseLifeMonths: 6, costPerUnit: 350 },
            { name: 'Separator Filters', baseLifeMonths: 6, costPerUnit: 280 }
        ],
        criticalSpares: [
            { name: 'Transfer Pump', stockPercent: 0.25, minStock: 1, costPerUnit: 2200, leadTimeWeeks: 6 },
            { name: 'Solenoid Valve', stockPercent: 0.20, minStock: 1, costPerUnit: 450, leadTimeWeeks: 3 },
        ]
    },
    {
        id: 'bulk-tank',
        name: 'Bulk Fuel Tank (20,000L)',
        category: 'Fuel System',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'tank-a', name: 'Tank Cleaning & Sludge Removal', frequency: 'Annual', category: 'Specialist', criticality: 'Optimal', standardHours: 8, requiresShutdown: false },
            { id: 'tank-NDT', name: 'Thickness Testing (NDT)', frequency: 'Annual', category: 'Specialist', criticality: 'Statutory', standardHours: 4, requiresShutdown: false },
        ]
    },

    // --- WATER TREATMENT ---
    {
        id: 'sand-filter',
        name: 'Sand Filter (Multimedia)',
        category: 'Water Treatment',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'sand-w', name: 'Backwash Cycle Check', frequency: 'Monthly', category: 'Mechanical', criticality: 'Optimal', standardHours: 0.5, requiresShutdown: false },
            { id: 'sand-a', name: 'Media Replacement', frequency: 'Annual', category: 'Mechanical', criticality: 'Optimal', standardHours: 6, requiresShutdown: true },
        ]
    },
    {
        id: 'dosing-pump',
        name: 'Chemical Dosing Pump',
        category: 'Water Treatment',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'dose-m', name: 'Liquid Level & Stroke Check', frequency: 'Monthly', category: 'Mechanical', criticality: 'Statutory', standardHours: 0.25, requiresShutdown: false },
            { id: 'dose-a', name: 'Diaphragm Replacement', frequency: 'Annual', category: 'Mechanical', criticality: 'Statutory', standardHours: 1, requiresShutdown: true },
        ]
    },

    // --- BMS & IT ---
    {
        id: 'bms-server',
        name: 'BMS Server / Workstation',
        category: 'BMS & IT',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'bms-m', name: 'Database Backup & Health Check', frequency: 'Monthly', category: 'BMS & IT', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
            { id: 'bms-q', name: 'OS Patching & Security Audit', frequency: 'Quarterly', category: 'BMS & IT', criticality: 'Statutory', standardHours: 2, requiresShutdown: true },
        ],
        criticalSpares: [
            { name: 'Server SSD (Hot-swap)', stockPercent: 0.20, minStock: 2, costPerUnit: 800, leadTimeWeeks: 2 },
            { name: 'Server PSU Module', stockPercent: 0.15, minStock: 1, costPerUnit: 650, leadTimeWeeks: 3 },
        ]
    },
    {
        id: 'plc-hmi',
        name: 'PLC / DDC Controller + HMI',
        category: 'BMS & IT',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'plc-q', name: 'Program Backup & Battery Check', frequency: 'Quarterly', category: 'BMS & IT', criticality: 'Statutory', standardHours: 1, requiresShutdown: false },
            { id: 'plc-a', name: 'I/O Module Verification & Firmware', frequency: 'Annual', category: 'BMS & IT', criticality: 'Optimal', standardHours: 4, requiresShutdown: true },
        ],
        criticalSpares: [
            { name: 'PLC CPU Module', stockPercent: 0.10, minStock: 1, costPerUnit: 5500, leadTimeWeeks: 10 },
            { name: 'PLC I/O Module (DI/DO)', stockPercent: 0.15, minStock: 2, costPerUnit: 1800, leadTimeWeeks: 6 },
            { name: 'PLC I/O Module (AI/AO)', stockPercent: 0.15, minStock: 2, costPerUnit: 2200, leadTimeWeeks: 6 },
            { name: 'HMI Touch Panel 10"', stockPercent: 0.10, minStock: 1, costPerUnit: 3200, leadTimeWeeks: 8 },
            { name: 'PLC Battery (Lithium)', stockPercent: 0.50, minStock: 4, costPerUnit: 35, leadTimeWeeks: 1 },
            { name: 'Communication Module (Modbus/BACnet)', stockPercent: 0.15, minStock: 1, costPerUnit: 1500, leadTimeWeeks: 6 },
        ]
    },
    {
        id: 'field-sensor',
        name: 'Field Sensors (Temp/Pressure/Flow)',
        category: 'BMS & IT',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'sens-a', name: 'Calibration Verification', frequency: 'Annual', category: 'BMS & IT', criticality: 'Statutory', standardHours: 0.5, requiresShutdown: false },
        ],
        criticalSpares: [
            { name: 'Temperature Sensor (PT100/PT1000)', stockPercent: 0.05, minStock: 4, costPerUnit: 180, leadTimeWeeks: 2 },
            { name: 'Pressure Transmitter (4-20mA)', stockPercent: 0.05, minStock: 2, costPerUnit: 650, leadTimeWeeks: 4 },
            { name: 'Flow Meter (Electromagnetic)', stockPercent: 0.05, minStock: 1, costPerUnit: 3500, leadTimeWeeks: 8 },
            { name: 'Differential Pressure Switch', stockPercent: 0.10, minStock: 2, costPerUnit: 320, leadTimeWeeks: 3 },
            { name: 'Level Transmitter', stockPercent: 0.05, minStock: 1, costPerUnit: 850, leadTimeWeeks: 4 },
        ]
    },
    {
        id: 'cctv',
        name: 'CCTV Camera',
        category: 'Security',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'cctv-q', name: 'Lens Cleaning & Focus Check', frequency: 'Quarterly', category: 'Security', criticality: 'Optimal', standardHours: 0.25, requiresShutdown: false },
        ]
    },
    {
        id: 'access-control',
        name: 'Biometric/Card Reader',
        category: 'Security',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'ac-bi', name: 'Function Test & database sync', frequency: 'Bi-Annual', category: 'Security', criticality: 'Statutory', standardHours: 0.25, requiresShutdown: false },
        ]
    },
    {
        id: 'boom-gate',
        name: 'Boom Gate / Turnstile',
        category: 'Security',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'bg-q', name: 'Mechanism Lub & Safety Loop Test', frequency: 'Quarterly', category: 'Security', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
        ]
    },

    // --- CIVIL & GENERAL ---
    {
        id: 'loading-dock',
        name: 'Loading Dock Leveler',
        category: 'Civil',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'dock-q', name: 'Hydraulic Oil & Hinge Check', frequency: 'Quarterly', category: 'Mechanical', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
            { id: 'dock-a', name: 'Load Test & Service', frequency: 'Annual', category: 'Mechanical', criticality: 'Statutory', standardHours: 2, requiresShutdown: true },
        ]
    },
    {
        id: 'mewp',
        name: 'MEWP (Scissor Lift)',
        category: 'Civil',
        defaultRedundancy: 'N',
        maintenanceTasks: [
            { id: 'mewp-m', name: 'Battery & Hydraulic Check', frequency: 'Monthly', category: 'Mechanical', criticality: 'Statutory', standardHours: 0.5, requiresShutdown: false },
            { id: 'mewp-a', name: 'Certification Inspection (LOLA)', frequency: 'Annual', category: 'Specialist', criticality: 'Statutory', standardHours: 2, requiresShutdown: true },
        ]
    },
    {
        id: 'vent-fan',
        name: 'Ventilation / Extract Fan',
        category: 'Cooling', // Broadly mechanical
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'fan-q', name: 'Belt & Bearing Check', frequency: 'Quarterly', category: 'Mechanical', criticality: 'Optimal', standardHours: 1, requiresShutdown: false },
        ]
    },

    // --- WATER ---
    {
        id: 'ro-unit',
        name: 'Reverse Osmosis Unit',
        category: 'Water Treatment',
        defaultRedundancy: 'N+1',
        maintenanceTasks: [
            { id: 'ro-m', name: 'Membrane Pressure Check', frequency: 'Monthly', category: 'Mechanical', criticality: 'Optimal', standardHours: 0.5, requiresShutdown: false },
            { id: 'ro-a', name: 'Membrane Cleaning / Replacement', frequency: 'Annual', category: 'Specialist', criticality: 'Optimal', standardHours: 6, requiresShutdown: true },
        ],
        consumables: [
            { name: 'RO Membrane Element', baseLifeMonths: 36, costPerUnit: 2800 },
            { name: 'Pre-Filter Cartridge (5μm)', baseLifeMonths: 3, costPerUnit: 45 },
            { name: 'Antiscalant Chemical (25L)', baseLifeMonths: 3, costPerUnit: 180 },
        ],
        criticalSpares: [
            { name: 'High Pressure Pump', stockPercent: 0.25, minStock: 1, costPerUnit: 4500, leadTimeWeeks: 10 },
            { name: 'Pressure Vessel', stockPercent: 0.10, minStock: 1, costPerUnit: 1800, leadTimeWeeks: 8 },
            { name: 'Conductivity Sensor', stockPercent: 0.20, minStock: 2, costPerUnit: 350, leadTimeWeeks: 2 },
        ]
    }
];
