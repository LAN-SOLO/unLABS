"use client";

import { useEffect, useState } from "react";
import { tr } from "@/lib/i18n";
import { Meter, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { AppWindow, Muted } from "@/components/world/pc/common";
import { clock } from "@/components/world/pc/sources";
import { MEMO_MAX } from "@/lib/world/memos";

export const JADEOS_VERSION = "0.89.4";

const JOKES: readonly string[] = [
  tr("There are 10 kinds of researchers: those who back up, and those who will."),
  tr("Uptime is a state of mind. So, apparently, is the Halo."),
  tr("This machine has never crashed. It merely paused dramatically."),
  tr("Fan noise is normal. Humming along is optional."),
];

/** JadeOS "System": the workstation's own specs, uptime and a joke. */
export function SystemApp({ api, since }: { api: WorldApi; since: number }) {
  const s = api.get();
  const [now, setNow] = useState(since);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sessionSeconds = (now - since) / 1000;
  const used = s.memos.filter((m) => m.place === "pc").length;
  const joke = JOKES[Math.floor(s.playTime / 60) % JOKES.length]!;
  const rows: [string, string][] = [
    [tr("pcsys::Operating system"), `JadeOS ${JADEOS_VERSION}`],
    [tr("pcsys::Machine"), tr("Workstation J.L., hand-assembled")],
    [tr("pcsys::Processor"), tr("4 cores, one of them opinionated")],
    [tr("pcsys::Memory"), tr("64 GB, plus Jade's")],
    [tr("pcsys::Network"), tr("Lab LAN via NET-001, one very long cable upstairs")],
    [tr("pcsys::Session"), clock(sessionSeconds)],
    [tr("pcsys::Lab uptime"), clock(s.playTime)],
  ];
  return (
    <AppWindow title={tr("pc::System")}>
      <div className="space-y-2">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5 text-[11px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-white/45">{k}</dt>
              <dd style={{ color: UI.text }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="flex justify-between text-[11px]">
            <span className="text-white/45">{tr("pcsys::Disk")}</span>
            <span style={{ color: UI.text }}>
              {tr("{n} of {max} memos", { n: used, max: MEMO_MAX })}
            </span>
          </div>
          <Meter
            value={used}
            max={MEMO_MAX}
            color={UI.amber}
            label={tr("pcsys::Disk")}
            height={3}
          />
        </div>
        <Muted className="italic">{joke}</Muted>
      </div>
    </AppWindow>
  );
}
