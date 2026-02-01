// Database types
export * from './database'

// Device Manager types
export * from './devices'

// System Preferences types
export * from './sysprefs'

// Game constants
export const CRYSTAL_COLORS = [
  'infrared',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'violet',
  'gamma',
] as const

export const VOLATILITY_TIERS = ['1', '2', '3', '4', '5'] as const

export const ROTATION_DIRECTIONS = ['CW', 'CCW'] as const

export const CRYSTAL_STATES = ['stable', 'volatile', 'hybrid'] as const

export const CRYSTAL_ERAS = ['8-bit', '16-bit', '32-bit', '64-bit'] as const

export const SLICES_PER_CRYSTAL = 30

// Color spectrum wavelengths (nm)
export const COLOR_WAVELENGTHS: Record<string, { min: number; max: number }> = {
  infrared: { min: 700, max: 1000 },
  red: { min: 620, max: 700 },
  orange: { min: 590, max: 620 },
  yellow: { min: 570, max: 590 },
  green: { min: 495, max: 570 },
  blue: { min: 450, max: 495 },
  indigo: { min: 420, max: 450 },
  violet: { min: 380, max: 420 },
  gamma: { min: 0, max: 380 },
}

// Tech tree categories
export const TECH_CATEGORIES = [
  'devices',
  'optics',
  'adapters',
  'synthesizers',
] as const

export type TechCategory = (typeof TECH_CATEGORIES)[number]
