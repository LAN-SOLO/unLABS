// Device Manager Type Definitions
// Application-layer interfaces extending database types

import type {
  DeviceCategory,
  DeviceState,
  TweakType,
  DbDevice as DeviceRow,
  DbDeviceState as DeviceStateRow,
  DbDeviceDependency as DeviceDependencyRow,
  DbDeviceCombination as DeviceCombinationRow,
  DbDeviceTweak as DeviceTweakRow,
  DbPlayerDeviceState as PlayerDeviceStateRow,
} from './database'

// Re-export DB enums for convenience
export type { DeviceCategory, DeviceState, TweakType }

// =================================
// DEPENDENCY STATUS (app-layer only)
// =================================

export type DependencyStatus = 'locked' | 'researching' | 'complete'

// =================================
// CORE INTERFACES
// =================================

/** Core device record from the devices table */
export interface Device {
  device_id: string
  name: string
  version: string
  category: DeviceCategory
  tech_tree: string
  tier: number
  power_full: number
  power_idle: number
  power_standby: number
  description: string
  capabilities: string[]
}

/** Real-time device state */
export interface DeviceRuntimeState {
  device_id: string
  state: DeviceState
  health: number
  load: number
  uptime_seconds: number
  power_current: number
  temperature: number | null
  last_updated: string
}

/** Tech tree prerequisite with resolved status */
export interface DeviceDependency {
  device_id: string
  tech_tree: string
  tier: number
  item_name: string
  is_cross_tree: boolean
  status: DependencyStatus
}

/** Synergy configuration with runtime flags */
export interface DeviceCombination {
  combo_id: number
  primary_device: string
  secondary_device: string
  combo_name: string
  effect_description: string
  combined_power: number
  requirement_tree: string | null
  requirement_item: string | null
  is_unlocked: boolean
  is_active: boolean
}

/** Tweak option entry for radio/priority_list types */
export interface TweakOption {
  value: string
  label: string
  power_delta: number
}

/** Device configuration setting with current value */
export interface DeviceTweak {
  tweak_id: number
  device_id: string
  setting_id: string
  setting_name: string
  setting_type: TweakType
  default_value: string | number | boolean
  current_value: string | number | boolean
  power_impact: number
  description: string
  options?: TweakOption[]
}

/** Per-player device ownership and configuration */
export interface PlayerDeviceState {
  player_id: string
  device_id: string
  unlocked: boolean
  unlock_date: string | null
  current_state: DeviceState
  tweak_settings: Record<string, string | number | boolean>
  active_links: string[]
}

// =================================
// COMPOSITE / UTILITY TYPES
// =================================

/** Device merged with its runtime state */
export type DeviceWithState = Device & DeviceRuntimeState

/** Full device detail view (device panel) */
export interface DeviceDetailView {
  device: Device
  state: DeviceRuntimeState
  player: PlayerDeviceState | null
  dependencies: DeviceDependency[]
  combinations: DeviceCombination[]
  tweaks: DeviceTweak[]
}

/** Minimal device data for list/grid rendering */
export interface DeviceListItem {
  device_id: string
  name: string
  category: DeviceCategory
  tier: number
  state: DeviceState
  health: number
  power_current: number
  unlocked: boolean
}

/** Aggregated power statistics for the power dashboard */
export interface DevicePowerSummary {
  total_generation: number
  total_consumption: number
  net_power: number
  device_count_online: number
  device_count_standby: number
  device_count_offline: number
  headroom_percent: number
  by_category: Record<DeviceCategory, {
    count: number
    power: number
  }>
}

// =================================
// DB ROW TYPE RE-EXPORTS
// =================================

export type {
  DeviceRow,
  DeviceStateRow,
  DeviceDependencyRow,
  DeviceCombinationRow,
  DeviceTweakRow,
  PlayerDeviceStateRow,
}
