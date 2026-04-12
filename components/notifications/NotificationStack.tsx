"use client";

/**
 * NotificationStack
 * =================
 *
 * Renders the notification stack at the bottom-center of the viewport.
 * Max 3 toasts visible at once.
 */

import { useNotification } from "@/contexts/NotificationProvider";
import { NotificationToast } from "./NotificationToast";

export function NotificationStack() {
  const { notifications, dismiss } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse gap-1.5">
      {notifications.map((notif) => (
        <NotificationToast key={notif.id} notification={notif} onDismiss={dismiss} />
      ))}
    </div>
  );
}
