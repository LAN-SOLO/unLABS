'use server'

import { createClient } from '@/lib/supabase/server'
import {
  CRYSTAL_COLORS,
  SLICES_PER_CRYSTAL,
  COLOR_WAVELENGTHS,
} from '@/types'
import type {
  CrystalColor,
  VolatilityTier,
  RotationDirection,
  CrystalState,
  CrystalEra,
  Slice,
} from '@/types/database'

// Constants
const MINT_COST = 50

// Result types
export interface MintResult {
  success: boolean
  error?: string
  crystal?: {
    id: string
    name: string
    color: CrystalColor
    volatility: VolatilityTier
    rotation: RotationDirection
    state: CrystalState
    era: CrystalEra
  }
  newBalance?: number
}

export interface CrystalDetails {
  id: string
  name: string
  color: CrystalColor
  volatility: VolatilityTier
  rotation: RotationDirection
  state: CrystalState
  era: CrystalEra
  is_genesis: boolean
  total_power: number
  slice_count: number
  created_at: string
  slices: Slice[]
}

export interface RenameResult {
  success: boolean
  error?: string
  oldName?: string
  newName?: string
}

// Internal types for database operations
interface BalanceRow {
  available: number
  total_spent?: number
}

interface CrystalRow {
  id: string
  name: string
  color: CrystalColor
  volatility: VolatilityTier
  rotation: RotationDirection
  state: CrystalState
  era: CrystalEra
  is_genesis: boolean
  total_power: number
  slice_count: number
  created_at: string
}

// Validation
const NAME_REGEX = /^[a-zA-Z0-9_-]+$/
const MAX_NAME_LENGTH = 24

