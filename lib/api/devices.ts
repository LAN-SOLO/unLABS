import { createClient } from '@/lib/supabase/client'
import type {
  Device,
  DeviceRuntimeState,
  DeviceDependency,
  DeviceCombination,
  DeviceTweak,
  PlayerDeviceState,
  DevicePowerSummary,
  DeviceCategory,
  DeviceState,
  DependencyStatus,
  TweakOption,
  DeviceRow,
  DeviceStateRow,
  DeviceDependencyRow,
  DeviceCombinationRow,
  DeviceTweakRow,
  PlayerDeviceStateRow,
} from '@/types/devices'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// =================================
// HELPERS
// =================================

function supabase(): SupabaseClient<Database> {
  return createClient()
}

/**
 * Untyped from() for device tables whose types aren't in the generated
 * Database interface yet. Supabase resolves these as `never`; this helper
 * escapes that constraint so we can use the full query-builder API.
 */
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
// 1. DEVICE QUERIES
// =================================

export async function getAllDevices(): Promise<Device[]> {
  const result = await fromAny('devices')
    .select('*')
    .order('tier')
    .order('name')
  return throwOnError(result) as Device[]
}

export async function getDeviceById(device_id: string): Promise<Device> {
  const result = await fromAny('devices')
    .select('*')
    .eq('device_id', device_id)
    .single()
  return throwOnError(result) as Device
}

export async function getDevicesByCategory(category: DeviceCategory): Promise<Device[]> {
  const result = await fromAny('devices')
    .select('*')
    .eq('category', category)
    .order('tier')
    .order('name')
  return throwOnError(result) as Device[]
}

export async function getDevicesByTier(tier: number): Promise<Device[]> {
  const result = await fromAny('devices')
    .select('*')
    .eq('tier', tier)
    .order('category')
    .order('name')
  return throwOnError(result) as Device[]
}

export async function searchDevices(query: string): Promise<Device[]> {
  const pattern = `%${query}%`
  const result = await fromAny('devices')
    .select('*')
    .or(`name.ilike.${pattern},device_id.ilike.${pattern},description.ilike.${pattern}`)
    .order('name')
  return throwOnError(result) as Device[]
}

// =================================
// 2. STATE MANAGEMENT
// =================================

export async function getDeviceState(device_id: string): Promise<DeviceRuntimeState> {
  const result = await fromAny('device_state')
    .select('*')
    .eq('device_id', device_id)
    .single()
  return throwOnError(result) as DeviceRuntimeState
}

export async function getAllDeviceStates(): Promise<DeviceRuntimeState[]> {
  const result = await fromAny('device_state').select('*')
  return throwOnError(result) as DeviceRuntimeState[]
}

export async function updateDeviceState(
  device_id: string,
  state: Partial<Omit<DeviceRuntimeState, 'device_id'>>
): Promise<void> {
  const result = await fromAny('device_state')
    .update(state)
    .eq('device_id', device_id)
  throwOnError(result)
}

export async function setDevicePowerState(
  device_id: string,
  state: 'online' | 'standby' | 'offline'
): Promise<void> {
  const device = await getDeviceById(device_id)
  const powerMap: Record<string, number> = {
    online: device.power_full,
    standby: device.power_standby,
    offline: 0,
  }
  await updateDeviceState(device_id, {
    state,
    power_current: powerMap[state],
  })
}

// =================================
// 3. DEPENDENCIES
// =================================

export async function getDeviceDependencies(device_id: string): Promise<DeviceDependency[]> {
  const result = await fromAny('device_dependencies')
    .select('*')
    .eq('device_id', device_id)
  const rows = throwOnError(result) as DeviceDependencyRow[]
  // Status is resolved at the app layer — default to 'locked' here.
  // Callers with player context should hydrate with actual research progress.
  return rows.map((r) => ({ ...r, status: 'locked' as DependencyStatus }))
}

export async function getDeviceUnlocks(device_id: string): Promise<string[]> {
  const device = await getDeviceById(device_id)
  const result = await fromAny('device_dependencies')
    .select('device_id')
    .eq('tech_tree', device.tech_tree)
    .lte('tier', device.tier)
  const rows = throwOnError(result) as Pick<DeviceDependencyRow, 'device_id'>[]
  return rows.map((r) => r.device_id)
}

