/**
 * Device hubs of the Lab World (content).
 * =======================================
 *
 * Some devices can connect other devices through their interface and then
 * manage them: switch them, read them out, push firmware, prioritise them.
 * A hub has one bus; a device can hang on several hubs, but on each bus only
 * once. Rules in lib/world/links.ts / device-ops.ts.
 *
 * - `admin`   MCP-000 — lab administration: remote switching from anywhere,
 *             firmware push (`mcp` updates), registry readouts.
 * - `data`    NET-001 — network: remote readouts, firmware mirror (`net`),
 *             signal feeds between devices.
 * - `power`   PWR-001 — power routing: linked consumers are served first in
 *             a brownout.
 * - `thermal` THM-001 — cooling loops: linked machines draw 10 % less
 *             (20 % with THM-001's `loop-balancer` update).
 * - `diag`    DGN-001 — diagnostics: health lines for linked devices in the
 *             console readout (+ pending updates with `deep-scan`).
 * - `compute` SCA-001 — compute mesh (own level only): +1 research point
 *             per Nexus cycle for each online linked machine; TLP-001's
 *             portal stage needs AIC-001 on the mesh.
 *
 * Mandatory links on the main path: ECR-001 on NET-001 (SPK-001 focus
 * stage) and AIC-001 on SCA-001 (TLP-001 portal stage).
 *
 * German in lib/i18n/de/links.ts.
 */
import { tr } from "@/lib/i18n";
import type { Condition } from "@/lib/world/types";

export type LinkBus = "admin" | "data" | "power" | "thermal" | "diag" | "compute";

export interface HubDef {
  /** Hub device id. */
  id: string;
  bus: LinkBus;
  /** Name of the link panel in the hub's interface. */
  label: string;
  /** What linking does (shown in the interface and the archive). */
  text: string;
  /** How many devices the hub can hold. */
  capacity: number;
  /** `floor` = same floor only, `lab` = anywhere (needs NET-001 for cross-floor data). */
  range: "floor" | "lab";
  /** Devices that can be linked (omitted = every buildable device except hubs of the same bus). */
  accepts?: readonly string[];
  /** Extra condition before the hub can link at all (e.g. a firmware feature). */
  requires?: Condition;
  requiresHint?: string;
}

export const BUS_LABEL: Readonly<Record<LinkBus, string>> = {
  admin: tr("bus::Admin"),
  data: tr("bus::Data"),
  power: tr("bus::Power"),
  thermal: tr("bus::Thermal"),
  diag: tr("bus::Diagnostics"),
  compute: tr("bus::Compute"),
};

export const HUBS: readonly HubDef[] = [
  {
    id: "MCP-000",
    bus: "admin",
    label: tr("Device registry"),
    text: tr(
      "The MCP administers linked devices: switch them from here, read their state, push firmware updates held in its registry.",
    ),
    capacity: 8,
    range: "lab",
  },
  {
    id: "NET-001",
    bus: "data",
    label: tr("Network segments"),
    text: tr(
      "Linked devices share data over the lab network: their readouts appear on NET-001, signal feeds reach other devices, and — once NET-001 runs its firmware mirror — update images are downloaded.",
    ),
    capacity: 10,
    range: "lab",
  },
  {
    id: "PWR-001",
    bus: "power",
    label: tr("Priority circuits"),
    text: tr("Linked consumers are served first when the grid runs short."),
    capacity: 6,
    range: "lab",
  },
  {
    id: "THM-001",
    bus: "thermal",
    label: tr("Cooling loops"),
    text: tr(
      "Linked machines are on a monitored cooling loop and draw 10 % less power while the Thermal Manager runs (20 % with its loop balancer).",
    ),
    capacity: 6,
    range: "lab",
  },
  {
    id: "DGN-001",
    bus: "diag",
    label: tr("Diagnostic probes"),
    text: tr(
      "Linked devices report their health in the console's readout — no power, overheating, switched off — and, after a deep-scan update, their pending firmware.",
    ),
    capacity: 6,
    range: "lab",
  },
  {
    id: "SCA-001",
    bus: "compute",
    label: tr("Compute mesh"),
    text: tr(
      "Linked machines on this level borrow the array's nodes for heavy calculations; their idle cycles add 1 research point per Nexus cycle each. The Teleport Pad's portal maths needs the AI core on the mesh.",
    ),
    capacity: 4,
    range: "floor",
  },
];

export const HUB_BY_ID: ReadonlyMap<string, HubDef> = new Map(HUBS.map((h) => [h.id, h]));
