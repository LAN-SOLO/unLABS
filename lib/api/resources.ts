import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// =================================
// HELPERS
// =================================

function supabase(): SupabaseClient<Database> {
  return createClient()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromAny(table: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase() as any).from(table)
}

function throwOnError<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error
  return result.data as T
}

// =================================
// TYPES
// =================================

export interface ResourceContainerRow {
  container_id: string
  player_id: string
  resource_type: string
  base_capacity: number
  upgrade_level: number
  current_amount: number
  is_bootstrap: boolean
  replaced_by: string | null
  auto_created: boolean
}

export interface BootstrapStateRow {
  player_id: string
  cold_start_phase: number
  seep_collector_active: boolean
  seep_collector_contents: number
  residual_cell_discharged: boolean
  residual_cell_energy: number
  full_os_restored: boolean
  cold_start_started_at: string | null
  cold_start_completed_at: string | null
}

export interface ContainerDefinitionRow {
  container_type_id: string
  name: string
  resource_type: string
  base_capacity: number
  tier: number
  is_bootstrap: boolean
  replaces: string | null
  auto_created_with: string | null
  upgrade_material: string | null
  description: string | null
}

export interface ProductionRecipeRow {
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
}

export interface ProductionQueueRow {
  queue_id: string
  player_id: string
  device_id: string
  recipe_id: string
  batch_count: number
  status: string
  started_at: string | null
  completes_at: string | null
  paused_at: string | null
  pause_remaining_seconds: number | null
  inputs_consumed: Record<string, number>
  output_resource: string
  output_container: string
  output_amount: number
  energy_per_second: number
}

export interface AbstractumSourceRow {
  source_id: string
  player_id: string
  source_type: string
  rate_per_minute: number
  active: boolean
  activated_at: string
}

// =================================
// 1. RESOURCE CONTAINERS
// =================================

export async function getPlayerContainers(playerId: string): Promise<ResourceContainerRow[]> {
  const result = await fromAny('resource_containers')
    .select('*')
    .eq('player_id', playerId)
  return throwOnError(result) as ResourceContainerRow[]
}

export async function upsertPlayerContainer(
  playerId: string,
  containerId: string,
  data: {
    resource_type: string
    base_capacity: number
    upgrade_level: number
    current_amount: number
    is_bootstrap?: boolean
    auto_created?: boolean
  }
): Promise<void> {
  const result = await fromAny('resource_containers')
    .upsert(
      {
        container_id: containerId,
        player_id: playerId,
        ...data,
      },
      { onConflict: 'container_id,player_id' }
    )
  throwOnError(result)
}

// =================================
// 2. CONTAINER DEFINITIONS (cached)
// =================================

let _containerDefsCache: ContainerDefinitionRow[] | null = null

export async function getContainerDefinitions(): Promise<ContainerDefinitionRow[]> {
  if (_containerDefsCache) return _containerDefsCache
  const result = await fromAny('container_definitions')
    .select('*')
    .order('tier')
  _containerDefsCache = throwOnError(result) as ContainerDefinitionRow[]
  return _containerDefsCache
}

// =================================
// 3. BOOTSTRAP STATE
// =================================

export async function getBootstrapState(playerId: string): Promise<BootstrapStateRow | null> {
  const result = await fromAny('bootstrap_state')
    .select('*')
    .eq('player_id', playerId)
    .maybeSingle()
  if (result.error) throw result.error
  return result.data as BootstrapStateRow | null
}

export async function upsertBootstrapState(
  playerId: string,
  data: Partial<Omit<BootstrapStateRow, 'player_id'>>
): Promise<void> {
  const result = await fromAny('bootstrap_state')
    .upsert(
      { player_id: playerId, ...data },
      { onConflict: 'player_id' }
    )
  throwOnError(result)
}

// =================================
// 4. PRODUCTION RECIPES (cached)
// =================================

let _recipesCache: ProductionRecipeRow[] | null = null

export async function getProductionRecipes(): Promise<ProductionRecipeRow[]> {
  if (_recipesCache) return _recipesCache
  const result = await fromAny('production_recipes')
    .select('*')
    .order('tier')
  _recipesCache = throwOnError(result) as ProductionRecipeRow[]
  return _recipesCache
}

// =================================
// 5. PRODUCTION QUEUE
// =================================

export async function getProductionQueue(playerId: string): Promise<ProductionQueueRow[]> {
  const result = await fromAny('production_queue')
    .select('*')
    .eq('player_id', playerId)
    .in('status', ['pending', 'active', 'paused'])
    .order('created_at')
  return throwOnError(result) as ProductionQueueRow[]
}

export async function queueProduction(
  playerId: string,
  deviceId: string,
  recipeId: string,
  outputContainer: string,
  inputsConsumed: Record<string, number>,
  outputResource: string,
  outputAmount: number,
  energyPerSecond: number,
  completesAt: string
): Promise<ProductionQueueRow> {
  const result = await fromAny('production_queue')
    .insert({
      player_id: playerId,
      device_id: deviceId,
      recipe_id: recipeId,
      status: 'active',
      started_at: new Date().toISOString(),
      completes_at: completesAt,
      inputs_consumed: inputsConsumed,
      output_resource: outputResource,
      output_container: outputContainer,
      output_amount: outputAmount,
      energy_per_second: energyPerSecond,
    })
    .select()
    .single()
  return throwOnError(result) as ProductionQueueRow
}

export async function cancelProduction(queueId: string): Promise<void> {
  const result = await fromAny('production_queue')
    .update({ status: 'cancelled' })
    .eq('queue_id', queueId)
  throwOnError(result)
}

// =================================
// 6. ABSTRACTUM SOURCES
// =================================

export async function getAbstractumSources(playerId: string): Promise<AbstractumSourceRow[]> {
  const result = await fromAny('abstractum_sources')
    .select('*')
    .eq('player_id', playerId)
  return throwOnError(result) as AbstractumSourceRow[]
}

export async function upsertAbstractumSource(
  playerId: string,
  sourceId: string,
  data: {
    source_type: string
    rate_per_minute: number
    active: boolean
  }
): Promise<void> {
  const result = await fromAny('abstractum_sources')
    .upsert(
      {
        source_id: sourceId,
        player_id: playerId,
        ...data,
      },
      { onConflict: 'source_id,player_id' }
    )
  throwOnError(result)
}

// =================================
// 7. CONTAINER UPGRADES
// =================================

export async function recordContainerUpgrade(
  playerId: string,
  containerId: string,
  fromLevel: number,
  toLevel: number,
  cost: { material: Record<string, number>; unsc: number }
): Promise<void> {
  const result = await fromAny('container_upgrades')
    .insert({
      player_id: playerId,
      container_id: containerId,
      from_level: fromLevel,
      to_level: toLevel,
      material_cost: cost.material,
      unsc_cost: cost.unsc,
    })
  throwOnError(result)
}
