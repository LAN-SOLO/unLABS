'use server'

import { createClient } from '@/lib/supabase/server'
import type { TechTree, ResearchProgress, Crystal, Balance } from '@/types'

// Type workaround for Supabase strict typing
type AnyTable = ReturnType<Awaited<ReturnType<typeof createClient>>['from']>

export interface EquipmentData {
  crystals: {
    count: number
    totalSlices: number
    totalPower: number
  }
  balance: {
    available: number
    staked: number
    locked: number
  }
  techTrees: {
    devices: TechTreeProgress
    optics: TechTreeProgress
    adapters: TechTreeProgress
    synthesizers: TechTreeProgress
  }
  volatility: {
    currentTier: number
    tps: number
    network: string
  }
}

export interface TechTreeProgress {
  name: string
  category: string
  currentTier: number
  maxTier: number
  experience: number
  experienceToNext: number
  tierName: string
  isMaxed: boolean
}

// Tech tree tier names from documentation
const TECH_TREE_TIERS: Record<string, string[]> = {
  devices: [
    'Offline',
    'Basic Assembly Rig',
    'Precision Rotator Platform',
    'Quantum Containment Chamber',
    'Autonomous Assembly AI',
    'Halo Fabricator Array',
  ],
  optics: [
    'Offline',
    'Prism Rack α',
    'Laser Etalon β',
    'Wave-Length Splitter Γ',
    'Holographic Projector Ω',
    'Planck-Lens',
  ],
  adapters: [
    'Offline',
    'Ticker Tap α',
    'Oracle Dock β',
    'Multi-Oracle Hub Γ',
    'Historical Data Bank Ω',
    'Predictive-AI Ledger Mesh',
  ],
  synthesizers: [
    'Offline',
    'Micro-Shard Printer',
    'State-Tuner Rig',
    'Color Fuser β',
    'Hybrid-Splicer Ω',
    'Reality Weaver',
  ],
}

// Upgrade costs from documentation
export const TECH_TREE_COSTS: Record<string, number[]> = {
  devices: [0, 100, 300, 1000, 2500, 5000],
  optics: [0, 50, 200, 800, 2000, 5000],
  adapters: [0, 100, 300, 1000, 2500, 5000],
  synthesizers: [0, 150, 500, 1200, 3000, 8000],
}

function getTierName(category: string, tier: number): string {
  const tiers = TECH_TREE_TIERS[category.toLowerCase()]
  if (!tiers) return `Tier ${tier}`
  return tiers[tier] || `Tier ${tier}`
}

export async function fetchEquipmentData(): Promise<EquipmentData | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch all data in parallel
  const [
    crystalsResult,
    balanceResult,
    techTreesResult,
    progressResult,
    volatilityResult,
  ] = await Promise.all([
    // Crystals with aggregates
    (supabase.from('crystals') as AnyTable)
      .select('id, total_power, slice_count')
      .eq('owner_id', user.id),

    // Balance
    (supabase.from('balances') as AnyTable)
      .select('available, staked, locked')
      .eq('user_id', user.id)
      .single(),

    // Tech trees
    (supabase.from('tech_trees') as AnyTable)
      .select('*'),

    // Research progress
    (supabase.from('research_progress') as AnyTable)
      .select('*, tech_tree:tech_trees(*)')
      .eq('user_id', user.id),

    // Latest volatility snapshot
    (supabase.from('volatility_snapshots') as AnyTable)
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  // Calculate crystal totals
  const crystals = crystalsResult.data as Crystal[] || []
  const crystalData = {
    count: crystals.length,
    totalSlices: crystals.reduce((sum, c) => sum + (c.slice_count || 0), 0),
    totalPower: crystals.reduce((sum, c) => sum + (c.total_power || 0), 0),
  }

  // Balance data
  const balance = balanceResult.data || { available: 100, staked: 0, locked: 0 }

  // Build tech tree progress map
  const techTrees = techTreesResult.data as TechTree[] || []
  const progress = progressResult.data as (ResearchProgress & { tech_tree: TechTree })[] || []

  const techTreeProgress: Record<string, TechTreeProgress> = {
    devices: createDefaultProgress('devices', 'Devices'),
    optics: createDefaultProgress('optics', 'Optics'),
    adapters: createDefaultProgress('adapters', 'Adapters'),
    synthesizers: createDefaultProgress('synthesizers', 'Synthesizers'),
  }

  // Map actual progress
  for (const p of progress) {
    const category = p.tech_tree?.category?.toLowerCase()
    if (category && techTreeProgress[category]) {
      techTreeProgress[category] = {
        name: p.tech_tree.name,
        category: category,
        currentTier: p.current_tier,
        maxTier: p.tech_tree.max_tier,
        experience: p.experience,
        experienceToNext: p.experience_to_next,
        tierName: getTierName(category, p.current_tier),
        isMaxed: p.current_tier >= p.tech_tree.max_tier,
      }
    }
  }

  // Volatility data
  const volatility = volatilityResult.data || { calculated_tier: '1', tps: 1000, network: 'solana-devnet' }

  return {
    crystals: crystalData,
    balance: {
      available: balance.available,
      staked: balance.staked,
      locked: balance.locked,
    },
    techTrees: techTreeProgress as EquipmentData['techTrees'],
    volatility: {
      currentTier: parseInt(volatility.calculated_tier),
      tps: volatility.tps,
      network: volatility.network,
    },
  }
}

function createDefaultProgress(category: string, name: string): TechTreeProgress {
  return {
    name,
    category,
    currentTier: 0,
    maxTier: 5,
    experience: 0,
    experienceToNext: 100,
    tierName: getTierName(category, 0),
    isMaxed: false,
  }
}

export interface ResearchResult {
  success: boolean
  message: string
  newTier?: number
  newBalance?: number
}

export async function investInResearch(
  category: string,
  amount: number
): Promise<ResearchResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Not authenticated' }
  }

  // Single atomic RPC call replaces 6-7 sequential queries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('invest_in_research', {
    p_user_id: user.id,
    p_category: category,
    p_amount: amount,
  })

  if (error) {
    return { success: false, message: error.message || 'Research investment failed' }
  }

  const result = data as {
    success: boolean
    message: string
    new_tier?: number
    new_balance?: number
    tier_up?: boolean
  }

  if (!result.success) {
    return { success: false, message: result.message }
  }

  const tierName = getTierName(category.toLowerCase(), result.new_tier ?? 0)

  if (result.tier_up) {
    return {
      success: true,
      message: `Tier up! Now at ${tierName}`,
      newTier: result.new_tier,
      newBalance: result.new_balance,
    }
  }

  return {
    success: true,
    message: result.message,
    newTier: result.new_tier,
    newBalance: result.new_balance,
  }
}
