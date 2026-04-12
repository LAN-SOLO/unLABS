/**
 * Notification types
 * ==================
 *
 * Ephemeral toast-style notifications. Not persisted — if the player
 * misses one, the information is still available in the MissionPanel
 * or DiscoveryLog.
 */

export type NotificationType =
  | "mission_available"
  | "mission_complete"
  | "objective_progress"
  | "discovery"
  | "resonance_trigger"
  | "tip";

export interface GameNotification {
  /** Unique id for React keys and deduplication. */
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Timestamp when the notification was created. */
  timestamp: number;
  /** Auto-dismiss duration in ms. Default: 5000. */
  duration?: number;
}

/** Color mapping for notification types. */
export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  mission_available: "border-amber-500/50 text-amber-300",
  mission_complete: "border-green-500/50 text-green-300",
  objective_progress: "border-green-500/30 text-green-400",
  discovery: "border-pink-500/50 text-pink-300",
  resonance_trigger: "border-yellow-500/50 text-yellow-300",
  tip: "border-gray-500/30 text-gray-400",
};

let notificationIdCounter = 0;

export function createNotification(
  type: NotificationType,
  title: string,
  body?: string,
  duration?: number,
): GameNotification {
  return {
    id: `notif-${++notificationIdCounter}-${Date.now()}`,
    type,
    title,
    body,
    timestamp: Date.now(),
    duration: duration ?? 5000,
  };
}
