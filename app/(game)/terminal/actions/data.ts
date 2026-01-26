'use server'

import { createClient } from '@/lib/supabase/server'

export interface UserProfile {
  username: string | null
  display_name: string | null
}

export interface UserBalance {
  available: number
  staked: number
  locked: number
  total_earned: number
  total_spent: number
}

export interface Crystal {
  id: string
  name: string
  color: string
  volatility: string
  rotation: string
  state: string
  era: string
  is_genesis: boolean
  total_power: number
  slice_count: number
}

export interface TechProgress {
  tech_tree_name: string
  category: string
  current_tier: number
  experience: number
  experience_to_next: number
}

export interface CommandHistoryEntry {
  command: string
  created_at: string
}

// Fetch user balance
export async function fetchBalance(): Promise<UserBalance | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('balances')
    .select('available, staked, locked, total_earned, total_spent')
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching balance:', error)
    return null
  }

  return data as UserBalance
}

// Fetch user crystals
export async function fetchCrystals(): Promise<Crystal[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('crystals')
    .select('id, name, color, volatility, rotation, state, era, is_genesis, total_power, slice_count')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching crystals:', error)
    return []
  }

  return (data || []) as Crystal[]
}

// Fetch tech tree progress
export async function fetchResearchProgress(): Promise<TechProgress[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('research_progress')
    .select(`
      current_tier,
      experience,
      experience_to_next,
      tech_trees (
        name,
        category
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching research:', error)
    return []
  }

  return (data || []).map((item: Record<string, unknown>) => ({
    tech_tree_name: (item.tech_trees as Record<string, string>)?.name || 'Unknown',
    category: (item.tech_trees as Record<string, string>)?.category || 'unknown',
    current_tier: item.current_tier as number,
    experience: item.experience as number,
    experience_to_next: item.experience_to_next as number,
  }))
}

// Log command to history
export async function logCommand(
  command: string,
  args: string[],
  output: string,
  success: boolean,
  executionTimeMs: number
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  // Use type assertion since command_history may not be in generated types yet
  await (supabase.from('command_history') as unknown as {
    insert: (data: Record<string, unknown>) => Promise<unknown>
  }).insert({
    user_id: user.id,
    command,
    args,
    output: output.slice(0, 10000), // Limit output size
    success,
    execution_time_ms: executionTimeMs,
  })
}

// Fetch recent command history
export async function fetchCommandHistory(limit: number = 20): Promise<CommandHistoryEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('command_history')
    .select('command, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching history:', error)
    return []
  }

  return (data || []) as CommandHistoryEntry[]
}

// Fetch latest volatility snapshot
export async function fetchVolatility(): Promise<{ tps: number; tier: string; block_time_ms: number } | null> {
  const supabase = await createClient()

  // Use type assertion since volatility_snapshots may not be in generated types yet
  const { data, error } = await (supabase
    .from('volatility_snapshots') as unknown as {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => {
            single: () => Promise<{ data: { tps: number; calculated_tier: string; block_time_ms: number } | null; error: unknown }>
          }
        }
      }
    })
    .select('tps, calculated_tier, block_time_ms')
    .order('captured_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    // Return simulated data if no snapshots exist
    const tps = Math.floor(Math.random() * 3000) + 1000
    const tier = tps < 1500 ? '1' : tps < 2000 ? '2' : tps < 2500 ? '3' : tps < 3000 ? '4' : '5'
    return { tps, tier, block_time_ms: Math.floor(400 + Math.random() * 100) }
  }

  return {
    tps: data.tps,
    tier: data.calculated_tier,
    block_time_ms: data.block_time_ms,
  }
}