export interface DependencyTreeNode {
  device_id: string
  name: string
  tier: number
  tech_tree: string
  status: DependencyStatus
  children: DependencyTreeNode[]
}

export async function getDependencyTree(device_id: string): Promise<DependencyTreeNode> {
  const device = await getDeviceById(device_id)
  const deps = await getDeviceDependencies(device_id)

  const children: DependencyTreeNode[] = await Promise.all(
    deps.map(async (dep) => {
      const result = await fromAny('devices')
        .select('device_id, name, tier, tech_tree')
        .eq('tech_tree', dep.tech_tree)
        .lte('tier', dep.tier)
        .order('tier', { ascending: false })
        .limit(1)
        .maybeSingle()
      const prerequisite = result.data as Pick<Device, 'device_id' | 'name' | 'tier' | 'tech_tree'> | null
      if (prerequisite) {
        return getDependencyTree(prerequisite.device_id)
      }
      return {
        device_id: dep.item_name,
        name: dep.item_name,
        tier: dep.tier,
        tech_tree: dep.tech_tree,
        status: dep.status,
        children: [],
      }
    })
  )

  return {
    device_id: device.device_id,
    name: device.name,
    tier: device.tier,
    tech_tree: device.tech_tree,
    status: 'locked',
    children,
  }
}

// =================================
// 4. COMBINATIONS
// =================================

export async function getDeviceCombinations(device_id: string): Promise<DeviceCombination[]> {
  const result = await fromAny('device_combinations')
    .select('*')
    .or(`primary_device.eq.${device_id},secondary_device.eq.${device_id}`)
  const rows = throwOnError(result) as DeviceCombinationRow[]
  return rows.map((r) => ({
    ...r,
    effect_description: r.effect_description ?? '',
    combined_power: r.combined_power ?? 0,
    is_unlocked: false,
    is_active: false,
  }))
}

export async function getActiveCombinations(player_id: string): Promise<DeviceCombination[]> {
  const playerDevices = await fromAny('player_device_state')
    .select('device_id, active_links')
    .eq('player_id', player_id)
    .eq('current_state', 'online')
  const devices = throwOnError(playerDevices) as Pick<PlayerDeviceStateRow, 'device_id' | 'active_links'>[]

  const linkedPairs = new Set<string>()
  for (const d of devices) {
    if (d.active_links) {
      for (const link of d.active_links) {
        const pair = [d.device_id, link].sort().join(':')
        linkedPairs.add(pair)
      }
    }
  }

  if (linkedPairs.size === 0) return []

  const deviceIds = devices.map((d) => d.device_id)
  const result = await fromAny('device_combinations')
    .select('*')
    .in('primary_device', deviceIds)
  const combos = throwOnError(result) as DeviceCombinationRow[]

  return combos
    .filter((c) => {
      const pair = [c.primary_device, c.secondary_device].sort().join(':')
      return linkedPairs.has(pair)
    })
    .map((c) => ({
      ...c,
      effect_description: c.effect_description ?? '',
      combined_power: c.combined_power ?? 0,
      is_unlocked: true,
      is_active: true,
    }))
}

export async function linkDevices(
  player_id: string,
  device1: string,
  device2: string
): Promise<void> {
  const result = await fromAny('player_device_state')
    .select('device_id, active_links')
    .eq('player_id', player_id)
    .in('device_id', [device1, device2])
  const rows = throwOnError(result) as Pick<PlayerDeviceStateRow, 'device_id' | 'active_links'>[]

  for (const row of rows) {
    const other = row.device_id === device1 ? device2 : device1
    const links: string[] = row.active_links ? [...row.active_links] : []
    if (!links.includes(other)) {
      links.push(other)
      await fromAny('player_device_state')
        .update({ active_links: links })
        .eq('player_id', player_id)
        .eq('device_id', row.device_id)
    }
  }
}

