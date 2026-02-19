'use server'

import { createClient } from '@/lib/supabase/server'
import type { AppRegistryEntry, PlayerAppView, LaunchSource } from '@/types/unapp'

// Helper: the new tables aren't in generated Supabase types yet,
// so we cast to `any` for .from() calls on unapp tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function db(): Promise<any> {
  return await createClient()
}

export async function fetchAppRegistry(): Promise<AppRegistryEntry[]> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('unapp_registry')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')

  if (error) {
    console.error('fetchAppRegistry error:', error)
    return []
  }
  return (data ?? []) as AppRegistryEntry[]
}

export async function fetchPlayerApps(): Promise<PlayerAppView[]> {
  const supabase = await db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase.rpc('get_player_apps', {
    p_player_id: user.id,
  })

  if (error) {
    console.error('fetchPlayerApps error:', error)
    return []
  }
  return (data ?? []) as PlayerAppView[]
}

export async function installApp(appId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: app, error: appErr } = await supabase
    .from('unapp_registry')
    .select('version')
    .eq('app_id', appId)
    .single()

  if (appErr || !app) return { success: false, error: `App ${appId} not found in registry` }

  const { error } = await supabase
    .from('player_apps')
    .insert({
      player_id: user.id,
      app_id: appId,
      installed_version: app.version,
      state: 'installed',
    })

  if (error) {
    if (error.code === '23505') return { success: false, error: `App ${appId} is already installed` }
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function removeApp(appId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('player_apps')
    .delete()
    .eq('player_id', user.id)
    .eq('app_id', appId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function toggleFavorite(appId: string): Promise<boolean> {
  const supabase = await db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase.rpc('toggle_app_favorite', {
    p_player_id: user.id,
    p_app_id: appId,
  })

  if (error) return false
  return data as boolean
}

export async function recordAppLaunch(appId: string, source: LaunchSource): Promise<void> {
  const supabase = await db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.rpc('record_app_launch', {
    p_player_id: user.id,
    p_app_id: appId,
    p_source: source,
  })
}

export async function fetchAppInfo(appId: string): Promise<AppRegistryEntry | null> {
  const supabase = await db()
  const { data, error } = await supabase
    .from('unapp_registry')
    .select('*')
    .eq('app_id', appId)
    .single()

  if (error) return null
  return data as AppRegistryEntry
}

export async function searchApps(term: string): Promise<AppRegistryEntry[]> {
  // SECURITY: Validate and sanitize search term
  if (!term || typeof term !== 'string') {
    return []
  }

  // Trim and limit length to prevent abuse
  const sanitized = term.trim().slice(0, 50)

  // Reject empty or wildcard-only searches
  if (sanitized.length === 0 || /^[%_]+$/.test(sanitized)) {
    return []
  }

  // Escape SQL LIKE special characters to prevent injection
  const escaped = sanitized
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')

  const supabase = await db()
  const { data, error } = await supabase
    .from('unapp_registry')
    .select('*')
    .eq('is_active', true)
    .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%,app_id.ilike.%${escaped}%`)
    .order('name')
    .limit(50) // Limit results to prevent large responses

  if (error) {
    console.error('searchApps error:', error)
    return []
  }
  return (data ?? []) as AppRegistryEntry[]
}
