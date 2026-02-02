// Resource Container System - Type definitions and static registry

// Matches SQL calc_effective_capacity() multipliers
export const UPGRADE_MULTIPLIERS = [1, 2, 3, 5, 8, 12] as const
export const MAX_UPGRADE_LEVEL = 5

export function getEffectiveCapacity(baseCapacity: number, upgradeLevel: number): number {
  const clamped = Math.max(0, Math.min(upgradeLevel, MAX_UPGRADE_LEVEL))
  return baseCapacity * UPGRADE_MULTIPLIERS[clamped]
}

export interface ResourceContainerDef {
  id: string
  name: string
  resourceType: string
  tier: number
  capacity: number
  upgradesTo: string | null
  color: string
  icon: string
  upgradeMaterial?: string
  autoCreatedWith?: string
  replaces?: string
}

export interface ContainerState {
  amount: number
  capacity: number
  flowRate: number
  isUnlocked: boolean
  isActive: boolean
  upgradeLevel: number
}

// Map display names ↔ DB snake_case resource type names
export const RESOURCE_TYPE_MAP: Record<string, string> = {
  'Abstractum': 'abstractum',
  'Energy': 'energy',
  'Base Alloy': 'base_alloy',
  'Adv. Alloy': 'advanced_alloy',
  'Nanomaterial': 'nanomaterial',
  'Basic Chemical': 'basic_chemical',
  'Res. Crystals': 'resonant_crystals',
  'Rare Elements': 'rare_elements',
  'Power Cells': 'power_cells',
  'Exotic Matter': 'exotic_matter',
  'Antimatter': 'antimatter',
  'Any Element': 'any_element',
  'Ideoplasm': 'ideoplasm',
  'Anomaly Cores': 'anomaly_cores',
  'Heavy Elements': 'heavy_elements',
  'Universal Fixer': 'universal_fixer',
}

// Reverse map: DB name → display name
export const RESOURCE_DISPLAY_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(RESOURCE_TYPE_MAP).map(([display, db]) => [db, display])
)

export const TIER_LABELS: Record<number, string> = {
  0: 'STARTER',
  1: 'BASIC',
  2: 'ADVANCED',
  3: 'EXOTIC',
  4: 'QUANTUM',
  5: 'STELLAR',
}

export const RESOURCE_COLORS: Record<string, string> = {
  'Abstractum': 'var(--neon-green)',
  'Energy': 'var(--neon-cyan)',
  'Base Alloy': 'var(--neon-amber)',
  'Adv. Alloy': 'var(--neon-amber)',
  'Nanomaterial': '#b388ff',
  'Basic Chemical': 'var(--neon-purple)',
  'Res. Crystals': '#00e5ff',
  'Rare Elements': '#ffd740',
  'Power Cells': '#ff6e40',
  'Exotic Matter': 'var(--neon-pink)',
  'Antimatter': 'var(--neon-red)',
  'Any Element': '#b388ff',
  'Ideoplasm': '#ea80fc',
  'Anomaly Cores': '#ff5252',
  'Heavy Elements': '#8d6e63',
  'Universal Fixer': '#e0e0e0',
}