export async function unlinkDevices(
  player_id: string,
  device1: string,
  device2: string
): Promise<void> {
  const result = await fromAny('player_device_state')
    .select('device_id, active_links')
    .eq('player_id', player_id)
    .in('device_id', [device1, device2])
  const rows = throwOnError(result) as Pick<PlayerDeviceStateRow, 'device_id' | 'active_links'>[]

  for (const row of rows) {
    const other = row.device_id === device1 ? device2 : device1
    const links = (row.active_links ?? []).filter((l: string) => l !== other)
    await fromAny('player_device_state')
      .update({ active_links: links })
      .eq('player_id', player_id)
      .eq('device_id', row.device_id)
  }
}

// =================================
// 5. TWEAKS
// =================================

export async function getDeviceTweaks(device_id: string): Promise<DeviceTweak[]> {
  const result = await fromAny('device_tweaks')
    .select('*')
    .eq('device_id', device_id)
    .order('setting_id')
  const rows = throwOnError(result) as DeviceTweakRow[]
  return rows.map((r) => ({
    ...r,
    default_value: r.default_value ?? '',
    current_value: r.default_value ?? '',
    power_impact: r.power_impact ?? 0,
    description: r.description ?? '',
    options: r.options as unknown as TweakOption[] | undefined,
  }))
}

export async function getPlayerTweakSettings(
  player_id: string,
  device_id: string
): Promise<Record<string, string | number | boolean>> {
  const result = await fromAny('player_device_state')
    .select('tweak_settings')
    .eq('player_id', player_id)
    .eq('device_id', device_id)
    .single()
  const row = throwOnError(result) as Pick<PlayerDeviceStateRow, 'tweak_settings'>
  return (row.tweak_settings ?? {}) as Record<string, string | number | boolean>
}

export async function savePlayerTweakSettings(
  player_id: string,
  device_id: string,
  settings: Record<string, string | number | boolean>
): Promise<void> {
  const result = await fromAny('player_device_state')
    .update({ tweak_settings: settings })
    .eq('player_id', player_id)
    .eq('device_id', device_id)
  throwOnError(result)
}

export async function resetTweaksToDefault(
  player_id: string,
  device_id: string
): Promise<void> {
  const tweaks = await getDeviceTweaks(device_id)
  const defaults: Record<string, string | number | boolean> = {}
  for (const t of tweaks) {
    defaults[t.setting_id] = t.default_value
  }
  await savePlayerTweakSettings(player_id, device_id, defaults)
}

// =================================
// 6. AGGREGATIONS
// =================================

export async function getPowerSummary(player_id: string): Promise<DevicePowerSummary> {
  const playerResult = await fromAny('player_device_state')
    .select('device_id, current_state')
    .eq('player_id', player_id)
    .eq('unlocked', true)
  const playerDevices = throwOnError(playerResult) as Pick<PlayerDeviceStateRow, 'device_id' | 'current_state'>[]

  const stateResult = await fromAny('device_state').select('device_id, power_current')
  const states = throwOnError(stateResult) as Pick<DeviceStateRow, 'device_id' | 'power_current'>[]
  const powerByDevice = new Map(states.map((s) => [s.device_id, s.power_current]))

  const devicesResult = await fromAny('devices').select('device_id, category')
  const devices = throwOnError(devicesResult) as Pick<DeviceRow, 'device_id' | 'category'>[]
  const categoryByDevice = new Map(
    devices.map((d) => [d.device_id, d.category as DeviceCategory])
  )

  let totalGeneration = 0
  let totalConsumption = 0
  let countOnline = 0
  let countStandby = 0
  let countOffline = 0

  const byCategory: Record<string, { count: number; power: number }> = {
    generator: { count: 0, power: 0 },
    heavy: { count: 0, power: 0 },
    medium: { count: 0, power: 0 },
    light: { count: 0, power: 0 },
    storage: { count: 0, power: 0 },
  }

  for (const pd of playerDevices) {
    const power = powerByDevice.get(pd.device_id) ?? 0
    const cat = categoryByDevice.get(pd.device_id) ?? 'light'

    if (pd.current_state === 'online') countOnline++
    else if (pd.current_state === 'standby') countStandby++
    else countOffline++

    if (power > 0) totalGeneration += power
    else totalConsumption += Math.abs(power)

    byCategory[cat].count++
    byCategory[cat].power += power
  }

  const net = totalGeneration - totalConsumption
  const headroom = totalGeneration > 0 ? (net / totalGeneration) * 100 : 0

  return {
    total_generation: totalGeneration,
    total_consumption: totalConsumption,
    net_power: net,
    device_count_online: countOnline,
    device_count_standby: countStandby,
    device_count_offline: countOffline,
    headroom_percent: Math.round(headroom * 100) / 100,
    by_category: byCategory as DevicePowerSummary['by_category'],
  }
}

