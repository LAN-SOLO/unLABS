"use client";

/**
 * NotificationProvider
 * ====================
 *
 * Ephemeral notification queue. Max 3 visible simultaneously, auto-dismiss
 * after configurable duration (default 5s). No persistence.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { GameNotification, NotificationType } from "@/lib/game/notifications";
import { createNotification } from "@/lib/game/notifications";

const MAX_VISIBLE = 3;

interface NotificationContextValue {
  /** Currently visible notifications (max 3). */
  notifications: GameNotification[];
  /** Push a new notification. */
  notify: (type: NotificationType, title: string, body?: string, duration?: number) => void;
  /** Dismiss a specific notification. */
  dismiss: (id: string) => void;
  /** Dismiss all notifications. */
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = useCallback(
    (type: NotificationType, title: string, body?: string, duration?: number) => {
      const notif = createNotification(type, title, body, duration);

      setNotifications((prev) => {
        // Trim to max visible (keep the most recent)
        const next = [...prev, notif];
        if (next.length > MAX_VISIBLE) {
          return next.slice(next.length - MAX_VISIBLE);
        }
        return next;
      });

      // Auto-dismiss
      const dismissMs = notif.duration ?? 5000;
      setTimeout(() => {
        dismiss(notif.id);
      }, dismissMs);
    },
    [dismiss],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({ notifications, notify, dismiss, dismissAll }),
    [notifications, notify, dismiss, dismissAll],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used inside <NotificationProvider>");
  }
  return ctx;
}
