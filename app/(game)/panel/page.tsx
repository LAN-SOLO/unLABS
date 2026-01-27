import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PanelClient } from './panel-client'
import type { EquipmentData, TechTreeProgress } from '../terminal/actions/equipment'

// Type workaround for Supabase strict typing
type AnyTable = ReturnType<Awaited<ReturnType<typeof createClient>>['from']>

interface ProfileData {
  username: string | null
  display_name: string | null
}

interface BalanceData {
  available: number
  staked: number
  locked: number
}

interface CrystalData {
  id: string
  total_power: number
  slice_count: number
}

interface TechTreeData {
  id: string
  name: string
  category: string
  max_tier: number
}

interface ResearchData {
  current_tier: number
  experience: number
  experience_to_next: number
  tech_tree: TechTreeData
}

interface VolatilityData {
  tps: number
  calculated_tier: string
  network: string
}

// Tier names from documentation
const TIER_NAMES: Record<string, string[]> = {
  devices: ['Offline', 'Basic Assembly Rig', 'Precision Rotator', 'Quantum Chamber', 'Assembly AI', 'Halo Fabricator'],
  optics: ['Offline', 'Prism Rack α', 'Laser Etalon β', 'Wave-Splitter Γ', 'Holo Projector Ω', 'Planck-Lens'],
  adapters: ['Offline', 'Ticker Tap α', 'Oracle Dock β', 'Multi-Oracle Γ', 'Data Bank Ω', 'Predictive AI'],
  synthesizers: ['Offline', 'Micro-Shard', 'State-Tuner', 'Color Fuser β', 'Hybrid-Splicer Ω', 'Reality Weaver'],
}

function createDefaultProgress(category: string, name: string): TechTreeProgress {
  return {
    name,
    category,
    currentTier: 0,
    maxTier: 5,
    experience: 0,
    experienceToNext: 100,
    tierName: TIER_NAMES[category]?.[0] || 'Offline',
    isMaxed: false,
  }
}

export default async function PanelPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all data in parallel
  const [profileResult, balanceResult, crystalsResult, techTreesResult, progressResult, volatilityResult] =
    await Promise.all([
      (supabase.from('profiles') as AnyTable)
        .select('username, display_name')
        .eq('id', user.id)
        .single(),
      (supabase.from('balances') as AnyTable)
        .select('available, staked, locked')
        .eq('user_id', user.id)
        .single(),
      (supabase.from('crystals') as AnyTable)
        .select('id, total_power, slice_count')
        .eq('owner_id', user.id),
      (supabase.from('tech_trees') as AnyTable).select('*'),
      (supabase.from('research_progress') as AnyTable)
        .select('current_tier, experience, experience_to_next, tech_tree:tech_trees(*)')
        .eq('user_id', user.id),
      (supabase.from('volatility_snapshots') as AnyTable)
        .select('tps, calculated_tier, network')
        .order('captured_at', { ascending: false })
        .limit(1)
        .single(),
    ])

  // Process profile
  const profile = profileResult.data as ProfileData | null
  const username =
    profile?.username || profile?.display_name || user.email?.split('@')[0] || null

  // Process balance
  const balance = (balanceResult.data as BalanceData | null) || {
    available: 100,
    staked: 0,
    locked: 0,
  }

  // Process crystals
  const crystals = (crystalsResult.data as CrystalData[] | null) || []
  const crystalData = {
    count: crystals.length,
    totalSlices: crystals.reduce((sum, c) => sum + (c.slice_count || 0), 0),
    totalPower: crystals.reduce((sum, c) => sum + (c.total_power || 0), 0),
  }

  // Process tech trees
  const progress = (progressResult.data as ResearchData[] | null) || []
  const techTreeProgress: Record<string, TechTreeProgress> = {
    devices: createDefaultProgress('devices', 'Devices'),
    optics: createDefaultProgress('optics', 'Optics'),
    adapters: createDefaultProgress('adapters', 'Adapters'),
    synthesizers: createDefaultProgress('synthesizers', 'Synthesizers'),
  }

  for (const p of progress) {
    const category = p.tech_tree?.category?.toLowerCase()
    if (category && techTreeProgress[category]) {
      const tier = p.current_tier
      techTreeProgress[category] = {
        name: p.tech_tree.name,
        category: category,
        currentTier: tier,
        maxTier: p.tech_tree.max_tier,
        experience: p.experience,
        experienceToNext: p.experience_to_next,
        tierName: TIER_NAMES[category]?.[tier] || `Tier ${tier}`,
        isMaxed: tier >= p.tech_tree.max_tier,
      }
    }
  }

  // Process volatility
  const volatility = (volatilityResult.data as VolatilityData | null) || {
    tps: 1000,
    calculated_tier: '1',
    network: 'solana-devnet',
  }

  // Build equipment data
  const equipmentData: EquipmentData = {
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

  return (
    <PanelClient
      userId={user.id}
      username={username}
      balance={balance.available}
      equipmentData={equipmentData}
    />
  )
}
