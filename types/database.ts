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
      player_display_prefs: {
        Row: {
          id: string
          player_id: string
          theme: string
          primary_color: string
          secondary_color: string
          background_color: string
          effect_scanlines: boolean
          effect_curvature: boolean
          effect_flicker: boolean
          effect_glow_intensity: number
          effect_glitch: boolean
          effect_matrix_rain: boolean
          font_family: string
          font_size: number
          line_spacing: number
          letter_spacing: number
          terminal_columns: number
          terminal_rows: number
          prompt_style: string
          cursor_style: string
          cursor_blink: boolean
          plain_mode: boolean
          high_contrast: boolean
          large_text: boolean
          reduced_motion: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          theme?: string
          primary_color?: string
          secondary_color?: string
          background_color?: string
          effect_scanlines?: boolean
          effect_curvature?: boolean
          effect_flicker?: boolean
          effect_glow_intensity?: number
          effect_glitch?: boolean
          effect_matrix_rain?: boolean
          font_family?: string
          font_size?: number
          line_spacing?: number
          letter_spacing?: number
          terminal_columns?: number
          terminal_rows?: number
          prompt_style?: string
          cursor_style?: string
          cursor_blink?: boolean
          plain_mode?: boolean
          high_contrast?: boolean
          large_text?: boolean
          reduced_motion?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          theme?: string
          primary_color?: string
          secondary_color?: string
          background_color?: string
          effect_scanlines?: boolean
          effect_curvature?: boolean
          effect_flicker?: boolean
          effect_glow_intensity?: number
          effect_glitch?: boolean
          effect_matrix_rain?: boolean
          font_family?: string
          font_size?: number
          line_spacing?: number
          letter_spacing?: number
          terminal_columns?: number
          terminal_rows?: number
          prompt_style?: string
          cursor_style?: string
          cursor_blink?: boolean
          plain_mode?: boolean
          high_contrast?: boolean
          large_text?: boolean
          reduced_motion?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      player_sound_prefs: {
        Row: {
          id: string
          player_id: string
          master_volume: number
          muted: boolean
          sound_profile: string
          terminal_clicks: boolean
          terminal_clicks_volume: number
          command_beeps: boolean
          command_beeps_volume: number
          error_buzzer: boolean
          error_buzzer_volume: number
          success_chime: boolean
          success_chime_volume: number
          tab_complete_sound: boolean
          tab_complete_volume: number
          background_hum: boolean
          background_hum_volume: number
          idle_static: boolean
          idle_static_volume: number
          device_whir: boolean
          device_whir_volume: number
          quantum_whisper: boolean
          quantum_whisper_volume: number
          notification_research_complete: boolean
          notification_trade_accepted: boolean
          notification_volatility_alert: boolean
          notification_quest_complete: boolean
          notification_volume: number
          voice_alerts: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          master_volume?: number
          muted?: boolean
          sound_profile?: string
          terminal_clicks?: boolean
          terminal_clicks_volume?: number
          command_beeps?: boolean
          command_beeps_volume?: number
          error_buzzer?: boolean
          error_buzzer_volume?: number
          success_chime?: boolean
          success_chime_volume?: number
          tab_complete_sound?: boolean
          tab_complete_volume?: number
          background_hum?: boolean
          background_hum_volume?: number
          idle_static?: boolean
          idle_static_volume?: number
          device_whir?: boolean
          device_whir_volume?: number
          quantum_whisper?: boolean
          quantum_whisper_volume?: number
          notification_research_complete?: boolean
          notification_trade_accepted?: boolean
          notification_volatility_alert?: boolean
          notification_quest_complete?: boolean
          notification_volume?: number
          voice_alerts?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          master_volume?: number
          muted?: boolean
          sound_profile?: string
          terminal_clicks?: boolean
          terminal_clicks_volume?: number
          command_beeps?: boolean
          command_beeps_volume?: number
          error_buzzer?: boolean
          error_buzzer_volume?: number
          success_chime?: boolean
          success_chime_volume?: number
          tab_complete_sound?: boolean
          tab_complete_volume?: number
          background_hum?: boolean
          background_hum_volume?: number
          idle_static?: boolean
          idle_static_volume?: number
          device_whir?: boolean
          device_whir_volume?: number
          quantum_whisper?: boolean
          quantum_whisper_volume?: number
          notification_research_complete?: boolean
          notification_trade_accepted?: boolean
          notification_volatility_alert?: boolean
          notification_quest_complete?: boolean
          notification_volume?: number
          voice_alerts?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      player_datetime_prefs: {
        Row: {
          id: string
          player_id: string
          timezone: string
          time_format: string
          show_seconds: boolean
          show_milliseconds: boolean
          date_format: string
          first_day_of_week: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          timezone?: string
          time_format?: string
          show_seconds?: boolean
          show_milliseconds?: boolean
          date_format?: string
          first_day_of_week?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          timezone?: string
          time_format?: string
          show_seconds?: boolean
          show_milliseconds?: boolean
          date_format?: string
          first_day_of_week?: string
          created_at?: string
          updated_at?: string
        }
      }
      player_network_prefs: {
        Row: {
          id: string
          player_id: string
          auto_reconnect: boolean
          ping_interval_seconds: number
          preferred_region: string | null
          connection_quality: string
          notify_connection_lost: boolean
          notify_server_restart: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          auto_reconnect?: boolean
          ping_interval_seconds?: number
          preferred_region?: string | null
          connection_quality?: string
          notify_connection_lost?: boolean
          notify_server_restart?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          auto_reconnect?: boolean
          ping_interval_seconds?: number
          preferred_region?: string | null
          connection_quality?: string
          notify_connection_lost?: boolean
          notify_server_restart?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      system_config_cache: {
        Row: {
          id: string
          os_version: string
          os_codename: string
          os_build: string
          kernel_version: string
          cpu_model: string
          cpu_cores: number
          memory_total_gb: number
          storage_slots_total: number
          hostname: string
          ntp_enabled: boolean
          ntp_servers: string[]
          ntp_interval_seconds: number
          last_ntp_sync: string | null
          dns_servers: string[]
          dns_search_domain: string | null
          firewall_enabled: boolean
          firewall_default_incoming: string
          firewall_default_outgoing: string
          firewall_allowed_ports: string[]
          game_server_url: string
          blockchain_proxy_url: string
          oracle_feed_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          os_version: string
          os_codename: string
          os_build: string
          kernel_version: string
          cpu_model: string
          cpu_cores: number
          memory_total_gb: number
          storage_slots_total: number
          hostname?: string
          ntp_enabled?: boolean
          ntp_servers?: string[]
          ntp_interval_seconds?: number
          last_ntp_sync?: string | null
          dns_servers?: string[]
          dns_search_domain?: string | null
          firewall_enabled?: boolean
          firewall_default_incoming?: string
          firewall_default_outgoing?: string
          firewall_allowed_ports?: string[]
          game_server_url?: string
          blockchain_proxy_url?: string
          oracle_feed_url?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          os_version?: string
          os_codename?: string
          os_build?: string
          kernel_version?: string
          cpu_model?: string
          cpu_cores?: number
          memory_total_gb?: number
          storage_slots_total?: number
          hostname?: string
          ntp_enabled?: boolean
          ntp_servers?: string[]
          ntp_interval_seconds?: number
          last_ntp_sync?: string | null
          dns_servers?: string[]
          dns_search_domain?: string | null
          firewall_enabled?: boolean
          firewall_default_incoming?: string
          firewall_default_outgoing?: string
          firewall_allowed_ports?: string[]
          game_server_url?: string
          blockchain_proxy_url?: string
          oracle_feed_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      syspref_audit_log: {
        Row: {
          id: string
          player_id: string | null
          area: string
          setting_key: string
          old_value: string | null
          new_value: string | null
          changed_by: string | null
          change_reason: string | null
          ip_address: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          player_id?: string | null
          area: string
          setting_key: string
          old_value?: string | null
          new_value?: string | null
          changed_by?: string | null
          change_reason?: string | null
          ip_address?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          player_id?: string | null
          area?: string
          setting_key?: string
          old_value?: string | null
          new_value?: string | null
          changed_by?: string | null
          change_reason?: string | null
          ip_address?: string | null
          changed_at?: string
        }
      }
      user_security_policies: {
        Row: {
          id: string
          min_password_length: number
          require_special_char: boolean
          require_uppercase: boolean
          require_number: boolean
          password_expiry_days: number | null
          max_login_attempts: number
          lockout_duration_seconds: number
          session_timeout_seconds: number
          max_concurrent_sessions: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          min_password_length?: number
          require_special_char?: boolean
          require_uppercase?: boolean
          require_number?: boolean
          password_expiry_days?: number | null
          max_login_attempts?: number
          lockout_duration_seconds?: number
          session_timeout_seconds?: number
          max_concurrent_sessions?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          min_password_length?: number
          require_special_char?: boolean
          require_uppercase?: boolean
          require_number?: boolean
          password_expiry_days?: number | null
          max_login_attempts?: number
          lockout_duration_seconds?: number
          session_timeout_seconds?: number
          max_concurrent_sessions?: number
          created_at?: string
          updated_at?: string
        }
      }
      display_themes: {
        Row: {
          id: string
          name: string
          primary_color: string
          secondary_color: string
          background_color: string
          description: string | null
          is_default: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id: string
          name: string
          primary_color: string
          secondary_color: string
          background_color: string
          description?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          primary_color?: string
          secondary_color?: string
          background_color?: string
          description?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      display_fonts: {
        Row: {
          id: string
          name: string
          style: string
          license: string
          css_import_url: string | null
          is_default: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id: string
          name: string
          style: string
          license: string
          css_import_url?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          style?: string
          license?: string
          css_import_url?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      sound_profiles: {
        Row: {
          id: string
          name: string
          description: string | null
          settings: Record<string, unknown>
          is_default: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          settings: Record<string, unknown>
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          settings?: Record<string, unknown>
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
      }
    }
    Views: {
      player_all_prefs: {
        Row: {
          player_id: string
          username: string | null
          theme: string | null
          primary_color: string | null
          effect_scanlines: boolean | null
          effect_curvature: boolean | null
          font_family: string | null
          font_size: number | null
          plain_mode: boolean | null
          master_volume: number | null
          muted: boolean | null
          sound_profile: string | null
          terminal_clicks: boolean | null
          background_hum: boolean | null
          timezone: string | null
          time_format: string | null
          date_format: string | null
          auto_reconnect: boolean | null
          preferred_region: string | null
        }
      }
    }
    Functions: {
      initialize_player_prefs: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      log_pref_change: {
        Args: {
          p_player_id: string
          p_area: string
          p_key: string
          p_old_value: string | null
          p_new_value: string | null
          p_changed_by?: string | null
        }
        Returns: string
      }
      reset_player_prefs: {
        Args: {
          p_player_id: string
          p_area?: string | null
        }
        Returns: undefined
      }
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
export type DbPlayerDisplayPrefs = Tables<'player_display_prefs'>
export type DbPlayerSoundPrefs = Tables<'player_sound_prefs'>
export type DbPlayerDatetimePrefs = Tables<'player_datetime_prefs'>
export type DbPlayerNetworkPrefs = Tables<'player_network_prefs'>
export type DbSystemConfigCache = Tables<'system_config_cache'>
export type DbSysprefAuditLog = Tables<'syspref_audit_log'>
export type DbUserSecurityPolicies = Tables<'user_security_policies'>
export type DbDisplayTheme = Tables<'display_themes'>
export type DbDisplayFont = Tables<'display_fonts'>
export type DbSoundProfile = Tables<'sound_profiles'>

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
