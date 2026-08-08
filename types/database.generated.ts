export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      abstractum_sources: {
        Row: {
          activated_at: string | null;
          active: boolean | null;
          player_id: string;
          rate_per_minute: number;
          source_id: string;
          source_type: string;
        };
        Insert: {
          activated_at?: string | null;
          active?: boolean | null;
          player_id: string;
          rate_per_minute?: number;
          source_id: string;
          source_type: string;
        };
        Update: {
          activated_at?: string | null;
          active?: boolean | null;
          player_id?: string;
          rate_per_minute?: number;
          source_id?: string;
          source_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "abstractum_sources_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "abstractum_sources_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      achievement_progress: {
        Row: {
          achievement_id: string;
          progress: number;
          target: number;
          tier: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          progress?: number;
          target: number;
          tier: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          progress?: number;
          target?: number;
          tier?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievement_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "achievement_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      achievement_unlocks: {
        Row: {
          achievement_id: string;
          claimed_at: string | null;
          reward_claimed: boolean;
          tier: number;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          achievement_id: string;
          claimed_at?: string | null;
          reward_claimed?: boolean;
          tier: number;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_id?: string;
          claimed_at?: string | null;
          reward_claimed?: boolean;
          tier?: number;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievement_unlocks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "achievement_unlocks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          created_at: string;
          id: string;
          ip_address: unknown;
          new_data: Json | null;
          old_data: Json | null;
          operation: string;
          record_id: string | null;
          table_name: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          operation: string;
          record_id?: string | null;
          table_name: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          operation?: string;
          record_id?: string | null;
          table_name?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      balances: {
        Row: {
          available: number;
          id: string;
          locked: number;
          staked: number;
          total_earned: number;
          total_spent: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          available?: number;
          id?: string;
          locked?: number;
          staked?: number;
          total_earned?: number;
          total_spent?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          available?: number;
          id?: string;
          locked?: number;
          staked?: number;
          total_earned?: number;
          total_spent?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "balances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "balances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bootstrap_state: {
        Row: {
          cold_start_completed_at: string | null;
          cold_start_phase: number | null;
          cold_start_started_at: string | null;
          created_at: string | null;
          full_os_restored: boolean | null;
          player_id: string;
          residual_cell_discharged: boolean | null;
          residual_cell_energy: number | null;
          seep_collector_active: boolean | null;
          seep_collector_contents: number | null;
          updated_at: string | null;
        };
        Insert: {
          cold_start_completed_at?: string | null;
          cold_start_phase?: number | null;
          cold_start_started_at?: string | null;
          created_at?: string | null;
          full_os_restored?: boolean | null;
          player_id: string;
          residual_cell_discharged?: boolean | null;
          residual_cell_energy?: number | null;
          seep_collector_active?: boolean | null;
          seep_collector_contents?: number | null;
          updated_at?: string | null;
        };
        Update: {
          cold_start_completed_at?: string | null;
          cold_start_phase?: number | null;
          cold_start_started_at?: string | null;
          created_at?: string | null;
          full_os_restored?: boolean | null;
          player_id?: string;
          residual_cell_discharged?: boolean | null;
          residual_cell_energy?: number | null;
          seep_collector_active?: boolean | null;
          seep_collector_contents?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bootstrap_state_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "bootstrap_state_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      command_history: {
        Row: {
          args: string[] | null;
          command: string;
          created_at: string;
          execution_time_ms: number | null;
          id: string;
          output: string | null;
          success: boolean;
          user_id: string;
        };
        Insert: {
          args?: string[] | null;
          command: string;
          created_at?: string;
          execution_time_ms?: number | null;
          id?: string;
          output?: string | null;
          success?: boolean;
          user_id: string;
        };
        Update: {
          args?: string[] | null;
          command?: string;
          created_at?: string;
          execution_time_ms?: number | null;
          id?: string;
          output?: string | null;
          success?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "command_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "command_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      container_definitions: {
        Row: {
          auto_created_with: string | null;
          base_capacity: number;
          container_type_id: string;
          created_at: string | null;
          description: string | null;
          is_bootstrap: boolean | null;
          name: string;
          replaces: string | null;
          resource_type: string;
          tier: number;
          upgrade_material: string | null;
        };
        Insert: {
          auto_created_with?: string | null;
          base_capacity: number;
          container_type_id: string;
          created_at?: string | null;
          description?: string | null;
          is_bootstrap?: boolean | null;
          name: string;
          replaces?: string | null;
          resource_type: string;
          tier?: number;
          upgrade_material?: string | null;
        };
        Update: {
          auto_created_with?: string | null;
          base_capacity?: number;
          container_type_id?: string;
          created_at?: string | null;
          description?: string | null;
          is_bootstrap?: boolean | null;
          name?: string;
          replaces?: string | null;
          resource_type?: string;
          tier?: number;
          upgrade_material?: string | null;
        };
        Relationships: [];
      };
      container_upgrades: {
        Row: {
          container_id: string;
          from_level: number;
          material_cost: Json;
          player_id: string;
          to_level: number;
          unsc_cost: number;
          upgrade_id: string;
          upgraded_at: string | null;
        };
        Insert: {
          container_id: string;
          from_level: number;
          material_cost: Json;
          player_id: string;
          to_level: number;
          unsc_cost: number;
          upgrade_id?: string;
          upgraded_at?: string | null;
        };
        Update: {
          container_id?: string;
          from_level?: number;
          material_cost?: Json;
          player_id?: string;
          to_level?: number;
          unsc_cost?: number;
          upgrade_id?: string;
          upgraded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "container_upgrades_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "container_upgrades_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      crystals: {
        Row: {
          color: Database["public"]["Enums"]["crystal_color"];
          created_at: string;
          era: Database["public"]["Enums"]["crystal_era"];
          id: string;
          is_genesis: boolean;
          mint_address: string | null;
          minted_at: string | null;
          name: string;
          owner_id: string | null;
          rotation: Database["public"]["Enums"]["rotation_direction"];
          slice_count: number;
          state: Database["public"]["Enums"]["crystal_state"];
          total_power: number;
          updated_at: string;
          volatility: Database["public"]["Enums"]["volatility_tier"];
        };
        Insert: {
          color?: Database["public"]["Enums"]["crystal_color"];
          created_at?: string;
          era?: Database["public"]["Enums"]["crystal_era"];
          id?: string;
          is_genesis?: boolean;
          mint_address?: string | null;
          minted_at?: string | null;
          name: string;
          owner_id?: string | null;
          rotation?: Database["public"]["Enums"]["rotation_direction"];
          slice_count?: number;
          state?: Database["public"]["Enums"]["crystal_state"];
          total_power?: number;
          updated_at?: string;
          volatility?: Database["public"]["Enums"]["volatility_tier"];
        };
        Update: {
          color?: Database["public"]["Enums"]["crystal_color"];
          created_at?: string;
          era?: Database["public"]["Enums"]["crystal_era"];
          id?: string;
          is_genesis?: boolean;
          mint_address?: string | null;
          minted_at?: string | null;
          name?: string;
          owner_id?: string | null;
          rotation?: Database["public"]["Enums"]["rotation_direction"];
          slice_count?: number;
          state?: Database["public"]["Enums"]["crystal_state"];
          total_power?: number;
          updated_at?: string;
          volatility?: Database["public"]["Enums"]["volatility_tier"];
        };
        Relationships: [
          {
            foreignKeyName: "crystals_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "crystals_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      device_combinations: {
        Row: {
          combined_power: number | null;
          combo_id: number;
          combo_name: string;
          effect_description: string | null;
          primary_device: string;
          requirement_item: string | null;
          requirement_tree: string | null;
          secondary_device: string;
        };
        Insert: {
          combined_power?: number | null;
          combo_id?: number;
          combo_name: string;
          effect_description?: string | null;
          primary_device: string;
          requirement_item?: string | null;
          requirement_tree?: string | null;
          secondary_device: string;
        };
        Update: {
          combined_power?: number | null;
          combo_id?: number;
          combo_name?: string;
          effect_description?: string | null;
          primary_device?: string;
          requirement_item?: string | null;
          requirement_tree?: string | null;
          secondary_device?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_combinations_primary_device_fkey";
            columns: ["primary_device"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
          {
            foreignKeyName: "device_combinations_secondary_device_fkey";
            columns: ["secondary_device"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
      };
      device_dependencies: {
        Row: {
          device_id: string;
          id: number;
          is_cross_tree: boolean;
          item_name: string;
          tech_tree: string;
          tier: number;
        };
        Insert: {
          device_id: string;
          id?: number;
          is_cross_tree?: boolean;
          item_name: string;
          tech_tree: string;
          tier: number;
        };
        Update: {
          device_id?: string;
          id?: number;
          is_cross_tree?: boolean;
          item_name?: string;
          tech_tree?: string;
          tier?: number;
        };
        Relationships: [
          {
            foreignKeyName: "device_dependencies_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
      };
      device_firmware: {
        Row: {
          build_tag: string | null;
          changelog: string | null;
          checksum: string | null;
          created_at: string;
          device_id: string;
          id: string;
          is_latest: boolean;
          is_stable: boolean;
          min_tier: number | null;
          release_date: string;
          requires_reboot: boolean | null;
          size_kb: number | null;
          version: string;
        };
        Insert: {
          build_tag?: string | null;
          changelog?: string | null;
          checksum?: string | null;
          created_at?: string;
          device_id: string;
          id?: string;
          is_latest?: boolean;
          is_stable?: boolean;
          min_tier?: number | null;
          release_date: string;
          requires_reboot?: boolean | null;
          size_kb?: number | null;
          version: string;
        };
        Update: {
          build_tag?: string | null;
          changelog?: string | null;
          checksum?: string | null;
          created_at?: string;
          device_id?: string;
          id?: string;
          is_latest?: boolean;
          is_stable?: boolean;
          min_tier?: number | null;
          release_date?: string;
          requires_reboot?: boolean | null;
          size_kb?: number | null;
          version?: string;
        };
        Relationships: [];
      };
      device_state: {
        Row: {
          device_id: string;
          health: number;
          last_updated: string;
          load: number;
          power_current: number;
          state: Database["public"]["Enums"]["device_status"];
          temperature: number;
          uptime_seconds: number;
        };
        Insert: {
          device_id: string;
          health?: number;
          last_updated?: string;
          load?: number;
          power_current?: number;
          state?: Database["public"]["Enums"]["device_status"];
          temperature?: number;
          uptime_seconds?: number;
        };
        Update: {
          device_id?: string;
          health?: number;
          last_updated?: string;
          load?: number;
          power_current?: number;
          state?: Database["public"]["Enums"]["device_status"];
          temperature?: number;
          uptime_seconds?: number;
        };
        Relationships: [
          {
            foreignKeyName: "device_state_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: true;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
      };
      device_tweaks: {
        Row: {
          default_value: string | null;
          description: string | null;
          device_id: string;
          options: Json | null;
          power_impact: number | null;
          setting_id: string;
          setting_name: string;
          setting_type: Database["public"]["Enums"]["tweak_type"];
          tweak_id: number;
        };
        Insert: {
          default_value?: string | null;
          description?: string | null;
          device_id: string;
          options?: Json | null;
          power_impact?: number | null;
          setting_id: string;
          setting_name: string;
          setting_type: Database["public"]["Enums"]["tweak_type"];
          tweak_id?: number;
        };
        Update: {
          default_value?: string | null;
          description?: string | null;
          device_id?: string;
          options?: Json | null;
          power_impact?: number | null;
          setting_id?: string;
          setting_name?: string;
          setting_type?: Database["public"]["Enums"]["tweak_type"];
          tweak_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "device_tweaks_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
      };
      devices: {
        Row: {
          capabilities: Json | null;
          category: Database["public"]["Enums"]["device_category"];
          description: string | null;
          device_id: string;
          name: string;
          power_full: number;
          power_idle: number;
          power_standby: number;
          tech_tree: string;
          tier: number;
          version: string;
        };
        Insert: {
          capabilities?: Json | null;
          category: Database["public"]["Enums"]["device_category"];
          description?: string | null;
          device_id: string;
          name: string;
          power_full: number;
          power_idle: number;
          power_standby: number;
          tech_tree: string;
          tier: number;
          version: string;
        };
        Update: {
          capabilities?: Json | null;
          category?: Database["public"]["Enums"]["device_category"];
          description?: string | null;
          device_id?: string;
          name?: string;
          power_full?: number;
          power_idle?: number;
          power_standby?: number;
          tech_tree?: string;
          tier?: number;
          version?: string;
        };
        Relationships: [];
      };
      display_fonts: {
        Row: {
          created_at: string;
          css_import_url: string | null;
          id: string;
          is_default: boolean;
          license: string;
          name: string;
          sort_order: number;
          style: string;
        };
        Insert: {
          created_at?: string;
          css_import_url?: string | null;
          id: string;
          is_default?: boolean;
          license: string;
          name: string;
          sort_order?: number;
          style: string;
        };
        Update: {
          created_at?: string;
          css_import_url?: string | null;
          id?: string;
          is_default?: boolean;
          license?: string;
          name?: string;
          sort_order?: number;
          style?: string;
        };
        Relationships: [];
      };
      display_themes: {
        Row: {
          background_color: string;
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          primary_color: string;
          secondary_color: string;
          sort_order: number;
        };
        Insert: {
          background_color: string;
          created_at?: string;
          description?: string | null;
          id: string;
          is_default?: boolean;
          name: string;
          primary_color: string;
          secondary_color: string;
          sort_order?: number;
        };
        Update: {
          background_color?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          primary_color?: string;
          secondary_color?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      pack_purchases: {
        Row: {
          bonus_items_granted: Json | null;
          pack_id: string;
          player_id: string;
          purchase_id: string;
          purchased_at: string | null;
          slices_minted: Json;
          sol_amount: number | null;
          tx_signature: string | null;
          unsc_burned: number;
          unsc_minted: number;
        };
        Insert: {
          bonus_items_granted?: Json | null;
          pack_id: string;
          player_id: string;
          purchase_id?: string;
          purchased_at?: string | null;
          slices_minted?: Json;
          sol_amount?: number | null;
          tx_signature?: string | null;
          unsc_burned: number;
          unsc_minted: number;
        };
        Update: {
          bonus_items_granted?: Json | null;
          pack_id?: string;
          player_id?: string;
          purchase_id?: string;
          purchased_at?: string | null;
          slices_minted?: Json;
          sol_amount?: number | null;
          tx_signature?: string | null;
          unsc_burned?: number;
          unsc_minted?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pack_purchases_pack_id_fkey";
            columns: ["pack_id"];
            isOneToOne: false;
            referencedRelation: "starter_packs";
            referencedColumns: ["pack_id"];
          },
          {
            foreignKeyName: "pack_purchases_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "pack_purchases_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_app_config: {
        Row: {
          app_id: string;
          config_key: string;
          config_value: Json;
          created_at: string;
          id: string;
          is_active_preset: boolean | null;
          player_id: string;
          preset_name: string | null;
          updated_at: string;
        };
        Insert: {
          app_id: string;
          config_key: string;
          config_value?: Json;
          created_at?: string;
          id?: string;
          is_active_preset?: boolean | null;
          player_id: string;
          preset_name?: string | null;
          updated_at?: string;
        };
        Update: {
          app_id?: string;
          config_key?: string;
          config_value?: Json;
          created_at?: string;
          id?: string;
          is_active_preset?: boolean | null;
          player_id?: string;
          preset_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_app_config_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "unapp_registry";
            referencedColumns: ["app_id"];
          },
          {
            foreignKeyName: "player_app_config_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_app_config_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_apps: {
        Row: {
          app_id: string;
          created_at: string;
          display_order: number | null;
          id: string;
          installed_at: string;
          installed_version: string;
          is_favorite: boolean;
          last_launched_at: string | null;
          player_id: string;
          state: string;
          total_launches: number;
          total_runtime_seconds: number;
          updated_at: string;
        };
        Insert: {
          app_id: string;
          created_at?: string;
          display_order?: number | null;
          id?: string;
          installed_at?: string;
          installed_version: string;
          is_favorite?: boolean;
          last_launched_at?: string | null;
          player_id: string;
          state?: string;
          total_launches?: number;
          total_runtime_seconds?: number;
          updated_at?: string;
        };
        Update: {
          app_id?: string;
          created_at?: string;
          display_order?: number | null;
          id?: string;
          installed_at?: string;
          installed_version?: string;
          is_favorite?: boolean;
          last_launched_at?: string | null;
          player_id?: string;
          state?: string;
          total_launches?: number;
          total_runtime_seconds?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_apps_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "unapp_registry";
            referencedColumns: ["app_id"];
          },
          {
            foreignKeyName: "player_apps_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_apps_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_datetime_prefs: {
        Row: {
          created_at: string;
          date_format: string;
          first_day_of_week: string;
          id: string;
          player_id: string;
          show_milliseconds: boolean;
          show_seconds: boolean;
          time_format: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date_format?: string;
          first_day_of_week?: string;
          id?: string;
          player_id: string;
          show_milliseconds?: boolean;
          show_seconds?: boolean;
          time_format?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_format?: string;
          first_day_of_week?: string;
          id?: string;
          player_id?: string;
          show_milliseconds?: boolean;
          show_seconds?: boolean;
          time_format?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_datetime_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_datetime_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_device_state: {
        Row: {
          active_links: string[] | null;
          current_state: Database["public"]["Enums"]["device_status"];
          device_id: string;
          player_id: string;
          tweak_settings: Json;
          unlock_date: string | null;
          unlocked: boolean;
        };
        Insert: {
          active_links?: string[] | null;
          current_state?: Database["public"]["Enums"]["device_status"];
          device_id: string;
          player_id: string;
          tweak_settings?: Json;
          unlock_date?: string | null;
          unlocked?: boolean;
        };
        Update: {
          active_links?: string[] | null;
          current_state?: Database["public"]["Enums"]["device_status"];
          device_id?: string;
          player_id?: string;
          tweak_settings?: Json;
          unlock_date?: string | null;
          unlocked?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "player_device_state_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
          {
            foreignKeyName: "player_device_state_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_device_state_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_discoveries: {
        Row: {
          discovered_at: string;
          discovery_id: string;
          id: string;
          metadata: Json;
          user_id: string;
        };
        Insert: {
          discovered_at?: string;
          discovery_id: string;
          id?: string;
          metadata?: Json;
          user_id: string;
        };
        Update: {
          discovered_at?: string;
          discovery_id?: string;
          id?: string;
          metadata?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_discoveries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_discoveries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_display_prefs: {
        Row: {
          background_color: string;
          created_at: string;
          cursor_blink: boolean;
          cursor_style: string;
          effect_curvature: boolean;
          effect_flicker: boolean;
          effect_glitch: boolean;
          effect_glow_intensity: number;
          effect_matrix_rain: boolean;
          effect_scanlines: boolean;
          font_family: string;
          font_size: number;
          high_contrast: boolean;
          id: string;
          large_text: boolean;
          letter_spacing: number;
          line_spacing: number;
          plain_mode: boolean;
          player_id: string;
          primary_color: string;
          prompt_style: string;
          reduced_motion: boolean;
          secondary_color: string;
          terminal_columns: number;
          terminal_rows: number;
          theme: string;
          updated_at: string;
        };
        Insert: {
          background_color?: string;
          created_at?: string;
          cursor_blink?: boolean;
          cursor_style?: string;
          effect_curvature?: boolean;
          effect_flicker?: boolean;
          effect_glitch?: boolean;
          effect_glow_intensity?: number;
          effect_matrix_rain?: boolean;
          effect_scanlines?: boolean;
          font_family?: string;
          font_size?: number;
          high_contrast?: boolean;
          id?: string;
          large_text?: boolean;
          letter_spacing?: number;
          line_spacing?: number;
          plain_mode?: boolean;
          player_id: string;
          primary_color?: string;
          prompt_style?: string;
          reduced_motion?: boolean;
          secondary_color?: string;
          terminal_columns?: number;
          terminal_rows?: number;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          background_color?: string;
          created_at?: string;
          cursor_blink?: boolean;
          cursor_style?: string;
          effect_curvature?: boolean;
          effect_flicker?: boolean;
          effect_glitch?: boolean;
          effect_glow_intensity?: number;
          effect_matrix_rain?: boolean;
          effect_scanlines?: boolean;
          font_family?: string;
          font_size?: number;
          high_contrast?: boolean;
          id?: string;
          large_text?: boolean;
          letter_spacing?: number;
          line_spacing?: number;
          plain_mode?: boolean;
          player_id?: string;
          primary_color?: string;
          prompt_style?: string;
          reduced_motion?: boolean;
          secondary_color?: string;
          terminal_columns?: number;
          terminal_rows?: number;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_display_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_display_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_firmware_state: {
        Row: {
          available_version: string | null;
          created_at: string;
          current_version: string;
          device_id: string;
          id: string;
          installed_at: string;
          player_id: string;
          previous_version: string | null;
          rollback_available: boolean | null;
          update_available: boolean;
          updated_at: string;
        };
        Insert: {
          available_version?: string | null;
          created_at?: string;
          current_version: string;
          device_id: string;
          id?: string;
          installed_at?: string;
          player_id: string;
          previous_version?: string | null;
          rollback_available?: boolean | null;
          update_available?: boolean;
          updated_at?: string;
        };
        Update: {
          available_version?: string | null;
          created_at?: string;
          current_version?: string;
          device_id?: string;
          id?: string;
          installed_at?: string;
          player_id?: string;
          previous_version?: string | null;
          rollback_available?: boolean | null;
          update_available?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_firmware_state_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_firmware_state_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_network_prefs: {
        Row: {
          auto_reconnect: boolean;
          connection_quality: string;
          created_at: string;
          id: string;
          notify_connection_lost: boolean;
          notify_server_restart: boolean;
          ping_interval_seconds: number;
          player_id: string;
          preferred_region: string | null;
          updated_at: string;
        };
        Insert: {
          auto_reconnect?: boolean;
          connection_quality?: string;
          created_at?: string;
          id?: string;
          notify_connection_lost?: boolean;
          notify_server_restart?: boolean;
          ping_interval_seconds?: number;
          player_id: string;
          preferred_region?: string | null;
          updated_at?: string;
        };
        Update: {
          auto_reconnect?: boolean;
          connection_quality?: string;
          created_at?: string;
          id?: string;
          notify_connection_lost?: boolean;
          notify_server_restart?: boolean;
          ping_interval_seconds?: number;
          player_id?: string;
          preferred_region?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_network_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_network_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_saves: {
        Row: {
          data: Json;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          data?: Json;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          data?: Json;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "player_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_sound_prefs: {
        Row: {
          background_hum: boolean;
          background_hum_volume: number;
          command_beeps: boolean;
          command_beeps_volume: number;
          created_at: string;
          device_whir: boolean;
          device_whir_volume: number;
          error_buzzer: boolean;
          error_buzzer_volume: number;
          id: string;
          idle_static: boolean;
          idle_static_volume: number;
          master_volume: number;
          muted: boolean;
          notification_quest_complete: boolean;
          notification_research_complete: boolean;
          notification_trade_accepted: boolean;
          notification_volatility_alert: boolean;
          notification_volume: number;
          player_id: string;
          quantum_whisper: boolean;
          quantum_whisper_volume: number;
          sound_profile: string;
          success_chime: boolean;
          success_chime_volume: number;
          tab_complete_sound: boolean;
          tab_complete_volume: number;
          terminal_clicks: boolean;
          terminal_clicks_volume: number;
          updated_at: string;
          voice_alerts: boolean;
        };
        Insert: {
          background_hum?: boolean;
          background_hum_volume?: number;
          command_beeps?: boolean;
          command_beeps_volume?: number;
          created_at?: string;
          device_whir?: boolean;
          device_whir_volume?: number;
          error_buzzer?: boolean;
          error_buzzer_volume?: number;
          id?: string;
          idle_static?: boolean;
          idle_static_volume?: number;
          master_volume?: number;
          muted?: boolean;
          notification_quest_complete?: boolean;
          notification_research_complete?: boolean;
          notification_trade_accepted?: boolean;
          notification_volatility_alert?: boolean;
          notification_volume?: number;
          player_id: string;
          quantum_whisper?: boolean;
          quantum_whisper_volume?: number;
          sound_profile?: string;
          success_chime?: boolean;
          success_chime_volume?: number;
          tab_complete_sound?: boolean;
          tab_complete_volume?: number;
          terminal_clicks?: boolean;
          terminal_clicks_volume?: number;
          updated_at?: string;
          voice_alerts?: boolean;
        };
        Update: {
          background_hum?: boolean;
          background_hum_volume?: number;
          command_beeps?: boolean;
          command_beeps_volume?: number;
          created_at?: string;
          device_whir?: boolean;
          device_whir_volume?: number;
          error_buzzer?: boolean;
          error_buzzer_volume?: number;
          id?: string;
          idle_static?: boolean;
          idle_static_volume?: number;
          master_volume?: number;
          muted?: boolean;
          notification_quest_complete?: boolean;
          notification_research_complete?: boolean;
          notification_trade_accepted?: boolean;
          notification_volatility_alert?: boolean;
          notification_volume?: number;
          player_id?: string;
          quantum_whisper?: boolean;
          quantum_whisper_volume?: number;
          sound_profile?: string;
          success_chime?: boolean;
          success_chime_volume?: number;
          tab_complete_sound?: boolean;
          tab_complete_volume?: number;
          terminal_clicks?: boolean;
          terminal_clicks_volume?: number;
          updated_at?: string;
          voice_alerts?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "player_sound_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "player_sound_prefs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      prestige_state: {
        Row: {
          level: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          level?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          level?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      production_jobs: {
        Row: {
          claimed_at: string | null;
          completes_at: string;
          created_at: string;
          id: string;
          metadata: Json;
          recipe_id: string;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string | null;
          completes_at: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          recipe_id: string;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string | null;
          completes_at?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          recipe_id?: string;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "production_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "production_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      production_queue: {
        Row: {
          batch_count: number | null;
          completes_at: string | null;
          created_at: string | null;
          device_id: string;
          energy_per_second: number | null;
          inputs_consumed: Json;
          output_amount: number | null;
          output_container: string;
          output_resource: string;
          pause_remaining_seconds: number | null;
          paused_at: string | null;
          player_id: string;
          queue_id: string;
          recipe_id: string;
          started_at: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          batch_count?: number | null;
          completes_at?: string | null;
          created_at?: string | null;
          device_id: string;
          energy_per_second?: number | null;
          inputs_consumed?: Json;
          output_amount?: number | null;
          output_container: string;
          output_resource: string;
          pause_remaining_seconds?: number | null;
          paused_at?: string | null;
          player_id: string;
          queue_id?: string;
          recipe_id: string;
          started_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          batch_count?: number | null;
          completes_at?: string | null;
          created_at?: string | null;
          device_id?: string;
          energy_per_second?: number | null;
          inputs_consumed?: Json;
          output_amount?: number | null;
          output_container?: string;
          output_resource?: string;
          pause_remaining_seconds?: number | null;
          paused_at?: string | null;
          player_id?: string;
          queue_id?: string;
          recipe_id?: string;
          started_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "production_queue_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "production_queue_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      production_recipes: {
        Row: {
          created_at: string | null;
          description: string | null;
          device_type: string;
          energy_draw: number;
          inputs: Json;
          output_amount: number | null;
          output_resource: string;
          production_time_seconds: number;
          recipe_id: string;
          requires_science: string[] | null;
          tier: number;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          device_type: string;
          energy_draw?: number;
          inputs: Json;
          output_amount?: number | null;
          output_resource: string;
          production_time_seconds: number;
          recipe_id: string;
          requires_science?: string[] | null;
          tier: number;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          device_type?: string;
          energy_draw?: number;
          inputs?: Json;
          output_amount?: number | null;
          output_resource?: string;
          production_time_seconds?: number;
          recipe_id?: string;
          requires_science?: string[] | null;
          tier?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          current_episode: string;
          display_name: string | null;
          id: string;
          is_dev: boolean;
          last_tick_at: string | null;
          mission_state: Json;
          quest_state: Json;
          tech_tree_state: Json;
          total_unsc: number;
          tutorial_state: Json;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          current_episode?: string;
          display_name?: string | null;
          id: string;
          is_dev?: boolean;
          last_tick_at?: string | null;
          mission_state?: Json;
          quest_state?: Json;
          tech_tree_state?: Json;
          total_unsc?: number;
          tutorial_state?: Json;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          current_episode?: string;
          display_name?: string | null;
          id?: string;
          is_dev?: boolean;
          last_tick_at?: string | null;
          mission_state?: Json;
          quest_state?: Json;
          tech_tree_state?: Json;
          total_unsc?: number;
          tutorial_state?: Json;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      research_jobs: {
        Row: {
          cancelled_at: string | null;
          claimed_at: string | null;
          completes_at: string;
          id: string;
          node_id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          claimed_at?: string | null;
          completes_at: string;
          id?: string;
          node_id: string;
          started_at?: string;
          user_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          claimed_at?: string | null;
          completes_at?: string;
          id?: string;
          node_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "research_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      research_progress: {
        Row: {
          current_tier: number;
          experience: number;
          experience_to_next: number;
          id: string;
          last_researched_at: string | null;
          tech_tree_id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          current_tier?: number;
          experience?: number;
          experience_to_next?: number;
          id?: string;
          last_researched_at?: string | null;
          tech_tree_id: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          current_tier?: number;
          experience?: number;
          experience_to_next?: number;
          id?: string;
          last_researched_at?: string | null;
          tech_tree_id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_progress_tech_tree_id_fkey";
            columns: ["tech_tree_id"];
            isOneToOne: false;
            referencedRelation: "tech_trees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "research_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "research_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reserve_transactions: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          source: string;
          source_ref: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: number;
          source: string;
          source_ref?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: number;
          source?: string;
          source_ref?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reserve_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "reserve_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_containers: {
        Row: {
          auto_created: boolean | null;
          base_capacity: number;
          container_id: string;
          created_at: string | null;
          current_amount: number | null;
          is_bootstrap: boolean | null;
          player_id: string;
          replaced_by: string | null;
          resource_type: string;
          updated_at: string | null;
          upgrade_level: number | null;
        };
        Insert: {
          auto_created?: boolean | null;
          base_capacity: number;
          container_id: string;
          created_at?: string | null;
          current_amount?: number | null;
          is_bootstrap?: boolean | null;
          player_id: string;
          replaced_by?: string | null;
          resource_type: string;
          updated_at?: string | null;
          upgrade_level?: number | null;
        };
        Update: {
          auto_created?: boolean | null;
          base_capacity?: number;
          container_id?: string;
          created_at?: string | null;
          current_amount?: number | null;
          is_bootstrap?: boolean | null;
          player_id?: string;
          replaced_by?: string | null;
          resource_type?: string;
          updated_at?: string | null;
          upgrade_level?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "resource_containers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "resource_containers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      slices: {
        Row: {
          brightness: number | null;
          created_at: string;
          crystal_id: string;
          hue: number | null;
          id: string;
          is_active: boolean;
          position: number;
          power: number;
          saturation: number | null;
          updated_at: string;
        };
        Insert: {
          brightness?: number | null;
          created_at?: string;
          crystal_id: string;
          hue?: number | null;
          id?: string;
          is_active?: boolean;
          position: number;
          power?: number;
          saturation?: number | null;
          updated_at?: string;
        };
        Update: {
          brightness?: number | null;
          created_at?: string;
          crystal_id?: string;
          hue?: number | null;
          id?: string;
          is_active?: boolean;
          position?: number;
          power?: number;
          saturation?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "slices_crystal_id_fkey";
            columns: ["crystal_id"];
            isOneToOne: false;
            referencedRelation: "crystals";
            referencedColumns: ["id"];
          },
        ];
      };
      sound_profiles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          settings: Json;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id: string;
          is_default?: boolean;
          name: string;
          settings: Json;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          settings?: Json;
          sort_order?: number;
        };
        Relationships: [];
      };
      starter_packs: {
        Row: {
          active: boolean | null;
          bonus_items: Json | null;
          common_slices: number | null;
          created_at: string | null;
          max_per_player: number | null;
          name: string;
          pack_id: string;
          price_usd: number;
          uncommon_slices: number | null;
          unsc_amount: number;
          unsc_burned: number;
        };
        Insert: {
          active?: boolean | null;
          bonus_items?: Json | null;
          common_slices?: number | null;
          created_at?: string | null;
          max_per_player?: number | null;
          name: string;
          pack_id: string;
          price_usd: number;
          uncommon_slices?: number | null;
          unsc_amount: number;
          unsc_burned: number;
        };
        Update: {
          active?: boolean | null;
          bonus_items?: Json | null;
          common_slices?: number | null;
          created_at?: string | null;
          max_per_player?: number | null;
          name?: string;
          pack_id?: string;
          price_usd?: number;
          uncommon_slices?: number | null;
          unsc_amount?: number;
          unsc_burned?: number;
        };
        Relationships: [];
      };
      syspref_audit_log: {
        Row: {
          area: string;
          change_reason: string | null;
          changed_at: string;
          changed_by: string | null;
          id: string;
          ip_address: unknown;
          new_value: string | null;
          old_value: string | null;
          player_id: string | null;
          setting_key: string;
        };
        Insert: {
          area: string;
          change_reason?: string | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          ip_address?: unknown;
          new_value?: string | null;
          old_value?: string | null;
          player_id?: string | null;
          setting_key: string;
        };
        Update: {
          area?: string;
          change_reason?: string | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          ip_address?: unknown;
          new_value?: string | null;
          old_value?: string | null;
          player_id?: string | null;
          setting_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "syspref_audit_log_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "syspref_audit_log_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "syspref_audit_log_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "syspref_audit_log_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      system_config_cache: {
        Row: {
          blockchain_proxy_url: string;
          cpu_cores: number;
          cpu_model: string;
          created_at: string;
          dns_search_domain: string | null;
          dns_servers: string[];
          firewall_allowed_ports: string[];
          firewall_default_incoming: string;
          firewall_default_outgoing: string;
          firewall_enabled: boolean;
          game_server_url: string;
          hostname: string;
          id: string;
          kernel_version: string;
          last_ntp_sync: string | null;
          memory_total_gb: number;
          ntp_enabled: boolean;
          ntp_interval_seconds: number;
          ntp_servers: string[];
          oracle_feed_url: string;
          os_build: string;
          os_codename: string;
          os_version: string;
          storage_slots_total: number;
          updated_at: string;
        };
        Insert: {
          blockchain_proxy_url?: string;
          cpu_cores: number;
          cpu_model: string;
          created_at?: string;
          dns_search_domain?: string | null;
          dns_servers?: string[];
          firewall_allowed_ports?: string[];
          firewall_default_incoming?: string;
          firewall_default_outgoing?: string;
          firewall_enabled?: boolean;
          game_server_url?: string;
          hostname?: string;
          id?: string;
          kernel_version: string;
          last_ntp_sync?: string | null;
          memory_total_gb: number;
          ntp_enabled?: boolean;
          ntp_interval_seconds?: number;
          ntp_servers?: string[];
          oracle_feed_url?: string;
          os_build: string;
          os_codename: string;
          os_version: string;
          storage_slots_total: number;
          updated_at?: string;
        };
        Update: {
          blockchain_proxy_url?: string;
          cpu_cores?: number;
          cpu_model?: string;
          created_at?: string;
          dns_search_domain?: string | null;
          dns_servers?: string[];
          firewall_allowed_ports?: string[];
          firewall_default_incoming?: string;
          firewall_default_outgoing?: string;
          firewall_enabled?: boolean;
          game_server_url?: string;
          hostname?: string;
          id?: string;
          kernel_version?: string;
          last_ntp_sync?: string | null;
          memory_total_gb?: number;
          ntp_enabled?: boolean;
          ntp_interval_seconds?: number;
          ntp_servers?: string[];
          oracle_feed_url?: string;
          os_build?: string;
          os_codename?: string;
          os_version?: string;
          storage_slots_total?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      tech_trees: {
        Row: {
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          max_tier: number;
          name: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          max_tier?: number;
          name: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          max_tier?: number;
          name?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          counterparty_id: string | null;
          created_at: string;
          crystal_id: string | null;
          description: string | null;
          id: string;
          metadata: Json | null;
          tech_tree_id: string | null;
          type: Database["public"]["Enums"]["transaction_type"];
          user_id: string | null;
        };
        Insert: {
          amount: number;
          counterparty_id?: string | null;
          created_at?: string;
          crystal_id?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          tech_tree_id?: string | null;
          type: Database["public"]["Enums"]["transaction_type"];
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          counterparty_id?: string | null;
          created_at?: string;
          crystal_id?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          tech_tree_id?: string | null;
          type?: Database["public"]["Enums"]["transaction_type"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_counterparty_id_fkey";
            columns: ["counterparty_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "transactions_counterparty_id_fkey";
            columns: ["counterparty_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_crystal_id_fkey";
            columns: ["crystal_id"];
            isOneToOne: false;
            referencedRelation: "crystals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_tech_tree_id_fkey";
            columns: ["tech_tree_id"];
            isOneToOne: false;
            referencedRelation: "tech_trees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      unapp_registry: {
        Row: {
          app_id: string;
          author: string | null;
          auto_install: boolean;
          category: string;
          created_at: string;
          dependencies: string[] | null;
          description: string | null;
          device_id: string | null;
          is_active: boolean;
          min_unos_version: string | null;
          modules: string[];
          name: string;
          permissions: string[];
          size_kb: number | null;
          tech_tree: string | null;
          tier_required: number | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          app_id: string;
          author?: string | null;
          auto_install?: boolean;
          category: string;
          created_at?: string;
          dependencies?: string[] | null;
          description?: string | null;
          device_id?: string | null;
          is_active?: boolean;
          min_unos_version?: string | null;
          modules?: string[];
          name: string;
          permissions?: string[];
          size_kb?: number | null;
          tech_tree?: string | null;
          tier_required?: number | null;
          updated_at?: string;
          version?: string;
        };
        Update: {
          app_id?: string;
          author?: string | null;
          auto_install?: boolean;
          category?: string;
          created_at?: string;
          dependencies?: string[] | null;
          description?: string | null;
          device_id?: string | null;
          is_active?: boolean;
          min_unos_version?: string | null;
          modules?: string[];
          name?: string;
          permissions?: string[];
          size_kb?: number | null;
          tech_tree?: string | null;
          tier_required?: number | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      unapp_usage_log: {
        Row: {
          actions_performed: Json | null;
          app_id: string;
          duration_seconds: number | null;
          id: string;
          launch_source: string | null;
          modules_accessed: string[] | null;
          player_id: string;
          session_end: string | null;
          session_start: string;
        };
        Insert: {
          actions_performed?: Json | null;
          app_id: string;
          duration_seconds?: number | null;
          id?: string;
          launch_source?: string | null;
          modules_accessed?: string[] | null;
          player_id: string;
          session_end?: string | null;
          session_start?: string;
        };
        Update: {
          actions_performed?: Json | null;
          app_id?: string;
          duration_seconds?: number | null;
          id?: string;
          launch_source?: string | null;
          modules_accessed?: string[] | null;
          player_id?: string;
          session_end?: string | null;
          session_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unapp_usage_log_app_id_fkey";
            columns: ["app_id"];
            isOneToOne: false;
            referencedRelation: "unapp_registry";
            referencedColumns: ["app_id"];
          },
          {
            foreignKeyName: "unapp_usage_log_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "unapp_usage_log_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      unsc_reserve: {
        Row: {
          available: number;
          id: number;
          total_burned: number;
          total_emitted: number;
          updated_at: string;
        };
        Insert: {
          available?: number;
          id?: number;
          total_burned?: number;
          total_emitted?: number;
          updated_at?: string;
        };
        Update: {
          available?: number;
          id?: number;
          total_burned?: number;
          total_emitted?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_security_policies: {
        Row: {
          created_at: string;
          id: string;
          lockout_duration_seconds: number;
          max_concurrent_sessions: number;
          max_login_attempts: number;
          min_password_length: number;
          password_expiry_days: number | null;
          require_number: boolean;
          require_special_char: boolean;
          require_uppercase: boolean;
          session_timeout_seconds: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lockout_duration_seconds?: number;
          max_concurrent_sessions?: number;
          max_login_attempts?: number;
          min_password_length?: number;
          password_expiry_days?: number | null;
          require_number?: boolean;
          require_special_char?: boolean;
          require_uppercase?: boolean;
          session_timeout_seconds?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          lockout_duration_seconds?: number;
          max_concurrent_sessions?: number;
          max_login_attempts?: number;
          min_password_length?: number;
          password_expiry_days?: number | null;
          require_number?: boolean;
          require_special_char?: boolean;
          require_uppercase?: boolean;
          session_timeout_seconds?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      volatility_snapshots: {
        Row: {
          block_time_ms: number;
          calculated_tier: Database["public"]["Enums"]["volatility_tier"];
          captured_at: string;
          id: string;
          network: string;
          tps: number;
        };
        Insert: {
          block_time_ms: number;
          calculated_tier: Database["public"]["Enums"]["volatility_tier"];
          captured_at?: string;
          id?: string;
          network?: string;
          tps: number;
        };
        Update: {
          block_time_ms?: number;
          calculated_tier?: Database["public"]["Enums"]["volatility_tier"];
          captured_at?: string;
          id?: string;
          network?: string;
          tps?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      player_all_prefs: {
        Row: {
          auto_reconnect: boolean | null;
          background_hum: boolean | null;
          date_format: string | null;
          effect_curvature: boolean | null;
          effect_scanlines: boolean | null;
          font_family: string | null;
          font_size: number | null;
          master_volume: number | null;
          muted: boolean | null;
          plain_mode: boolean | null;
          player_id: string | null;
          preferred_region: string | null;
          primary_color: string | null;
          sound_profile: string | null;
          terminal_clicks: boolean | null;
          theme: string | null;
          time_format: string | null;
          timezone: string | null;
          username: string | null;
        };
        Relationships: [];
      };
      v_active_production: {
        Row: {
          completes_at: string | null;
          device_id: string | null;
          energy_per_second: number | null;
          output_resource: string | null;
          player_id: string | null;
          seconds_remaining: number | null;
          started_at: string | null;
          status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "production_queue_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "production_queue_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      v_player_resources: {
        Row: {
          base_capacity: number | null;
          container_id: string | null;
          container_name: string | null;
          current_amount: number | null;
          effective_capacity: number | null;
          fill_percentage: number | null;
          player_id: string | null;
          resource_type: string | null;
          tier: number | null;
          upgrade_level: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "resource_containers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "player_all_prefs";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "resource_containers_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      calc_effective_capacity: {
        Args: { base_cap: number; upgrade_lvl: number };
        Returns: number;
      };
      cleanup_all_retention: { Args: never; Returns: Json };
      cleanup_command_history: {
        Args: { retention_days?: number };
        Returns: number;
      };
      cleanup_old_audit_logs: {
        Args: { retention_days?: number };
        Returns: number;
      };
      cleanup_syspref_audit: {
        Args: { retention_days?: number };
        Returns: number;
      };
      cleanup_usage_logs: { Args: { retention_days?: number }; Returns: number };
      cleanup_volatility_snapshots: {
        Args: { retention_days?: number };
        Returns: number;
      };
      credit_balance: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string };
        Returns: {
          error_message: string;
          new_balance: number;
          success: boolean;
        }[];
      };
      deduct_balance: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string };
        Returns: {
          error_message: string;
          new_balance: number;
          success: boolean;
        }[];
      };
      get_device_counts_by_category: { Args: never; Returns: Json };
      get_player_apps: {
        Args: { p_player_id: string };
        Returns: {
          app_category: string;
          app_id: string;
          app_name: string;
          app_state: string;
          device_id: string;
          device_state: string;
          installed_version: string;
          is_favorite: boolean;
          last_launched_at: string;
          total_launches: number;
        }[];
      };
      get_system_health: { Args: never; Returns: Json };
      initialize_player_prefs: {
        Args: { p_player_id: string };
        Returns: undefined;
      };
      invest_in_research: {
        Args: { p_amount: number; p_category: string; p_user_id: string };
        Returns: Json;
      };
      is_allowed_reserve_source: {
        Args: { p_source: string };
        Returns: boolean;
      };
      kernel_recompile: {
        Args: never;
        Returns: {
          cost: number;
          error_message: string;
          new_available: number;
          new_level: number;
          success: boolean;
        }[];
      };
      log_pref_change: {
        Args: {
          p_area: string;
          p_changed_by?: string;
          p_key: string;
          p_new_value: string;
          p_old_value: string;
          p_player_id: string;
        };
        Returns: string;
      };
      record_app_launch: {
        Args: { p_app_id: string; p_player_id: string; p_source: string };
        Returns: undefined;
      };
      reserve_burn_and_award: {
        Args: {
          p_amount: number;
          p_ref?: string;
          p_source: string;
          p_user_id: string;
        };
        Returns: {
          error_message: string;
          new_user_balance: number;
          reserve_available: number;
          success: boolean;
        }[];
      };
      reserve_status: {
        Args: never;
        Returns: {
          available: number;
          total_burned: number;
          total_emitted: number;
        }[];
      };
      reset_player_prefs: {
        Args: { p_area?: string; p_player_id: string };
        Returns: undefined;
      };
      toggle_app_favorite: {
        Args: { p_app_id: string; p_player_id: string };
        Returns: boolean;
      };
      unsc_burn: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_metadata?: Json;
          p_type: string;
        };
        Returns: {
          error_message: string;
          new_available: number;
          success: boolean;
        }[];
      };
      unsc_earn: {
        Args: {
          p_amount: number;
          p_description?: string;
          p_metadata?: Json;
          p_type: string;
        };
        Returns: {
          error_message: string;
          new_available: number;
          success: boolean;
        }[];
      };
    };
    Enums: {
      crystal_color:
        | "infrared"
        | "red"
        | "orange"
        | "yellow"
        | "green"
        | "blue"
        | "indigo"
        | "violet"
        | "gamma";
      crystal_era: "8-bit" | "16-bit" | "32-bit" | "64-bit";
      crystal_state: "stable" | "volatile" | "hybrid";
      device_category: "generator" | "heavy" | "medium" | "light" | "storage";
      device_status: "online" | "standby" | "offline" | "error" | "upgrading";
      rotation_direction: "CW" | "CCW";
      transaction_type:
        | "mint"
        | "burn"
        | "transfer"
        | "research"
        | "reward"
        | "fee"
        | "stake"
        | "unstake"
        | "trade";
      tweak_type: "radio" | "toggle" | "slider" | "priority_list";
      volatility_tier: "1" | "2" | "3" | "4" | "5";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      crystal_color: [
        "infrared",
        "red",
        "orange",
        "yellow",
        "green",
        "blue",
        "indigo",
        "violet",
        "gamma",
      ],
      crystal_era: ["8-bit", "16-bit", "32-bit", "64-bit"],
      crystal_state: ["stable", "volatile", "hybrid"],
      device_category: ["generator", "heavy", "medium", "light", "storage"],
      device_status: ["online", "standby", "offline", "error", "upgrading"],
      rotation_direction: ["CW", "CCW"],
      transaction_type: [
        "mint",
        "burn",
        "transfer",
        "research",
        "reward",
        "fee",
        "stake",
        "unstake",
        "trade",
      ],
      tweak_type: ["radio", "toggle", "slider", "priority_list"],
      volatility_tier: ["1", "2", "3", "4", "5"],
    },
  },
} as const;
