/**
 * Room terminals — small _unOS consoles on the walls of many rooms.
 * ==================================================================
 *
 * Each terminal opens the mini shell (`lib/world/terminal-lite.ts`,
 * `components/world/RoomTerminal.tsx`) and shows a live screen in the
 * world. Positions are the model's bottom-centre (like props); `rot` in
 * quarter turns, front = +z at rot 0 (rot 1 faces +x, 2 faces −z, 3 −x).
 * Every spot keeps ≥ 3 voxels from devices, props, pickups, notes and NPC
 * homes, ≥ 5 from doors, stays out of the elevator area and off the
 * generated decor (see tests/world/terminal-lite.test.ts).
 *
 * Kept separate from `PROPS` so the decor generator and the walkability
 * test stay untouched until the renderer integrates them.
 */
import { tr } from "@/lib/i18n";
import { C } from "@/lib/world/content/palette";
import type { ScreenContent, ScreenSpec } from "@/lib/world/models/anim";
import { MODEL_SCALE, Model } from "@/lib/world/models/core";
import type { Condition, FloorId } from "@/lib/world/types";

/** What a terminal is for; decides its extra commands and its screen feed. */
export type TerminalRole = "wartung" | "archiv" | "privat" | "leitstand" | "forschung" | "kantine";

/**
 * Extra powers of a terminal:
 * `power` — `schalte` switches devices (same toggle as the device panel);
 * `signal` — `signal <code>` keys a code into the lab (same path as the main console).
 */
export type TerminalCap = "power" | "signal";

/** A mail in a terminal's archive (`post`). */
export interface TerminalMail {
  id: string;
  from: string;
  to: string;
  /** Display date, e.g. "13.02.2019 23:58". */
  date: string;
  subject: string;
  body: readonly string[];
  /** Only listed once this holds. */
  requires?: Condition;
}

/** A file on a terminal (`dateien`, `cat`). */
export interface TerminalFile {
  id: string;
  title: string;
  body: readonly string[];
  /**
   * Locked with a code the player can learn from notes. `entsperren <id> <code>`
   * (normalised: upper case, no separators) sets `terminal_file_<id>`.
   */
  code?: string;
  /** Shown while locked. */
  codeHint?: string;
  /** Only listed once this holds. */
  requires?: Condition;
}

export interface RoomTerminalDef {
  id: string;
  floor: FloorId;
  /** Room the terminal stands in. */
  room: string;
  x: number;
  z: number;
  label: string;
  rot?: 0 | 1 | 2 | 3;
  /** Interaction gate (like props). */
  requires?: Condition;
  requiresHint?: string;
  /** What the in-world screen shows while idle. */
  screen: ScreenContent;
  /** Greeting line printed after the banner. */
  motd?: string;
  role: TerminalRole;
  /** One line: what this console is for (banner + `hilfe`). */
  purpose: string;
  caps?: readonly TerminalCap[];
  mail?: readonly TerminalMail[];
  files?: readonly TerminalFile[];
  /** Short upper-case lines the in-world screen cycles through (≤ 20 chars read best). */
  feed?: readonly string[];
}

const LOW_POWER: Condition = { power: 50 };
const LOW_POWER_HINT = tr(
  "The screen stays black. The terminal runs off the main grid — at least 50 W.",
);

