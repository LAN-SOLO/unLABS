'use server'

import { createClient } from '@/lib/supabase/server'
import type { ResourceSaveData } from '@/contexts/ResourceManager'
import { RESOURCE_CONTAINERS, RESOURCE_TYPE_MAP } from '@/types/resources'

// ── Helpers ────────────────────────────────────────────────

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromAny(supabase: any, table: string): any {
  return supabase.from(table)
}

// ── Fetch player resources → ResourceSaveData ──────────────

export async function fetchPlayerResources(): Promise<ResourceSaveData | null> {
  const { supabase, user } = await getUser()
  if (!user) return null

  const { data, error } = await fromAny(supabase, 'resource_containers')
    .select('container_id, current_amount, upgrade_level')
    .eq('player_id', user.id)

  if (error || !data || data.length === 0) return null

  const result: ResourceSaveData = {}
  for (const row of data as { container_id: string; current_amount: number; upgrade_level: number }[]) {
    result[row.container_id] = {
      amount: Number(row.current_amount),
      isUnlocked: true,
      upgradeLevel: row.upgrade_level,
    }
  }
  return result
}

// ── Sync resource state to DB ──────────────────────────────

export async function syncResourceState(saveData: ResourceSaveData): Promise<void> {
  const { supabase, user } = await getUser()
  if (!user) return

  const rows = []
  for (const [id, entry] of Object.entries(saveData)) {
    if (!entry.isUnlocked) continue
    const def = RESOURCE_CONTAINERS.find(d => d.id === id)
    if (!def) continue
    rows.push({
      container_id: id,
      player_id: user.id,
      resource_type: RESOURCE_TYPE_MAP[def.resourceType] ?? def.resourceType.toLowerCase().replace(/[.\s]/g, '_'),
      base_capacity: def.capacity,
      upgrade_level: entry.upgradeLevel ?? 0,
      current_amount: entry.amount,
      is_bootstrap: def.tier === 0,
      auto_created: false,
    })
  }

  if (rows.length === 0) return

  await fromAny(supabase, 'resource_containers')
    .upsert(rows, { onConflict: 'container_id,player_id' })
}

// ── Bootstrap state ────────────────────────────────────────

export async function fetchBootstrapState(): Promise<{
  coldStartPhase: number
  seepCollectorActive: boolean
  residualCellDischarged: boolean
  fullOsRestored: boolean
} | null> {
  const { supabase, user } = await getUser()
  if (!user) return null

  const { data, error } = await fromAny(supabase, 'bootstrap_state')
    .select('cold_start_phase, seep_collector_active, residual_cell_discharged, full_os_restored')
    .eq('player_id', user.id)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    cold_start_phase: number
    seep_collector_active: boolean
    residual_cell_discharged: boolean
    full_os_restored: boolean
  }
  return {
    coldStartPhase: row.cold_start_phase,
    seepCollectorActive: row.seep_collector_active,
    residualCellDischarged: row.residual_cell_discharged,
    fullOsRestored: row.full_os_restored,
  }
}

export async function advanceBootstrapPhase(newPhase: number): Promise<boolean> {
  const { supabase, user } = await getUser()
  if (!user) return false

  const { error } = await fromAny(supabase, 'bootstrap_state')
    .upsert(
      { player_id: user.id, cold_start_phase: newPhase },
      { onConflict: 'player_id' }
    )

  return !error
}

// ── Production recipes ─────────────────────────────────────

export interface ProductionRecipe {
  recipeId: string
  deviceType: string
  inputs: Record<string, number>
  outputResource: string
  outputAmount: number
  productionTimeSeconds: number
  energyDraw: number
  tier: number
  requiresScience: string[] | null
  description: string | null
}

export async function fetchProductionRecipes(): Promise<ProductionRecipe[]> {
  const { supabase } = await getUser()

  const { data, error } = await fromAny(supabase, 'production_recipes')
    .select('*')
    .order('tier')

  if (error || !data) return []

  return (data as {
    recipe_id: string
    device_type: string
    inputs: Record<string, number>
    output_resource: string
    output_amount: number
    production_time_seconds: number
    energy_draw: number
    tier: number
    requires_science: string[] | null
    description: string | null
  }[]).map(r => ({
    recipeId: r.recipe_id,
    deviceType: r.device_type,
    inputs: r.inputs,
    outputResource: r.output_resource,
    outputAmount: Number(r.output_amount),
    productionTimeSeconds: r.production_time_seconds,
    energyDraw: Number(r.energy_draw),
    tier: r.tier,
    requiresScience: r.requires_science,
    description: r.description,
  }))
}

// ── Production queue ───────────────────────────────────────

export interface ProductionJob {
  queueId: string
  deviceId: string
  recipeId: string
  status: string
  startedAt: string | null
  completesAt: string | null
  outputResource: string
  outputAmount: number
  energyPerSecond: number
}

export async function startProduction(recipeId: string, deviceId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Fetch recipe
  const { data: recipe, error: recipeErr } = await fromAny(supabase, 'production_recipes')
    .select('*')
    .eq('recipe_id', recipeId)
    .single()

  if (recipeErr || !recipe) return { success: false, error: `Unknown recipe: ${recipeId}` }

  const r = recipe as {
    output_resource: string
    output_amount: number
    production_time_seconds: number
    energy_draw: number
    inputs: Record<string, number>
  }

  // Find output container
  const outputDef = RESOURCE_CONTAINERS.find(d =>
    (RESOURCE_TYPE_MAP[d.resourceType] ?? d.resourceType.toLowerCase().replace(/[.\s]/g, '_')) === r.output_resource
  )
  if (!outputDef) return { success: false, error: `No container for ${r.output_resource}` }

  const completesAt = new Date(Date.now() + r.production_time_seconds * 1000).toISOString()

  const { error } = await fromAny(supabase, 'production_queue')
    .insert({
      player_id: user.id,
      device_id: deviceId,
      recipe_id: recipeId,
      status: 'active',
      started_at: new Date().toISOString(),
      completes_at: completesAt,
      inputs_consumed: r.inputs,
      output_resource: r.output_resource,
      output_container: outputDef.id,
      output_amount: r.output_amount,
      energy_per_second: r.energy_draw,
    })

  if (error) return { success: false, error: 'Failed to queue production' }
  return { success: true }
}

export async function fetchProductionQueue(): Promise<ProductionJob[]> {
  const { supabase, user } = await getUser()
  if (!user) return []

  const { data, error } = await fromAny(supabase, 'production_queue')
    .select('queue_id, device_id, recipe_id, status, started_at, completes_at, output_resource, output_amount, energy_per_second')
    .eq('player_id', user.id)
    .in('status', ['pending', 'active', 'paused'])
    .order('created_at')

  if (error || !data) return []

  return (data as {
    queue_id: string
    device_id: string
    recipe_id: string
    status: string
    started_at: string | null
    completes_at: string | null
    output_resource: string
    output_amount: number
    energy_per_second: number
  }[]).map(r => ({
    queueId: r.queue_id,
    deviceId: r.device_id,
    recipeId: r.recipe_id,
    status: r.status,
    startedAt: r.started_at,
    completesAt: r.completes_at,
    outputResource: r.output_resource,
    outputAmount: Number(r.output_amount),
    energyPerSecond: Number(r.energy_per_second),
  }))
}

export async function cancelProduction(queueId: string): Promise<boolean> {
  const { supabase, user } = await getUser()
  if (!user) return false

  const { error } = await fromAny(supabase, 'production_queue')
    .update({ status: 'cancelled' })
    .eq('queue_id', queueId)
    .eq('player_id', user.id)

  return !error
}
