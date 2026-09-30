"use client";

import { tr } from "@/lib/i18n";
import { FOCUS_RING } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { memoFrom, remember } from "@/lib/world/memos";
import type { MemoSourceKind } from "@/lib/world/types";

export interface RememberSource {
  kind: MemoSourceKind;
  /** Stable id of the thing (makes "Remember" idempotent). */
  id: string;
  title: string;
  text: string;
  tags?: readonly string[];
}

/** Store `src` as a memo in Jade's head, with a toast. Idempotent per source. */
export function rememberNow(api: WorldApi, src: RememberSource): void {
  const r = api.act((s) => remember(s, src));
  if (!r.ok) {
    api.toast(r.message, "warn");
    return;
  }
  if (r.fresh) {
    api.sound?.("ui_click");
    api.toast(tr("Remembered — {title}", { title: r.memo.title }), "good");
  } else api.toast(tr("Already in your notes — {title}", { title: r.memo.title }), "info");
}

/**
 * Small "Remember" button: one click writes the thing down as a memo
 * (knowledge panel, hotkey N). Shows "Noted" once a memo from this source exists.
 */
export function RememberButton({
  api,
  src,
  className = "",
}: {
  api: WorldApi;
  src: RememberSource;
  className?: string;
}) {
  const done = !!memoFrom(api.get(), src.kind, src.id);
  return (
    <button
      type="button"
      data-remember={src.kind}
      onClick={() => rememberNow(api, src)}
      title={
        done ? tr("Already in your notes") : tr("Write it down in your notes (knowledge panel, N)")
      }
      aria-label={
        done
          ? tr("Noted: {title}", { title: src.title })
          : tr("Remember: {title}", { title: src.title })
      }
      className={`shrink-0 rounded-sm border px-1.5 text-[9px] leading-4 tracking-wider uppercase ${FOCUS_RING} ${
        done
          ? "border-white/15 text-white/35"
          : "border-[#E91E8C]/60 text-[#E91E8C] hover:bg-[#E91E8C]/10"
      } ${className}`}
    >
      {done ? tr("✓ noted") : tr("+ Remember")}
    </button>
  );
}
