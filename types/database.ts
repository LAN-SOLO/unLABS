// UnstableLabs database types.
//
// `Database` comes from ./database.generated.ts, produced by `pnpm db:types`
// against the local Supabase stack — regenerate after every migration.
// This file layers the hand-maintained refinements on top: domain enums
// (narrower than the DB's text columns), helper aliases, and joined types.

import type { Database } from "./database.generated";

export type { Database, Json } from "./database.generated";

// =================================
// ENUMS
// =================================

export type CrystalColor =
  | "infrared"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "indigo"
  | "violet"
  | "gamma";

export type VolatilityTier = "1" | "2" | "3" | "4" | "5";

export type RotationDirection = "CW" | "CCW";

export type CrystalState = "stable" | "volatile" | "hybrid";

export type CrystalEra = "8-bit" | "16-bit" | "32-bit" | "64-bit";

export type TransactionType =
  | "mint"
  | "burn"
  | "transfer"
  | "research"
  | "reward"
  | "fee"
  | "stake"
  | "unstake"
  | "trade";

export type DeviceCategory = "generator" | "heavy" | "medium" | "light" | "storage";

export type DeviceState = "online" | "standby" | "offline" | "error" | "upgrading";

export type TweakType = "radio" | "toggle" | "slider" | "priority_list";

// =================================
// HELPER TYPES
// =================================

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Convenience aliases
export type Profile = Tables<"profiles">;
export type Crystal = Tables<"crystals">;
export type Slice = Tables<"slices">;
export type TechTree = Tables<"tech_trees">;
export type ResearchProgress = Tables<"research_progress">;
export type Balance = Tables<"balances">;
export type Transaction = Tables<"transactions">;
export type CommandHistory = Tables<"command_history">;
export type VolatilitySnapshot = Tables<"volatility_snapshots">;
export type DbDevice = Tables<"devices">;
export type DbDeviceState = Tables<"device_state">;
export type DbDeviceDependency = Tables<"device_dependencies">;
export type DbDeviceCombination = Tables<"device_combinations">;
export type DbDeviceTweak = Tables<"device_tweaks">;
export type DbPlayerDeviceState = Tables<"player_device_state">;
export type DbPlayerDisplayPrefs = Tables<"player_display_prefs">;
export type DbPlayerSoundPrefs = Tables<"player_sound_prefs">;
export type DbPlayerDatetimePrefs = Tables<"player_datetime_prefs">;
export type DbPlayerNetworkPrefs = Tables<"player_network_prefs">;
export type DbSystemConfigCache = Tables<"system_config_cache">;
export type DbSysprefAuditLog = Tables<"syspref_audit_log">;
export type DbUserSecurityPolicies = Tables<"user_security_policies">;
export type DbDisplayTheme = Tables<"display_themes">;
export type DbDisplayFont = Tables<"display_fonts">;
export type DbSoundProfile = Tables<"sound_profiles">;

// Joined types
export type CrystalWithSlices = Crystal & {
  slices: Slice[];
};

export type ResearchWithTree = ResearchProgress & {
  tech_tree: TechTree;
};

export type ProfileWithBalance = Profile & {
  balance: Balance | null;
};