export async function getDeviceCountsByCategory(): Promise<Record<DeviceCategory, number>> {
  const result = await fromAny('devices').select('category')
  const rows = throwOnError(result) as Pick<DeviceRow, 'category'>[]
  const counts: Record<string, number> = {
    generator: 0,
    heavy: 0,
    medium: 0,
    light: 0,
    storage: 0,
  }
  for (const r of rows) {
    counts[r.category] = (counts[r.category] ?? 0) + 1
  }
  return counts as Record<DeviceCategory, number>
}

export async function getSystemHealth(): Promise<{
  online: number
  standby: number
  offline: number
  error: number
}> {
  const result = await fromAny('device_state').select('state')
  const rows = throwOnError(result) as Pick<DeviceStateRow, 'state'>[]
  const counts = { online: 0, standby: 0, offline: 0, error: 0 }
  for (const r of rows) {
    if (r.state in counts) counts[r.state as keyof typeof counts]++
  }
  return counts
}

// =================================
// 7. PLAYER STATE
// =================================

export async function getPlayerDevices(player_id: string): Promise<PlayerDeviceState[]> {
  const result = await fromAny('player_device_state')
    .select('*')
    .eq('player_id', player_id)
  const rows = throwOnError(result) as PlayerDeviceStateRow[]
  return rows.map((r) => ({
    ...r,
    tweak_settings: (r.tweak_settings ?? {}) as Record<string, string | number | boolean>,
    active_links: r.active_links ?? [],
  }))
}

export async function unlockDevice(player_id: string, device_id: string): Promise<void> {
  const result = await fromAny('player_device_state')
    .upsert(
      {
        player_id,
        device_id,
        unlocked: true,
        unlock_date: new Date().toISOString(),
        current_state: 'offline' as DeviceState,
        tweak_settings: {},
        active_links: [],
      },
      { onConflict: 'player_id,device_id' }
    )
  throwOnError(result)
}

export async function getUnlockedDevices(player_id: string): Promise<string[]> {
  const result = await fromAny('player_device_state')
    .select('device_id')
    .eq('player_id', player_id)
    .eq('unlocked', true)
  const rows = throwOnError(result) as Pick<PlayerDeviceStateRow, 'device_id'>[]
  return rows.map((r) => r.device_id)
}

// =================================
// REAL-TIME SUBSCRIPTIONS
// =================================

export function subscribeToDeviceState(
  device_id: string,
  callback: (state: DeviceRuntimeState) => void
): RealtimeChannel {
  return supabase()
    .channel(`device_state:${device_id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_state',
        filter: `device_id=eq.${device_id}`,
      },
      (payload) => callback(payload.new as DeviceRuntimeState)
    )
    .subscribe()
}

export function subscribeToAllDeviceStates(
  callback: (state: DeviceRuntimeState) => void
): RealtimeChannel {
  return supabase()
    .channel('device_state:all')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_state',
      },
      (payload) => callback(payload.new as DeviceRuntimeState)
    )
    .subscribe()
}

export function subscribeToPowerChanges(
  callback: (state: DeviceRuntimeState) => void
): RealtimeChannel {
  return supabase()
    .channel('device_state:power')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_state',
      },
      (payload) => {
        const prev = payload.old as Partial<DeviceRuntimeState>
        const next = payload.new as DeviceRuntimeState
        if (prev.power_current !== next.power_current || prev.state !== next.state) {
          callback(next)
        }
      }
    )
    .subscribe()
}
