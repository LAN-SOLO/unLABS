import { createClient } from '@/lib/supabase/client'
import type {
  DbPlayerDisplayPrefs,
  DbPlayerSoundPrefs,
  DbPlayerDatetimePrefs,
  DbPlayerNetworkPrefs,
  DbSystemConfigCache,
  DbUserSecurityPolicies,
  DbDisplayTheme,
  DbDisplayFont,
  DbSoundProfile,
  DbSysprefAuditLog,
  UpdateTables,
} from '@/types/database'
import type { SysprefAuditArea, SysprefArea } from '@/types/sysprefs'

// Helper: Supabase typed client sometimes can't resolve hand-maintained tables.
// We use typed params + runtime casts where needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createClient> & { from: any; rpc: any }

function client() {
  return createClient() as AnyClient
}

// =================================
// DISPLAY PREFERENCES
// =================================

export async function getDisplayPrefs(userId: string): Promise<DbPlayerDisplayPrefs> {
  const { data, error } = await client()
    .from('player_display_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerDisplayPrefs

  // Auto-create default row if missing
  const { data: created, error: insertErr } = await client()
    .from('player_display_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerDisplayPrefs
}

export async function updateDisplayPrefs(
  userId: string,
  prefs: UpdateTables<'player_display_prefs'>
): Promise<DbPlayerDisplayPrefs> {
  const { data, error } = await client()
    .from('player_display_prefs')
    .update(prefs)
    .eq('player_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as DbPlayerDisplayPrefs
}

// =================================
// SOUND PREFERENCES
// =================================

export async function getSoundPrefs(userId: string): Promise<DbPlayerSoundPrefs> {
  const { data, error } = await client()
    .from('player_sound_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerSoundPrefs

  const { data: created, error: insertErr } = await client()
    .from('player_sound_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerSoundPrefs
}

export async function updateSoundPrefs(
  userId: string,
  prefs: UpdateTables<'player_sound_prefs'>
): Promise<DbPlayerSoundPrefs> {
  const { data, error } = await client()
    .from('player_sound_prefs')
    .update(prefs)
    .eq('player_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as DbPlayerSoundPrefs
}

// =================================
// DATETIME PREFERENCES
// =================================

export async function getDatetimePrefs(userId: string): Promise<DbPlayerDatetimePrefs> {
  const { data, error } = await client()
    .from('player_datetime_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerDatetimePrefs

  const { data: created, error: insertErr } = await client()
    .from('player_datetime_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerDatetimePrefs
}

export async function updateDatetimePrefs(
  userId: string,
  prefs: UpdateTables<'player_datetime_prefs'>
): Promise<DbPlayerDatetimePrefs> {
  const { data, error } = await client()
    .from('player_datetime_prefs')
    .update(prefs)
    .eq('player_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as DbPlayerDatetimePrefs
}

// =================================
// NETWORK PREFERENCES
// =================================

export async function getNetworkPrefs(userId: string): Promise<DbPlayerNetworkPrefs> {
  const { data, error } = await client()
    .from('player_network_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerNetworkPrefs

  const { data: created, error: insertErr } = await client()
    .from('player_network_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerNetworkPrefs
}

export async function updateNetworkPrefs(
  userId: string,
  prefs: UpdateTables<'player_network_prefs'>
): Promise<DbPlayerNetworkPrefs> {
  const { data, error } = await client()
    .from('player_network_prefs')
    .update(prefs)
    .eq('player_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as DbPlayerNetworkPrefs
}

// =================================
// SYSTEM / REFERENCE DATA
// =================================

export async function getSystemConfig(): Promise<DbSystemConfigCache> {
  const { data, error } = await client()
    .from('system_config_cache')
    .select('*')
    .single()

  if (error) throw error
  return data as DbSystemConfigCache
}

export async function getSecurityPolicies(): Promise<DbUserSecurityPolicies> {
  const { data, error } = await client()
    .from('user_security_policies')
    .select('*')
    .single()

  if (error) throw error
  return data as DbUserSecurityPolicies
}

export async function getThemes(): Promise<DbDisplayTheme[]> {
  const { data, error } = await client()
    .from('display_themes')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data as DbDisplayTheme[]
}

export async function getFonts(): Promise<DbDisplayFont[]> {
  const { data, error } = await client()
    .from('display_fonts')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data as DbDisplayFont[]
}

export async function getSoundProfiles(): Promise<DbSoundProfile[]> {
  const { data, error } = await client()
    .from('sound_profiles')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data as DbSoundProfile[]
}

// =================================
// INITIALIZATION & RESET
// =================================

export async function initializePlayerPrefs(userId: string): Promise<void> {
  const { error } = await client().rpc('initialize_player_prefs', {
    p_player_id: userId,
  })

  if (error) throw error
}

export async function resetPlayerPrefs(userId: string, area?: SysprefArea): Promise<void> {
  const { error } = await client().rpc('reset_player_prefs', {
    p_player_id: userId,
    p_area: area ?? null,
  })

  if (error) throw error
}

// =================================
// AUDIT LOG
// =================================

export async function logPrefChange(
  playerId: string,
  area: SysprefAuditArea,
  settingKey: string,
  oldValue: string | null,
  newValue: string | null,
  changedBy?: string
): Promise<string> {
  const { data, error } = await client().rpc('log_pref_change', {
    p_player_id: playerId,
    p_area: area,
    p_key: settingKey,
    p_old_value: oldValue,
    p_new_value: newValue,
    p_changed_by: changedBy ?? null,
  })

  if (error) throw error
  return data as string
}

export async function getAuditLog(
  userId: string,
  options?: { area?: SysprefAuditArea; limit?: number; offset?: number }
): Promise<DbSysprefAuditLog[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = client()
    .from('syspref_audit_log')
    .select('*')
    .eq('player_id', userId)
    .order('changed_at', { ascending: false })

  if (options?.area) {
    query = query.eq('area', options.area)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)
  }

  const { data, error } = await query

  if (error) throw error
  return data as DbSysprefAuditLog[]
}
