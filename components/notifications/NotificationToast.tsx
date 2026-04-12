"use client";

/**
 * NotificationToast
 * =================
 *
 * Individual notification toast with CRT glitch entrance animation.
 */

import { useEffect, useState } from "react";
import { NOTIFICATION_COLORS, type GameNotification } from "@/lib/game/notifications";

interface NotificationToastProps {
  notification: GameNotification;
  onDismiss: (id: string) => void;
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const colorClass = NOTIFICATION_COLORS[notification.type];

  // Entrance animation
  useEffect(() => {
    // Brief CRT flicker — show after 50ms
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Exit animation
  useEffect(() => {
    const duration = notification.duration ?? 5000;
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(notification.id), 300);
    }, duration - 300); // Start exit 300ms before auto-dismiss
    return () => clearTimeout(exitTimer);
  }, [notification, onDismiss]);

  return (
    <div
      className={`pointer-events-auto max-w-sm cursor-pointer rounded border bg-black/90 px-3 py-2 font-mono backdrop-blur-sm transition-all duration-300 ease-out ${colorClass} ${isVisible && !isExiting ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} `}
      onClick={() => onDismiss(notification.id)}
    >
      <div className="text-[10px] font-bold tracking-wider uppercase">{notification.title}</div>
      {notification.body && <div className="mt-0.5 text-[9px] opacity-70">{notification.body}</div>}
    </div>
  );
}