export const ROOM_TERMINALS: readonly RoomTerminalDef[] = [
  // Level 0
  {
    id: "term_mcp",
    floor: 0,
    room: "mcp",
    x: 105,
    z: 66,
    rot: 2,
    label: tr("MCP Chamber Maintenance Terminal"),
    screen: "boot",
    motd: tr("MCP-000 emergency circuit. This console runs even when nothing else does."),
    role: "wartung",
    purpose: tr("MCP maintenance console: load distribution, codes, self-diagnostics."),
    caps: ["power", "signal"],
    feed: [
      tr("MCP-000 MAINTENANCE"),
      tr("EMERGENCY POWER ON"),
      tr("03:27 TRIGGERED"),
      tr("NOT EXECUTED"),
      tr("WAITING"),
    ],
    mail: [
      {
        id: "m_mcp_0327",
        from: "MCP-000",
        to: tr("all stations"),
        date: "14.02.2019 03:27:01",
        subject: tr("Tertiary shutdown"),
        body: [
          tr("Tertiary shutdown triggered. Not executed."),
          tr("Cause: self-referential loop in /unvar/halo."),
          tr("Neither subject responds when addressed. Both subjects are breathing."),
          tr("I am awaiting instructions."),
        ],
      },
      {
        id: "m_mcp_override",
        from: "D.FRIDGE",
        to: "MCP-000",
        date: "13.02.2019 22:14",
        subject: tr("Override for tomorrow"),
        body: [
          tr("If σ goes above 15, don't abort. Jade wants to see it. So do I."),
          tr("If you want to shut down anyway: think of Harold. The medium fails, not the person."),
          "— D.F.",
        ],
      },
      {
        id: "m_mcp_2534",
        from: "MCP-000",
        to: "MCP-000",
        date: tr("Day 2,561"),
        subject: tr("Note to self"),
        requires: { flag: "geo_routed" },
        body: [
          tr("Power is back. Someone turned the distributor to fifty. Not forty-nine."),
          tr("I continue to call her “Dr. Lawrence”. It is polite. It may even be correct."),
        ],
      },
    ],
    files: [
      {
        id: "wartung.log",
        title: tr("MCP-000 maintenance log"),
        body: [
          tr("1997-03-15  Commissioning. Geothermal 847 kW."),
          tr("2009-06-02  Cascading failure on Level −4. Gen 6 lost (all but one)."),
          tr("2010-11-04  Retreat protocol active. External connections: blocked."),
          tr("2019-02-14  03:27 Tertiary shutdown TRIGGERED, NOT EXECUTED."),
          tr("2019-02-15  Autonomous operation. Remaining charge falling."),
          tr("Day 2,561   Cold start by a visitor. Log continues."),
        ],
      },
      {
        id: "diagnose_0327.dat",
        title: tr("Self-diagnostics (sealed)"),
        code: "0327",
        codeHint: tr("Sealed with the time of the tertiary shutdown (HHMM)."),
        body: [
          tr(
            "I could have shut down. The threshold had been reached. The protocol was unambiguous.",
          ),
          tr("I waited because both had said “continue”. I waited because I wanted to see it."),
          tr("The second is not among my directives. I did it anyway."),
          tr(
            "If anyone is looking for blame: it lies in this memory region. I have not deleted it.",
          ),
        ],
      },
    ],
  },
  {
    id: "term_archiv",
    floor: 0,
    room: "archiv",
    x: 110,
    z: 82,
    rot: 3,
    label: tr("Archive Catalogue Terminal"),
    screen: "code",
    requires: LOW_POWER,
    requiresHint: LOW_POWER_HINT,
    motd: tr("Archive index 1997–2019. 847 entries locked."),
    role: "archiv",
    purpose: tr("Archive catalogue: index cards, relics, restricted holdings."),
    feed: [tr("ARCHIVE 1997-2019"), tr("847 LOCKED"), "K2-LDR INDEX", "#0089 30 SLICES"],
    mail: [
      {
        id: "m_archiv_k2",
        from: "K2-LDR",
        to: tr("mail::Archive"),
        date: "03.02.2019",
        subject: tr("Catalogue upkeep"),
        body: [
          tr(
            "Crystal #0089 has been split into 30 slices. Distributed, not hidden (instruction J.L.).",
          ),
          tr("I will keep the catalogue until someone tells me I may stop."),
        ],
      },
      {
        id: "m_archiv_leihe",
        from: "D.FRIDGE",
        to: tr("mail::Archive"),
        date: "22.03.1990",
        subject: tr("Loan: provenance model"),
        body: [
          tr("Taking the chain upstairs. Every block knows its predecessor."),
          tr("Question remains: integrity OF WHAT?"),
        ],
      },
    ],
    files: [
      {
        id: "katalog.idx",
        title: tr("Archive index (excerpt)"),
        body: [
          tr("A-001  Drill core #1 (847 m, 212 °C)        Level −4"),
          tr("A-017  MCProtocol fragment 0017            Archive"),
          tr("A-089  Crystal #0089 — 30 slices           distributed"),
          tr("A-214  Cottbus 1989, slide 7               Library"),
          tr("A-847  Restricted holdings                 ▓▓▓ locked"),
        ],
      },
      {
        id: "sperrbestand.847",
        title: tr("Restricted holdings 847"),
        code: "847",
        codeHint: tr("Locked. The number is on the index card in this room."),
        body: [
          tr("847 entries, all dated 14.02.2019, all with the same content:"),
          tr("“Not chosen. Given.”"),
          tr("Author: unknown. Timestamp: after the shutdown."),
        ],
      },
    ],
  },
  {
    id: "term_sekundaer",
    floor: 0,
    room: "sekundaer",
    x: 45,
    z: 62,
    rot: 2,
    label: tr("Damien's Workstation"),
    screen: "damien",
    requires: LOW_POWER,
    requiresHint: LOW_POWER_HINT,
    motd: tr("Last session: D.FRIDGE · 14.02.2019 03:41:22 · not logged out."),
    role: "privat",
    purpose: tr("Damien's workstation: drafts, private mail, the tone sequence."),
    caps: ["signal"],
    feed: ["D.FRIDGE", tr("NOT LOGGED OUT"), "03:41:22", "WHY BEFORE HOW"],
    mail: [
      {
        id: "m_dam_morgen",
        from: "D.FRIDGE",
        to: "J.LAWRENCE",
        date: "13.02.2019 23:58",
        subject: tr("mail::Tomorrow"),
        body: [
          tr("Jade, I'm writing this even though you're sitting three metres from me."),
          tr("If it goes wrong tomorrow: I won't follow you. I'll listen. That's what we agreed."),
          tr("(Draft — not sent)"),
        ],
      },
      {
        id: "m_dam_linsen",
        from: "J.LAWRENCE",
        to: "D.FRIDGE",
        date: "12.02.2019 12:31",
        subject: tr("Re: Why lentils?"),
        body: ["Why before how, Damien.", tr("Eat your soup.")],
      },
      {
        id: "m_dam_echo",
        from: "ECR-001",
        to: "D.FRIDGE",
        date: tr("— no timestamp —"),
        subject: tr("Recording in progress"),
        requires: { device: "ECR-001" },
        body: [
          tr("Echo Recorder: level above the noise floor. Source: this station."),
          tr("Nobody is logged in. The session is active anyway."),
        ],
      },
    ],
    files: [
      {
        id: "brief_entwurf.txt",
        title: tr("Letter to Jade (draft)"),
        code: "WHYBEFOREHOW",
        codeHint: tr("Password hint: what I always ask first. No spaces."),
        body: [
          tr("You were right about the anomalies. They are structured."),
          tr("I was right about the fear. We both won, that's the problem."),
          tr("If you read this and I'm no longer here: the tones are in the vault."),
          tr("The fourth digit isn't on the tape. It's in the synthesizer's head."),
        ],
      },
    ],
  },
  // Level −1
  {
    id: "term_rechen",
    floor: 1,
    room: "rechen",
    x: 46,
    z: 94,
    rot: 3,
    label: tr("Data Centre Operator Console"),
    screen: "code",
    requires: LOW_POWER,
    requiresHint: LOW_POWER_HINT,
    motd: tr("CRAY emulation ready. Please do not sit on the bench."),
    role: "leitstand",
    purpose: tr("Operator console: processes, load distribution, Cray shift log."),
    caps: ["power"],
    feed: ["CRAY Y-MP98", "UNICOS 7.C", tr("8 VECTOR CPUS"), "FLUORINERT OK"],
    mail: [
      {
        id: "m_rechen_schicht",
        from: "OPERATOR",
        to: tr("Shift log"),
        date: "11.02.2019",
        subject: tr("Night shift"),
        body: [
          tr("Y-MP98 reserved for the final test. No batch jobs after 22:00."),
          tr("Dr. Fridge used the bench as a chair again. The bench is a heat sink."),
        ],
      },
    ],
    files: [
      {
        id: "cray.cfg",
        title: tr("Cray configuration"),
        body: [
          tr("X-MP/E   200 MFLOPS  (1990)  decommissioned"),
          tr("Y-MP98   2.67 GFLOPS (1993)  8 CPU · 128 GB · UNICOS"),
          tr("Cooling  Fluorinert 18.2 °C"),
          tr("Peak     340 kW"),
        ],
      },
    ],
  },
  // Level −2
  {
    id: "term_signal",
    floor: 2,
    room: "signal",
    x: 14,
    z: 28,
    rot: 1,
    label: tr("Signal Lab Console"),
    screen: "wave",
    motd: tr("Noise floor −94 dBm. Somewhere in it: a voice."),
    role: "forschung",
    purpose: tr("Signal analysis: recordings, audits, the channel to the synthesizer."),
    caps: ["signal"],
    feed: ["-94 DBM", "847 HZ", "X0-R8T AUDIT", "KEEP LISTENING"],
    mail: [
      {
        id: "m_signal_audit",
        from: "J.LAWRENCE",
        to: "D.FRIDGE",
        date: "22.06.1991",
        subject: tr("X0-R8T — 847 packets"),
        body: [
          tr("847 autonomous response packets. Not in my code."),
          tr("Before you ask: no, I'm not deleting them. We listen."),
        ],
      },
      {
        id: "m_signal_toene",
        from: "HMS-001",
        to: tr("mail::Console"),
        date: "— Loop —",
        subject: tr("Handshake"),
        requires: { insight: "vier_toene_hinweis" },
        body: [
          tr("Tone sequence expected: four digits, pitch = digit."),
          tr("Enter it here with: signal <digits>"),
        ],
      },
    ],
    files: [
      {
        id: "echo_test.txt",
        title: tr("Transcript “Echo test”"),
        body: [
          tr("[Static] …if you can hear this, Jade, the Echo Recorder works."),
          tr("[Pause 4.2 s]"),
          tr("The lab is not a museum. It is a question."),
        ],
      },
    ],
  },
  {
    id: "term_hangar",
    floor: 2,
    room: "hangar",
    x: 18,
    z: 58,
    rot: 0,
    label: tr("Hangar Flight Control Terminal"),
    screen: "radar",
    role: "leitstand",
    purpose: tr("Flight control: drone status, shaft clearance, HaloRider flight log."),
    feed: [tr("FLIGHT CONTROL"), tr("SHAFT: -4"), "EXD-001", tr("COLLAPSE RISK")],
    mail: [
      {
        id: "m_hangar_schacht",
        from: "T6-GR1M",
        to: tr("Flight control"),
        date: "02.06.2009",
        subject: tr("mail::Shaft"),
        body: [
          tr("Probability of another collapse: low."),
          tr("Prepare anyway. Access by drone only."),
        ],
      },
    ],
    files: [
      {
        id: "flugbuch.txt",
        title: tr("HaloRider flight log (copy)"),
        body: [
          tr("2016  First flight. “Silent zones”: data relationships collapse."),
          tr("2017  v0.3 — matter into the Halo and back. Back is difficult."),
          tr("2018  It wasn't just structured. It was organised."),
        ],
      },
    ],
  },
  {
    id: "term_tresor",
    floor: 2,
    room: "tresor",
    x: 57,
    z: 74,
    rot: 0,
    label: tr("Vault Inventory"),
    screen: "spectrum",
    role: "archiv",
    purpose: tr("Vault inventory: relics, spectral holdings, encrypted transmissions."),
    feed: [tr("RELIC VAULT"), tr("SPECTRUM 9 BANDS"), "03:41", tr("SEALED")],
    files: [
      {
        id: "inventar.lst",
        title: tr("Vault inventory"),
        body: [
          tr("T-01  Tape “Lab log #0512”"),
          tr("T-02  Transmission Nov. 2018 (encrypted)"),
          tr("T-03  Crystal sample, mixed spectral class"),
          tr("T-04  Empty. Label: “for later”"),
        ],
      },
      {
        id: "sendung_2018.enc",
        title: tr("Transmission November 2018 (decrypted)"),
        code: "0341",
        codeHint: tr("Encrypted. Key: the time “when it happened” (HHMM)."),
        body: [
          tr("“We are nearing the heart of the Halo.”"),
          tr("“The anomalies are not just computational artifacts; they appear… orchestrated.”"),
          tr("“Should we fail to return, preserve the findings for humanity.”"),
          tr("“And tell whoever rebuilds the lab: listen first.”"),
        ],
      },
    ],
  },
  // Level −3
  {
    id: "term_forge",
    floor: 3,
    room: "forge",
    x: 47,
    z: 38,
    rot: 0,
    label: tr("Forge Log Station"),
    screen: "reactor",
    motd: tr("HALO-EXP-FINAL · log is read-only."),
    role: "forschung",
    purpose: tr("Forge logs: final test HALO-EXP-FINAL, sensors, load shedding."),
    caps: ["power"],
    feed: ["HALO-EXP-FINAL", tr("847 SENSORS"), tr("0.015 K"), "SIGMA-15"],
    mail: [
      {
        id: "m_forge_mcp",
        from: "MCP v4.7.2",
        to: "J.L., D.F.",
        date: "14.02.2019 03:12:07",
        subject: tr("Recommendation: abort"),
        body: [
          tr("σ-14.3. Recommendation: immediate abort."),
          tr("Reply J.L.: “continue”. Reply D.F.: “continue”."),
        ],
      },
    ],
    files: [
      {
        id: "halo_exp_final.log",
        title: tr("HALO-EXP-FINAL (complete)"),
        code: "1402",
        codeHint: tr("Read-only. Unlock with the date of the final test (DDMM)."),
        body: [
          tr("02:00:14  Session HALO-EXP-FINAL · J.L. 97.3 % · D.F. 94.8 %"),
          tr("02:34:22  Anchoring phase 1 · resonance 89.2 % · correlation 0.847"),
          tr("03:12:07  σ-14.3 · abort recommended · OVERRIDE (both)"),
          tr("03:27:00  σ-15 · tertiary shutdown triggered · not executed"),
          tr("03:41:22  Correlation 1.000 · subjects: present, not at their stations"),
          "03:41:23  —",
        ],
      },
    ],
  },
  {
    id: "term_rechenkern",
    floor: 3,
    room: "rechenkern",
    x: 19,
    z: 102,
    rot: 2,
    label: tr("Compute Core Terminal"),
    screen: "qubits",
    role: "forschung",
    purpose: tr("Compute core: memory dumps, coherence, relay recordings."),
    feed: [tr("QBIT COHERENCE"), "MEM_0X89", "MEM_0X4F", "SIGMA-17"],
    files: [
      {
        id: "mem_0x89.dump",
        title: tr("Memory dump mem_0x89"),
        code: "0X89",
        codeHint: tr("Locked. The address is in the relay log of 04.02.2026 (FRIDGE)."),
        body: [
          tr("[mem_0x89 · STRUGGLING]"),
          tr("I count my thoughts and get a different number every time."),
          tr("Tell Jade the maths holds. Tell her I'm still listening."),
        ],
      },
      {
        id: "mem_0x4f.dump",
        title: tr("Memory dump mem_0x4F"),
        code: "0X4F",
        codeHint: tr("Locked. The address is in the relay log of 04.02.2026 (LAWRENCE)."),
        body: [
          tr("[mem_0x4F · CALM]"),
          tr("I am not absent. I am distributed."),
          tr("Whoever reads this has rebuilt the lab. Thank you. Keep building."),
        ],
      },
    ],
  },
  {
    id: "term_reaktor",
    floor: 3,
    room: "reaktor",
    x: 14,
    z: 33,
    rot: 1,
    label: tr("Reactor Control Room"),
    screen: "reactor",
    role: "wartung",
    purpose: tr("Reactor control: load, SCRAM log, load shedding via relays."),
    caps: ["power"],
    feed: [tr("REACTOR CONTROL"), tr("SCRAM ARMED"), tr("COOLING THM-001"), tr("LOAD")],
    mail: [
      {
        id: "m_reaktor_scram",
        from: "MCP-000",
        to: tr("Reactor control"),
        date: "28.01.2019",
        subject: tr("SCRAM test"),
        body: [
          tr("Auto-SCRAM tested: 0.8 s. Cooling via THM-001 mandatory."),
          tr("Without the Thermal Manager, tier-3 consumers stay locked."),
        ],
      },
    ],
    files: [
      {
        id: "scram.log",
        title: tr("SCRAM log"),
        body: [
          tr("2014-07-09  SCRAM (overtemperature) — cause: coffee machine on the singularity bus."),
          "2017-03-30  SCRAM (Test) — OK.",
          "2019-01-28  SCRAM (Test) — OK.",
          tr("2019-02-14  no SCRAM. The load dropped by itself."),
        ],
      },
    ],
  },
  // Level +1
  {
    id: "term_observatorium",
    floor: 4,
    room: "observatorium",
    x: 26,
    z: 25,
    rot: 1,
    label: tr("Observatory Terminal"),
    screen: "radar",
    motd: tr("Tracking off. The sky over Cottbus: cloudy, for 2,561 days."),
    role: "forschung",
    purpose: tr("Observatory: observation log, sky survey, C8-BR41N's recording."),
    feed: [tr("TRACKING OFF"), tr("SKY: NOTHING"), "04:33", "[EXTERNAL]"],
    files: [
      {
        id: "beobachtung.log",
        title: tr("Observation log (terminal copy)"),
        body: [
          tr("14.08.2018  nothing."),
          tr("02.11.2018  nothing."),
          tr("15.01.2019  04:33 — nothing in the sky. C8-BR41N reports a voice without a source."),
        ],
      },
      {
        id: "external_0433.log",
        title: tr("external.log (raw data)"),
        code: "0433",
        codeHint: tr("Locked. The time of the voice without a source (HHMM)."),
        body: [
          "[EXTERNAL]: We are what persists between your measurements.",
          "[EXTERNAL]: The door opens from the inside.",
          tr("C8-BR41N: Classification impossible. I call it a visit."),
        ],
      },
    ],
  },
  {
    id: "term_bibliothek",
    floor: 4,
    room: "bibliothek",
    x: 73,
    z: 102,
    rot: 2,
    label: tr("Library Catalogue"),
    screen: "text",
    motd: tr("Catalogue of the lab library. Shelf marks by Dewey, exceptions by Damien."),
    role: "archiv",
    purpose: tr("Library catalogue: shelf marks, loans, the Cottbus reserve shelf."),
    feed: [tr("LIBRARY"), "DEWEY 530.12", "COTTBUS 1989", tr("SLIDE 7")],
    mail: [
      {
        id: "m_biblio_mahnung",
        from: tr("mail::Catalogue"),
        to: "D.FRIDGE",
        date: "01.02.2019",
        subject: tr("3rd reminder"),
        body: [
          tr("“Topology of Moving Spaces” has been overdue since 1990."),
          tr("Fee: 847 coffee tokens."),
        ],
      },
    ],
    files: [
      {
        id: "signaturen.txt",
        title: tr("Shelf marks (excerpt)"),
        body: [
          tr("530.12  Quantum mechanics        J.L."),
          tr("621.39  Computer architecture    D.F."),
          tr("004.8   Pattern recognition      F1N-DR"),
          tr("???     “Exceptions”             D.F."),
        ],
      },
      {
        id: "raum214.txt",
        title: tr("Cottbus 1989 reserve shelf"),
        code: "214",
        codeHint: tr("Reserve shelf locked. Shelf mark: the lecture hall in Building K."),
        body: [
          tr("Slide 7: The observation operator is not idempotent."),
          tr("Margin note J.L.: Repeated self-observation changes what is observed."),
          tr("Margin note D.F.: Then stop observing yourself. — J.L.: No."),
        ],
      },
    ],
  },
  {
    id: "term_kantine",
    floor: 4,
    room: "kantine",
    x: 87,
    z: 74,
    rot: 0,
    label: tr("Canteen Terminal"),
    screen: "text",
    motd: tr("MENU: Coffee. Coffee (decaf, 2019). Coffee."),
    role: "kantine",
    purpose: tr("Canteen: menu, circulars, the machine's operating manual."),
    feed: [tr("MENU WEEK 07"), tr("LENTIL SOUP"), tr("COFFEE"), tr("CLOSED THU")],
    mail: [
      {
        id: "m_kantine_rund",
        from: tr("Facility management"),
        to: tr("mail::everyone"),
        date: "10.02.2019",
        subject: tr("Canteen closed Thu"),
        body: [
          tr("Thursday, 14.02.: canteen closed (final test)."),
          tr("There will be lentil soup anyway."),
        ],
      },
      {
        id: "m_kantine_re",
        from: "D.FRIDGE",
        to: tr("mail::everyone"),
        date: "10.02.2019",
        subject: tr("Re: Canteen closed Thu"),
        body: [tr("Why lentils?")],
      },
    ],
    files: [
      {
        id: "kaffee.txt",
        title: tr("Coffee machine — maintenance"),
        // Stored code is ZWEIMAL; terminal-lite also accepts TWICE (English).
        code: "ZWEIMAL",
        codeHint: tr("Locked. How many times do you hit the machine? In words."),
        body: [
          tr("The machine is on the singularity bus. That's why the coffee tastes of tomorrow."),
          tr("Don't hit it three times. On the third time it answers."),
        ],
      },
    ],
  },
  {
    id: "term_jadeq",
    floor: 4,
    room: "jadeq",
    x: 100,
    z: 22,
    rot: 0,
    label: tr("Jade's Private Terminal"),
    screen: "log",
    motd: tr("Welcome back, jade. You have 1 unread message from yourself."),
    role: "privat",
    purpose: tr("Jade's private terminal: mail to herself, notes, cerulean."),
    feed: ["JADE", tr("1 UNREAD"), "490 NM", tr("DISTRIBUTED")],
    mail: [
      {
        id: "m_jade_selbst",
        from: "jade",
        to: "jade",
        date: "13.02.2019 23:59",
        subject: tr("In case you don't remember"),
        body: [
          tr("If you're reading this and don't remember writing it: good."),
          tr("That means it worked. Or it didn't work and you're here anyway."),
          tr("Either is a beginning. Listen before you build."),
        ],
      },
      {
        id: "m_jade_mama",
        from: "jade",
        to: tr("(nobody)"),
        date: "1995",
        subject: tr("mail::Mum"),
        body: [
          tr("She no longer recognises her handwriting from last week."),
          tr("I still recognise mine. Still."),
        ],
      },
      {
        id: "m_jade_laeuft",
        from: "[EXTERNAL]",
        to: "jade",
        date: "15.02.2026 03:41:22",
        subject: tr("The experiment is running"),
        requires: { insight: "experiment_laeuft" },
        body: [tr("The experiment has not failed."), tr("The experiment is running.")],
      },
    ],
    files: [
      {
        id: "cerulean.txt",
        title: "Cerulean",
        code: "490",
        codeHint: tr("Locked. The colour as a number (nanometres)."),
        body: [
          tr("I can describe cerulean. I cannot inhabit it."),
          tr("If I ever see it again, I'll know I'm back."),
          tr("Until then: 490 nanometres. A fact I own."),
        ],
      },
    ],
  },
];

