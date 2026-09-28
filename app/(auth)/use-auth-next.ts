"use client";

import { useSyncExternalStore } from "react";
import { isEmbedNext, sanitizeNext } from "@/lib/auth/next";

const noopSubscribe = (): (() => void) => () => {};

/**
 * The whitelisted `next` of the current auth page (`/login?next=…`), read
 * from the URL after hydration (no Suspense boundary needed, unlike
 * `useSearchParams`). `embed` is true for a login inside the Lab World's
 * terminal overlay; `withNext` carries `next` over to the sibling page.
 */
export function useAuthNext(): {
  next: string | null;
  embed: boolean;
  withNext: (path: string) => string;
} {
  const search = useSyncExternalStore(
    noopSubscribe,
    () => window.location.search,
    () => "",
  );
  const next = sanitizeNext(new URLSearchParams(search).get("next"));
  return {
    next,
    embed: isEmbedNext(next),
    withNext: (path) => (next ? `${path}?next=${encodeURIComponent(next)}` : path),
  };
}
