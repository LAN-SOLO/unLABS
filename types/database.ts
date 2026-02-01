// UnstableLabs Database Types
// Generated from schema - update with: supabase gen types typescript

// =================================
// ENUMS
// =================================

export type CrystalColor =
  | 'infrared'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'gamma'

export type VolatilityTier = '1' | '2' | '3' | '4' | '5'

export type RotationDirection = 'CW' | 'CCW'

export type CrystalState = 'stable' | 'volatile' | 'hybrid'

export type CrystalEra = '8-bit' | '16-bit' | '32-bit' | '64-bit'

export type TransactionType =
  | 'mint'
  | 'burn'
  | 'transfer'
  | 'research'
  | 'reward'
  | 'fee'
  | 'stake'
  | 'unstake'
  | 'trade'

export type DeviceCategory = 'generator' | 'heavy' | 'medium' | 'light' | 'storage'

export type DeviceState = 'online' | 'standby' | 'offline' | 'error' | 'upgrading'

export type TweakType = 'radio' | 'toggle' | 'slider' | 'priority_list'

// =================================
// DATABASE INTERFACE
// =================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          total_unsc: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          total_unsc?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          total_unsc?: number
          created_at?: string
          updated_at?: string
        }
      }
      crystals: {
        Row: {
          id: string
          owner_id: string | null
          mint_address: string | null
          name: string
          color: CrystalColor
          volatility: VolatilityTier
          rotation: RotationDirection
          state: CrystalState
          era: CrystalEra
          is_genesis: boolean
          total_power: number
          slice_count: number
          minted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          mint_address?: string | null
          name: string
          color?: CrystalColor
          volatility?: VolatilityTier
          rotation?: RotationDirection
          state?: CrystalState
          era?: CrystalEra
          is_genesis?: boolean
          total_power?: number
          slice_count?: number
          minted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          mint_address?: string | null
          name?: string
          color?: CrystalColor
          volatility?: VolatilityTier
          rotation?: RotationDirection
          state?: CrystalState
          era?: CrystalEra
          is_genesis?: boolean
          total_power?: number
          slice_count?: number
          minted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      slices: {
        Row: {
          id: string
          crystal_id: string
          position: number
          power: number
          is_active: boolean
          hue: number | null
          saturation: number | null
          brightness: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          crystal_id: string
          position: number
          power?: number
          is_active?: boolean
          hue?: number | null
          saturation?: number | null
          brightness?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          crystal_id?: string
          position?: number
          power?: number
          is_active?: boolean
          hue?: number | null
          saturation?: number | null
          brightness?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tech_trees: {
        Row: {
          id: string
          name: string
          description: string | null
          category: string
          max_tier: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category: string
          max_tier?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: string
          max_tier?: number
          created_at?: string
        }
      }
      research_progress: {
        Row: {
          id: string
          user_id: string
          tech_tree_id: string
          current_tier: number
          experience: number
          experience_to_next: number
          unlocked_at: string
          last_researched_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tech_tree_id: string
          current_tier?: number
          experience?: number
          experience_to_next?: number
          unlocked_at?: string
          last_researched_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tech_tree_id?: string
          current_tier?: number
          experience?: number
          experience_to_next?: number
          unlocked_at?: string
          last_researched_at?: string | null
        }
      }
      balances: {
        Row: {
          id: string
          user_id: string
          available: number
          staked: number
          locked: number
          total_earned: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          available?: number
          staked?: number
          locked?: number
          total_earned?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          available?: number
          staked?: number
          locked?: number
          total_earned?: number
          total_spent?: number
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string | null
          type: TransactionType
          amount: number
          crystal_id: string | null
          tech_tree_id: string | null
          counterparty_id: string | null
          description: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          type: TransactionType
          amount: number
          crystal_id?: string | null
          tech_tree_id?: string | null
          counterparty_id?: string | null
          description?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: TransactionType
          amount?: number
          crystal_id?: string | null
          tech_tree_id?: string | null
          counterparty_id?: string | null
          description?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
      }
      command_history: {
        Row: {
          id: string
          user_id: string
          command: string
          args: string[] | null
          output: string | null
          success: boolean
          execution_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          command: string
          args?: string[] | null
          output?: string | null
          success?: boolean
          execution_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          command?: string
          args?: string[] | null
          output?: string | null
          success?: boolean
          execution_time_ms?: number | null
          created_at?: string
        }
      }
      volatility_snapshots: {
        Row: {
          id: string
          tps: number
          block_time_ms: number
          network: string
          calculated_tier: VolatilityTier
          captured_at: string
        }
        Insert: {
          id?: string
          tps: number
          block_time_ms: number
          network?: string
          calculated_tier: VolatilityTier
          captured_at?: string
        }
        Update: {
          id?: string
          tps?: number
          block_time_ms?: number
          network?: string
          calculated_tier?: VolatilityTier
          captured_at?: string
        }
      }
      devices: {
        Row: {
          device_id: string
          name: string
          version: string
          category: DeviceCategory
          tech_tree: string
          tier: number
          power_full: number
          power_idle: number
          power_standby: number
          description: string | null
          capabilities: string[]
        }
        Insert: {
          device_id: string
          name: string
          version: string
          category: DeviceCategory
          tech_tree: string
          tier: number
          power_full: number
          power_idle: number
          power_standby: number
          description?: string | null
          capabilities?: string[]
        }
        Update: {
          device_id?: string
          name?: string
          version?: string
          category?: DeviceCategory
          tech_tree?: string
          tier?: number
          power_full?: number
          power_idle?: number
          power_standby?: number
          description?: string | null
          capabilities?: string[]
        }
      }
      device_state: {
        Row: {
          device_id: string
          state: DeviceState
          health: number
          load: number
          uptime_seconds: number
          power_current: number
          temperature: number
          last_updated: string
        }
        Insert: {
          device_id: string
          state?: DeviceState
          health?: number
          load?: number
          uptime_seconds?: number
          power_current?: number
          temperature?: number
          last_updated?: string
        }
        Update: {
          device_id?: string
          state?: DeviceState
          health?: number
          load?: number
          uptime_seconds?: number
          power_current?: number
          temperature?: number
          last_updated?: string
        }
      }
      device_dependencies: {
        Row: {
          id: number
          device_id: string
          tech_tree: string
          tier: number
          item_name: string
          is_cross_tree: boolean
        }
        Insert: {
          id?: number
          device_id: string
          tech_tree: string
          tier: number
          item_name: string
          is_cross_tree?: boolean
        }
        Update: {
          id?: number
          device_id?: string
          tech_tree?: string
          tier?: number
          item_name?: string
          is_cross_tree?: boolean
        }
      }
      device_combinations: {
        Row: {
          combo_id: number
          primary_device: string
          secondary_device: string
          combo_name: string
          effect_description: string | null
          combined_power: number | null
          requirement_tree: string | null
          requirement_item: string | null
        }
        Insert: {
          combo_id?: number
          primary_device: string
          secondary_device: string
          combo_name: string
          effect_description?: string | null
          combined_power?: number | null
          requirement_tree?: string | null
          requirement_item?: string | null
        }
        Update: {
          combo_id?: number
          primary_device?: string
          secondary_device?: string
          combo_name?: string
          effect_description?: string | null
          combined_power?: number | null
          requirement_tree?: string | null
          requirement_item?: string | null
        }
      }
      device_tweaks: {
        Row: {
          tweak_id: number
          device_id: string
          setting_id: string
          setting_name: string
          setting_type: TweakType
          default_value: string | null
          power_impact: number | null
          description: string | null
          options: Record<string, unknown> | null
        }
        Insert: {
          tweak_id?: number
          device_id: string
          setting_id: string
          setting_name: string
          setting_type: TweakType
          default_value?: string | null
          power_impact?: number | null
          description?: string | null
          options?: Record<string, unknown> | null
        }
        Update: {
          tweak_id?: number
          device_id?: string
          setting_id?: string
          setting_name?: string
          setting_type?: TweakType
          default_value?: string | null
          power_impact?: number | null
          description?: string | null
          options?: Record<string, unknown> | null
        }
      }
      player_device_state: {
        Row: {
          player_id: string
          device_id: string
          unlocked: boolean
          unlock_date: string | null
          current_state: DeviceState
          tweak_settings: Record<string, unknown>
          active_links: string[] | null
        }
        Insert: {
          player_id: string
          device_id: string
          unlocked?: boolean
          unlock_date?: string | null
          current_state?: DeviceState
          tweak_settings?: Record<string, unknown>
          active_links?: string[] | null
        }
        Update: {
          player_id?: string
          device_id?: string
          unlocked?: boolean
          unlock_date?: string | null
          current_state?: DeviceState
          tweak_settings?: Record<string, unknown>
          active_links?: string[] | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      crystal_color: CrystalColor
      volatility_tier: VolatilityTier
      rotation_direction: RotationDirection
      crystal_state: CrystalState
      crystal_era: CrystalEra
      transaction_type: TransactionType
      device_category: DeviceCategory
      device_state: DeviceState
      tweak_type: TweakType
    }
  }
}

// =================================
// HELPER TYPES
// =================================

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Convenience aliases
export type Profile = Tables<'profiles'>
export type Crystal = Tables<'crystals'>
export type Slice = Tables<'slices'>
export type TechTree = Tables<'tech_trees'>
export type ResearchProgress = Tables<'research_progress'>
export type Balance = Tables<'balances'>
export type Transaction = Tables<'transactions'>
export type CommandHistory = Tables<'command_history'>
export type VolatilitySnapshot = Tables<'volatility_snapshots'>
export type DbDevice = Tables<'devices'>
export type DbDeviceState = Tables<'device_state'>
export type DbDeviceDependency = Tables<'device_dependencies'>
export type DbDeviceCombination = Tables<'device_combinations'>
export type DbDeviceTweak = Tables<'device_tweaks'>
export type DbPlayerDeviceState = Tables<'player_device_state'>

// Joined types
export type CrystalWithSlices = Crystal & {
  slices: Slice[]
}

export type ResearchWithTree = ResearchProgress & {
  tech_tree: TechTree
}

export type ProfileWithBalance = Profile & {
  balance: Balance | null
}
