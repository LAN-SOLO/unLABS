"use client";

import { tr } from "@/lib/i18n";
import { CrtButton, SectionTitle, UI } from "@/components/world/ui";
import { MapIcon } from "@/components/world/map/MapIcon";
import type { Dossier } from "@/components/world/map/dossier";
import type { MapCategory, MapStatus } from "@/lib/world/map-data";

export interface DossierAction {
  id: string;
  label: string;
  onClick: () => void;
  tone?: "amber" | "green" | "cyan";
  pressed?: boolean;
  title?: string;
}

/**
 * Side "dossier" of the selected thing: header with icon and status, the
 * lead text, detail sections and the action buttons (track, waypoint,
 * handbook, go there, open note).
 */
export function DossierPanel({
  dossier,
  category,
  status,
  done,
  actions,
  onBack,
}: {
  dossier: Dossier;
  /** Entity icon (omitted for rooms). */
  category?: MapCategory;
  status?: MapStatus;
  done?: boolean;
  actions: DossierAction[];
  onBack: () => void;
}) {
  return (
    <section
      aria-label={tr("Dossier: {name}", { name: dossier.title })}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start gap-2">
        {category && status && (
          <span className="mt-0.5 rounded-sm border border-white/10 bg-black/60 p-1">
            <MapIcon category={category} status={status} done={done} size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] tracking-widest text-[#FFB800]/80 uppercase">
            {dossier.kicker}
          </div>
          <h3 className="text-sm leading-tight break-words text-[#d8ffd8]">{dossier.title}</h3>
          <div className="mt-0.5 text-[11px] text-[#00FFFF]/80">{dossier.statusText}</div>
        </div>
      </div>
      {dossier.lead && (
        <p className="border-l-2 border-[#33FF33]/30 pl-2 text-[11px] leading-snug text-white/70">
          {dossier.lead}
        </p>
      )}
      {dossier.sections.map((sec, i) => (
        <div key={i}>
          <SectionTitle accent={UI.amber}>{sec.title}</SectionTitle>
          {sec.rows && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
              {sec.rows.map((r, j) => (
                <div key={j} className="contents">
                  <dt className="text-white/45">{r.label}</dt>
                  <dd className="break-words text-[#d8ffd8]">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {sec.text && <p className="text-[11px] leading-snug text-white/75">{sec.text}</p>}
          {sec.items && (
            <ul className="list-none space-y-0.5 text-[11px] leading-snug text-white/75">
              {sec.items.map((it, j) => (
                <li key={j} className="flex gap-1.5">
                  <span aria-hidden className="text-[#33FF33]/60">
                    ›
                  </span>
                  <span className="min-w-0 break-words">{it}</span>
                </li>
              ))}
            </ul>
          )}
          {sec.chain && sec.chain.length > 0 && (
            <div className="mt-1 rounded-sm border border-[#00FFFF]/20 bg-[#00FFFF]/5 p-1.5">
              <div className="mb-0.5 text-[9px] tracking-widest text-[#00FFFF]/70 uppercase">
                {tr("Recipe chain")}
              </div>
              <ul className="space-y-0.5 text-[10px] leading-snug text-[#00FFFF]/85">
                {sec.chain.map((c, j) => (
                  <li key={j}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
        {actions.map((a) => (
          <CrtButton
            key={a.id}
            tone={a.tone ?? "green"}
            onClick={a.onClick}
            aria-pressed={a.pressed}
            title={a.title}
          >
            {a.label}
          </CrtButton>
        ))}
        <CrtButton tone="amber" onClick={onBack} title={tr("Back to the index (Esc)")}>
          {tr("‹ Back")}
        </CrtButton>
      </div>
    </section>
  );
}