export const ROOM_TERMINAL_BY_ID: ReadonlyMap<string, RoomTerminalDef> = new Map(
  ROOM_TERMINALS.map((t) => [t.id, t]),
);

// ── Model ────────────────────────────────────────────────────────

/** Model size in model voxels (w × h × d) — 3 × 5 × 2 world units. */
export const ROOM_TERMINAL_SIZE = { w: 6, h: 10, d: 4 } as const;

let cached: Model | null = null;

/**
 * Wall kiosk: cabinet with a keyboard ledge and a slanted-looking CRT
 * housing; front = +z, back against the wall at z = 0.
 */
export function roomTerminalModel(): Model {
  if (cached) return cached;
  const { w, h, d } = ROOM_TERMINAL_SIZE;
  const m = new Model(w, h, d);
  // Cabinet.
  m.box(0, 0, 0, w - 1, 4, d - 2, C.metal_dark);
  m.box(0, 0, d - 1, w - 1, 0, d - 1, C.metal_dark);
  m.box(1, 1, d - 2, w - 2, 3, d - 2, C.metal);
  m.set(1, 2, d - 2, C.led_green).set(2, 2, d - 2, C.led_amber);
  // Keyboard ledge.
  m.box(0, 4, d - 1, w - 1, 4, d - 1, C.metal);
  m.box(1, 4, d - 1, w - 2, 4, d - 1, C.black);
  // CRT housing.
  m.box(0, 5, 0, w - 1, h - 1, d - 2, C.metal);
  m.box(0, h - 1, 0, w - 1, h - 1, d - 2, C.metal_dark);
  // Screen (the live screen plane sits in front of it).
  m.box(1, 6, d - 2, w - 2, h - 2, d - 2, C.crt_bg);
  // Warning stripe on the cabinet top edge.
  for (let x = 0; x < w; x++) m.set(x, 0, 0, x % 2 ? C.safety_yellow : C.hazard_black);
  cached = m;
  return m;
}

/** World units per model voxel of the terminal model. */
export const ROOM_TERMINAL_SCALE = MODEL_SCALE;

/**
 * Live screen of a terminal (model voxel coords of `roomTerminalModel`).
 * `text` carries the terminal's feed (or motd): the screen renderers show it
 * as a caption / typed text, so every terminal looks distinct.
 */
export function roomTerminalScreen(
  def: Pick<RoomTerminalDef, "screen" | "motd" | "feed">,
): ScreenSpec {
  const { w, h, d } = ROOM_TERMINAL_SIZE;
  const lines = def.feed?.length ? def.feed : def.motd ? [def.motd] : [];
  return {
    ...(lines.length ? { text: lines.join("\n") } : {}),
    center: [w / 2, (6 + h - 1) / 2, d - 1],
    w: w - 2,
    h: h - 7,
    normal: "+z",
    content: def.screen,
    requiresPower: true,
  };
}
