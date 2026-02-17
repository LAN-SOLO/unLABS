'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  DbPlayerDisplayPrefs,
  DbPlayerSoundPrefs,
  DbPlayerDatetimePrefs,
  DbPlayerNetworkPrefs,
  DbSystemConfigCache,
  DbDisplayTheme,
  DbDisplayFont,
  DbSoundProfile,
  DbUserSecurityPolicies,
} from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = Awaited<ReturnType<typeof createClient>> & { from: any; rpc: any }

async function client() {
  return (await createClient()) as AnyClient
}

// =================================
// DISPLAY PREFERENCES
// =================================

export async function getDisplayPrefsServer(userId: string): Promise<DbPlayerDisplayPrefs> {
  const sb = await client()
  const { data, error } = await sb
    .from('player_display_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerDisplayPrefs

  const { data: created, error: insertErr } = await sb
    .from('player_display_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerDisplayPrefs
}

// =================================
// SOUND PREFERENCES
// =================================

export async function getSoundPrefsServer(userId: string): Promise<DbPlayerSoundPrefs> {
  const sb = await client()
  const { data, error } = await sb
    .from('player_sound_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerSoundPrefs

  const { data: created, error: insertErr } = await sb
    .from('player_sound_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerSoundPrefs
}

// =================================
// DATETIME PREFERENCES
// =================================

export async function getDatetimePrefsServer(userId: string): Promise<DbPlayerDatetimePrefs> {
  const sb = await client()
  const { data, error } = await sb
    .from('player_datetime_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerDatetimePrefs

  const { data: created, error: insertErr } = await sb
    .from('player_datetime_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerDatetimePrefs
}

// =================================
// NETWORK PREFERENCES
// =================================

export async function getNetworkPrefsServer(userId: string): Promise<DbPlayerNetworkPrefs> {
  const sb = await client()
  const { data, error } = await sb
    .from('player_network_prefs')
    .select('*')
    .eq('player_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data) return data as DbPlayerNetworkPrefs

  const { data: created, error: insertErr } = await sb
    .from('player_network_prefs')
    .insert({ player_id: userId })
    .select()
    .single()
  if (insertErr) throw insertErr
  return created as DbPlayerNetworkPrefs
}

// =================================
// SYSTEM / REFERENCE DATA
// =================================

export async function getSystemConfigServer(): Promise<DbSystemConfigCache> {
  const sb = await client()
  const { data, error } = await sb
    .from('system_config_cache')
    .select('*')
    .single()

  if (error) throw error
  return data as DbSystemConfigCache
}

export async function getThemesServer(): Promise<DbDisplayTheme[]> {
  const sb = await client()
  const { data, error } = await sb
    .from('display_themes')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data as DbDisplayTheme[]
}

export async function getFontsServer(): Promise<DbDisplayFont[]> {
  const sb = await client()
  const { data, error } = await sb
    .from('display_fonts')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data as DbDisplayFont[]
}

export async function getSoundProfilesServer(): Promise<DbSoundProfile[]> {
  const sb = await client()
  const { data, error } = await sb
    .from('sound_profiles')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data as DbSoundProfile[]
}

export async function getSecurityPoliciesServer(): Promise<DbUserSecurityPolicies> {
  const sb = await client()
  const { data, error } = await sb
    .from('user_security_policies')
    .select('*')
    .single()

  if (error) throw error
  return data as DbUserSecurityPolicies
}
