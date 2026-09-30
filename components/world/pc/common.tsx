"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { SectionTitle, UI } from "@/components/world/ui";

/** Keys typed into a JadeOS field never reach the world or the desktop hotkeys (Esc still closes). */
export function stopKeys(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Escape") e.stopPropagation();
}

/** Title bar + body of one JadeOS app window. */
export function AppWindow({
  title,
  right,
  children,
  accent = UI.cyan,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-1 flex-col">
      <SectionTitle accent={accent} right={right} className="border-b border-[#00FFFF]/15 pb-1">
        {title}
      </SectionTitle>
      <div className="min-h-0 flex-1 pt-2">{children}</div>
    </section>
  );
}

/** Small muted paragraph. */
export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] text-white/45 ${className}`}>{children}</p>;
}