export const RESOURCE_CONTAINERS: ResourceContainerDef[] = [
  // Tier 0 - Starter
  { id: 'SPC-000', name: 'Seep Collector',      resourceType: 'Abstractum',      tier: 0, capacity: 500,    upgradesTo: 'ATK-001', color: 'var(--neon-green)',   icon: '◈', upgradeMaterial: 'abstractum' },
  { id: 'RSC-000', name: 'Residual Cell',        resourceType: 'Energy',          tier: 0, capacity: 100,    upgradesTo: 'BAT-001', color: 'var(--neon-cyan)',    icon: '⚡' },
  // Tier 1 - Basic
  { id: 'ATK-001', name: 'Abstractum Tank',      resourceType: 'Abstractum',      tier: 1, capacity: 10000,  upgradesTo: null,      color: 'var(--neon-green)',   icon: '◈', replaces: 'SPC-000', upgradeMaterial: 'abstractum' },
  { id: 'BAT-001', name: 'Battery Pack',         resourceType: 'Energy',          tier: 1, capacity: 5000,   upgradesTo: null,      color: 'var(--neon-cyan)',    icon: '⚡', replaces: 'RSC-000', upgradeMaterial: 'power_cells' },
  { id: 'BIN-101', name: 'Alloy Bin',            resourceType: 'Base Alloy',      tier: 1, capacity: 500,    upgradesTo: 'BIN-201', color: 'var(--neon-amber)',   icon: '⬡', autoCreatedWith: 'SMT-001', upgradeMaterial: 'base_alloy' },
  { id: 'VAT-102', name: 'Chemical Vat',         resourceType: 'Basic Chemical',  tier: 1, capacity: 500,    upgradesTo: 'VAT-202', color: 'var(--neon-purple)',  icon: '⬢', autoCreatedWith: 'CHM-001', upgradeMaterial: 'basic_chemical' },
  { id: 'CRK-103', name: 'Cell Rack',            resourceType: 'Power Cells',     tier: 1, capacity: 200,    upgradesTo: 'CRK-203', color: '#ff6e40',            icon: '▣', autoCreatedWith: 'ENC-001', upgradeMaterial: 'power_cells' },
  // Tier 2 - Advanced
  { id: 'BIN-201', name: 'Alloy Vault',          resourceType: 'Adv. Alloy',      tier: 2, capacity: 1000,   upgradesTo: 'BIN-301', color: 'var(--neon-amber)',   icon: '⬡', autoCreatedWith: 'ALF-001', upgradeMaterial: 'base_alloy' },
  { id: 'ARY-202', name: 'Crystal Array',        resourceType: 'Res. Crystals',   tier: 2, capacity: 200,    upgradesTo: 'ARY-302', color: '#00e5ff',            icon: '◎', autoCreatedWith: 'CRS-001', upgradeMaterial: 'base_alloy' },
  { id: 'SIL-203', name: 'Element Silo',         resourceType: 'Rare Elements',   tier: 2, capacity: 300,    upgradesTo: 'SIL-303', color: '#ffd740',            icon: '⊙', autoCreatedWith: 'EXP-001', upgradeMaterial: 'abstractum' },
  // Tier 3 - Exotic
  { id: 'BIN-301', name: 'Nano-Container',       resourceType: 'Nanomaterial',    tier: 3, capacity: 500,    upgradesTo: 'BIN-401', color: '#b388ff',            icon: '⬡', autoCreatedWith: 'NFB-001', upgradeMaterial: 'advanced_alloy' },
  { id: 'EMC-302', name: 'Exotic Containment',   resourceType: 'Exotic Matter',   tier: 3, capacity: 200,    upgradesTo: 'EMC-402', color: 'var(--neon-pink)',    icon: '✧', autoCreatedWith: 'RRF-001', upgradeMaterial: 'advanced_alloy' },
  { id: 'FLK-303', name: 'Antimatter Flask',     resourceType: 'Antimatter',      tier: 3, capacity: 50,     upgradesTo: 'FLK-403', color: 'var(--neon-red)',     icon: '☢', autoCreatedWith: 'AMS-001', upgradeMaterial: 'advanced_alloy' },
  // Tier 4 - Quantum
  { id: 'BIN-401', name: 'Quantum Vault',        resourceType: 'Any Element',     tier: 4, capacity: 300,    upgradesTo: null,      color: '#b388ff',            icon: '◇', autoCreatedWith: 'QTF-001', upgradeMaterial: 'nanomaterial' },
  { id: 'TUB-402', name: 'Memetic Reservoir',    resourceType: 'Ideoplasm',       tier: 4, capacity: 200,    upgradesTo: null,      color: '#ea80fc',            icon: '◬', autoCreatedWith: 'MMF-001', upgradeMaterial: 'nanomaterial' },
  { id: 'COR-403', name: 'Anomaly Cage',         resourceType: 'Anomaly Cores',   tier: 4, capacity: 20,     upgradesTo: null,      color: '#ff5252',            icon: '⊗', autoCreatedWith: 'ANF-001', upgradeMaterial: 'nanomaterial' },
  // Tier 5 - Stellar
  { id: 'FRG-501', name: 'Stellar Vault',        resourceType: 'Heavy Elements',  tier: 5, capacity: 1000,   upgradesTo: null,      color: '#8d6e63',            icon: '★', autoCreatedWith: 'STF-001', upgradeMaterial: 'exotic_matter' },
  { id: 'SOL-502', name: 'Solvent Tank',         resourceType: 'Universal Fixer', tier: 5, capacity: 50,     upgradesTo: null,      color: '#e0e0e0',            icon: '⊕', upgradeMaterial: 'exotic_matter' },
]

export function getContainerDef(id: string): ResourceContainerDef | undefined {
  return RESOURCE_CONTAINERS.find(c => c.id === id)
}

export function getContainersByTier(tier: number): ResourceContainerDef[] {
  return RESOURCE_CONTAINERS.filter(c => c.tier === tier)
}