function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Crystal name is required.' }
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must be ${MAX_NAME_LENGTH} characters or less.` }
  }
  if (!NAME_REGEX.test(name)) {
    return { valid: false, error: 'Name can only contain letters, numbers, hyphens, and underscores.' }
  }
  return { valid: true }
}

// Weighted random selection
function weightedRandom<T>(options: { value: T; weight: number }[]): T {
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0)
  let random = Math.random() * totalWeight

  for (const option of options) {
    random -= option.weight
    if (random <= 0) {
      return option.value
    }
  }
  return options[options.length - 1].value
}

// Trait generation functions
function generateColor(): CrystalColor {
  const index = Math.floor(Math.random() * CRYSTAL_COLORS.length)
  return CRYSTAL_COLORS[index] as CrystalColor
}

function generateVolatility(): VolatilityTier {
  return weightedRandom([
    { value: '1' as VolatilityTier, weight: 35 },
    { value: '2' as VolatilityTier, weight: 30 },
    { value: '3' as VolatilityTier, weight: 20 },
    { value: '4' as VolatilityTier, weight: 10 },
    { value: '5' as VolatilityTier, weight: 5 },
  ])
}

function generateRotation(): RotationDirection {
  return Math.random() < 0.5 ? 'CW' : 'CCW'
}

function generateState(): CrystalState {
  return weightedRandom([
    { value: 'stable' as CrystalState, weight: 60 },
    { value: 'volatile' as CrystalState, weight: 25 },
    { value: 'hybrid' as CrystalState, weight: 15 },
  ])
}

function generateEra(): CrystalEra {
  return weightedRandom([
    { value: '8-bit' as CrystalEra, weight: 40 },
    { value: '16-bit' as CrystalEra, weight: 30 },
    { value: '32-bit' as CrystalEra, weight: 20 },
    { value: '64-bit' as CrystalEra, weight: 10 },
  ])
}

// Slice generation
function getBasePowerForEra(era: CrystalEra): number {
  switch (era) {
    case '8-bit': return 1.0
    case '16-bit': return 1.33
    case '32-bit': return 1.67
    case '64-bit': return 2.0
  }
}

function getBaseHueForColor(color: CrystalColor): number {
  const wavelength = COLOR_WAVELENGTHS[color]
  if (!wavelength) return 0

  const midWavelength = (wavelength.min + wavelength.max) / 2

  if (color === 'infrared') return 0
  if (color === 'gamma') return 270

  const normalizedWavelength = (midWavelength - 380) / (700 - 380)
  return Math.round(270 - normalizedWavelength * 270)
}

interface SliceInsert {
  crystal_id: string
  position: number
  power: number
  is_active: boolean
  hue: number
  saturation: number
  brightness: number
}

function generateSlices(crystalId: string, color: CrystalColor, era: CrystalEra): SliceInsert[] {
  const basePower = getBasePowerForEra(era)
  const baseHue = getBaseHueForColor(color)
  const slices: SliceInsert[] = []

  for (let i = 0; i < SLICES_PER_CRYSTAL; i++) {
    const powerVariance = 0.8 + Math.random() * 0.4
    const power = basePower * powerVariance

    const hueOffset = (i / SLICES_PER_CRYSTAL) * 30 - 15
    const hue = (baseHue + hueOffset + 360) % 360

    const saturation = 70 + Math.random() * 30
    const brightness = 60 + Math.random() * 40

    slices.push({
      crystal_id: crystalId,
      position: i,
      power: Math.round(power * 100) / 100,
      is_active: true,
      hue: Math.round(hue),
      saturation: Math.round(saturation),
      brightness: Math.round(brightness),
    })
  }

  return slices
}

// Type-safe database helpers using type assertions for Supabase operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

// Server Actions

export async function mintCrystal(name: string): Promise<MintResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated.' }
  }

  // Validate name
  const nameValidation = validateName(name)
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error }
  }

  // Check balance
  const { data: balanceData, error: balanceError } = await supabase
    .from('balances')
    .select('available, total_spent')
    .eq('user_id', user.id)
    .single()

  const balance = balanceData as BalanceRow | null

  if (balanceError || !balance) {
    return { success: false, error: 'Could not fetch balance.' }
  }

  if (balance.available < MINT_COST) {
    return { success: false, error: `Insufficient balance. Minting costs ${MINT_COST} _unSC. You have ${balance.available.toFixed(2)} _unSC.` }
  }

  // Check name uniqueness for this user
  const { data: existingCrystal } = await supabase
    .from('crystals')
    .select('id')
    .eq('owner_id', user.id)
    .ilike('name', name)
    .single()

  if (existingCrystal) {
    return { success: false, error: `You already have a crystal named "${name}".` }
  }

  // Generate traits
  const color = generateColor()
  const volatility = generateVolatility()
  const rotation = generateRotation()
  const state = generateState()
  const era = generateEra()

  // Calculate total power from slices
  const basePower = getBasePowerForEra(era)
  const totalPower = basePower * SLICES_PER_CRYSTAL

  // Deduct balance first
  const newBalance = balance.available - MINT_COST
  const newTotalSpent = (balance.total_spent || 0) + MINT_COST

  const { error: deductError } = await (supabase
    .from('balances') as AnyTable)
    .update({
      available: newBalance,
      total_spent: newTotalSpent,
    })
    .eq('user_id', user.id)

  if (deductError) {
    return { success: false, error: 'Failed to deduct balance.' }
  }

  // Create crystal
  const crystalInsert = {
    owner_id: user.id,
    name,
    color,
    volatility,
    rotation,
    state,
    era,
    is_genesis: false,
    total_power: totalPower,
    slice_count: SLICES_PER_CRYSTAL,
  }

  const { data: crystalData, error: crystalError } = await (supabase
    .from('crystals') as AnyTable)
    .insert(crystalInsert)
    .select('id, name, color, volatility, rotation, state, era')
    .single()

  const crystal = crystalData as CrystalRow | null

  if (crystalError || !crystal) {
    // Rollback balance
    await (supabase.from('balances') as AnyTable)
      .update({ available: balance.available })
      .eq('user_id', user.id)

    return { success: false, error: 'Failed to create crystal.' }
  }

  // Create slices
  const slices = generateSlices(crystal.id, color, era)
  const { error: slicesError } = await (supabase
    .from('slices') as AnyTable)
    .insert(slices)

  if (slicesError) {
    // Rollback: delete crystal and restore balance
    await supabase.from('crystals').delete().eq('id', crystal.id)
    await (supabase.from('balances') as AnyTable)
      .update({ available: balance.available })
      .eq('user_id', user.id)

    return { success: false, error: 'Failed to create crystal slices.' }
  }

  // Record transaction
  const transactionInsert = {
    user_id: user.id,
    type: 'mint',
    amount: -MINT_COST,
    crystal_id: crystal.id,
    description: `Minted crystal: ${name}`,
  }

  await (supabase.from('transactions') as AnyTable).insert(transactionInsert)

  return {
    success: true,
    crystal: {
      id: crystal.id,
      name: crystal.name,
      color: crystal.color,
      volatility: crystal.volatility,
      rotation: crystal.rotation,
      state: crystal.state,
      era: crystal.era,
    },
    newBalance,
  }
}

export async function fetchCrystalByName(name: string): Promise<CrystalDetails | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch crystal
  const { data: crystalData, error } = await supabase
    .from('crystals')
    .select('id, name, color, volatility, rotation, state, era, is_genesis, total_power, slice_count, created_at')
    .eq('owner_id', user.id)
    .ilike('name', name)
    .single()

  const crystal = crystalData as CrystalRow | null

  if (error || !crystal) return null

  // Fetch slices
  const { data: slicesData } = await supabase
    .from('slices')
    .select('*')
    .eq('crystal_id', crystal.id)
    .order('position', { ascending: true })

  const slices = (slicesData || []) as Slice[]

  return {
    id: crystal.id,
    name: crystal.name,
    color: crystal.color,
    volatility: crystal.volatility,
    rotation: crystal.rotation,
    state: crystal.state,
    era: crystal.era,
    is_genesis: crystal.is_genesis,
    total_power: crystal.total_power,
    slice_count: crystal.slice_count,
    created_at: crystal.created_at,
    slices,
  }
}

export async function renameCrystal(oldName: string, newName: string): Promise<RenameResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated.' }
  }

  // Validate new name
  const nameValidation = validateName(newName)
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error }
  }

  // Find crystal by old name
  const { data: crystalData, error: findError } = await supabase
    .from('crystals')
    .select('id, name')
    .eq('owner_id', user.id)
    .ilike('name', oldName)
    .single()

  const crystal = crystalData as { id: string; name: string } | null

  if (findError || !crystal) {
    return { success: false, error: `Crystal "${oldName}" not found.` }
  }

  // Check new name isn't taken
  const { data: existingCrystal } = await supabase
    .from('crystals')
    .select('id')
    .eq('owner_id', user.id)
    .ilike('name', newName)
    .single()

  if (existingCrystal) {
    return { success: false, error: `You already have a crystal named "${newName}".` }
  }

  // Update name
  const { error: updateError } = await (supabase
    .from('crystals') as AnyTable)
    .update({ name: newName })
    .eq('id', crystal.id)

  if (updateError) {
    return { success: false, error: 'Failed to rename crystal.' }
  }

  return {
    success: true,
    oldName: crystal.name,
    newName,
  }
}
