// ============================================================================
// unapp Application Manager Types
// ============================================================================

export type AppCategory = 'dev' | 'sys' | 'util'

export type AppState = 'installing' | 'installed' | 'running' | 'updating' | 'disabled' | 'error'

export type LaunchSource = 'unapp' | 'undev' | 'alias' | 'shortcut' | 'auto'

export interface AppRegistryEntry {
  app_id: string
  name: string
  description: string | null
  version: string
  category: AppCategory
  device_id: string | null
  tech_tree: string | null
  tier_required: number
  min_unos_version: string
  dependencies: string[]
  modules: string[]
  permissions: string[]
  auto_install: boolean
  size_kb: number
  author: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PlayerApp {
  id: string
  player_id: string
  app_id: string
  state: AppState
  installed_version: string
  installed_at: string
  last_launched_at: string | null
  total_launches: number
  total_runtime_seconds: number
  is_favorite: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface PlayerAppConfig {
  id: string
  player_id: string
  app_id: string
  config_key: string
  config_value: Record<string, unknown>
  preset_name: string | null
  is_active_preset: boolean
  created_at: string
  updated_at: string
}

export interface PlayerAppView {
  app_id: string
  app_name: string
  app_category: AppCategory
  device_id: string | null
  device_state: string
  app_state: AppState
  installed_version: string
  is_favorite: boolean
  total_launches: number
  last_launched_at: string | null
}

export interface UnappActions {
  fetchRegistry: () => Promise<AppRegistryEntry[]>
  fetchPlayerApps: () => Promise<PlayerAppView[]>
  installApp: (appId: string) => Promise<{ success: boolean; error?: string }>
  removeApp: (appId: string) => Promise<{ success: boolean; error?: string }>
  toggleFavorite: (appId: string) => Promise<boolean>
  recordLaunch: (appId: string, source: LaunchSource) => Promise<void>
  fetchAppInfo: (appId: string) => Promise<AppRegistryEntry | null>
  searchApps: (term: string) => Promise<AppRegistryEntry[]>
}
