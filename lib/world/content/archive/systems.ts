/**
 * Archive entries about firmware, links and device networks (checksums of
 * service images, hub manuals, wiring notes) — placed anywhere in the lab.
 * See ./types.ts for the rules. German in lib/i18n/de/archive-systems.ts.
 *
 * Manual service images (content/firmware.ts, source `manual`) need their
 * checksum typed by hand; every one of them is written down here (or, for
 * NET-001, in floor0.ts) in the form "<ID> · service image <version> · CRC
 * <checksum>" — tests/world/firmware-links.test.ts checks that.
 */
import { tr } from "@/lib/i18n";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export const ARCHIVE_SYSTEMS: readonly ArchiveEntry[] = [
  // ── How service images work ─────────────────────────────────────
  {
    id: "sys_service_images",
    tier: 1,
    value: 2,
    topic: "firmware",
    title: tr("Service images"),
    text: tr(
      "Chalk, Jade's hand:\nEVERY device carries a service image on board. The flasher only takes it if you TYPE the checksum — eight characters, off the label.\nThe labels never stay on the housings (heat). I keep the spares where the air moves or where the paper piles up. Search.",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:werkstatt:a2" },
    about: [{ kind: "firmware", id: "NET-001" }],
  },
  {
    id: "sys_vnt_checksum",
    tier: 2,
    value: 1,
    topic: "firmware",
    title: tr("Ventilation maintenance card"),
    text: tr(
      "A maintenance card, filed under V:\nVNT-001 · service image 1.1.0 · CRC F5C9A2D8\n“Quiet mode. For when the MCP complains about the draught.” — J.L.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:kontroll:a10" },
    about: [{ kind: "firmware", id: "VNT-001" }],
  },
  {
    id: "sys_btk_checksum",
    tier: 2,
    value: 2,
    topic: "firmware",
    title: tr("Toolkit label strip"),
    text: tr(
      "A label strip behind the screwdriver tin:\nBTK-001 · service image 1.3.0 · CRC D6F2A9C4\nPencil underneath: “torque profiles — two-part things come apart in one piece each. D., stop prying with the flat one.”",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:werkstatt:a14" },
    about: [{ kind: "firmware", id: "BTK-001" }],
  },
  {
    id: "sys_lct_checksum",
    tier: 3,
    value: 2,
    topic: "firmware",
    title: tr("Laser shipping slip"),
    text: tr(
      "The shipping slip of the laser, still in its box:\nLCT-001 · service image 2.2.0 · CRC C4E8B2F6\nStamped: “ADAPTIVE FOCUS — ACTIVATE ON SITE”. Nobody did.",
    ),
    find: "search",
    at: { decor: "decor:fertigung:p6" },
    about: [{ kind: "firmware", id: "LCT-001" }],
  },
  {
    id: "sys_mfr_checksum",
    tier: 3,
    value: 3,
    topic: "firmware",
    title: tr("Reactor commissioning log"),
    text: tr(
      "A commissioning log, coffee-stained, page 14:\nMFR-001 · service image 2.4.0 · CRC C6F2A8D4\n“Fuel auto-tune gives +35 W. D.F. refused: ‘it was fine at 250’. It was not fine at 250.” — J.L.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:reaktor:p2" },
    about: [
      { kind: "firmware", id: "MFR-001" },
      { kind: "device", id: "MFR-001" },
    ],
  },
  {
    id: "sys_net_label",
    tier: 2,
    value: 2,
    topic: "firmware",
    title: tr("NET-001: label missing"),
    text: tr(
      "Service image 2.2.0 on board. Checksum: [LABEL MISSING].\nA sticky note on the housing: “Spare label → Outer Airlock, behind one of the grilles. Search both if you must. — J.L.”",
    ),
    by: "J.L.",
    find: "device",
    at: { device: "NET-001" },
    about: [
      { kind: "firmware", id: "NET-001" },
      { kind: "device", id: "EXD-001" },
    ],
  },
  {
    id: "sys_mirror_index",
    tier: 2,
    value: 2,
    topic: "firmware",
    title: tr("Mirror index"),
    text: tr(
      "fw-mirror: images cached for EXD-001, RMG-001, MSC-001, CDC-001, BAT-001, P3D-001, AIC-001, MEM-001.\nLink the device here, then flash it from its own Firmware page (or from this Links page).",
    ),
    by: "NET-001",
    find: "device",
    at: { device: "NET-001" },
    when: { firmware: "NET-001", min: "2.2.0" },
    whenHint: tr("The mirror index is empty. The network runs its factory firmware."),
    about: [{ kind: "hub", id: "NET-001" }],
  },
  // ── Hubs ────────────────────────────────────────────────────────
  {
    id: "sys_hubs",
    tier: 1,
    value: 2,
    topic: "network",
    title: tr("Hubs of this facility"),
    text: tr(
      "Six devices can connect others (their interface has a Links page):\nMCP-000 registry · NET-001 network · PWR-001 priority circuits · THM-001 cooling loops · DGN-001 probes · SCA-001 compute mesh.\nA device hangs on each kind of hub at most once. Unlinking is free. I recommend reading the labels on the ports. Nobody ever has.",
    ),
    by: "MCP-000",
    find: "device",
    at: { device: "MCP-000" },
    about: [
      { kind: "hub", id: "MCP-000" },
      { kind: "hub", id: "NET-001" },
    ],
  },
  {
    id: "sys_registry",
    tier: 2,
    value: 2,
    topic: "firmware",
    title: tr("Registry: pending pushes"),
    text: tr(
      "Updates held in my registry, waiting for their devices to be added:\nPWR-001 · NXS-01 · CLK-001 · DGN-001 · THM-001 · TLP-001 · EMC-001 · QSM-001.\nAdd a device under Links, flash it, remove it again if you need the slot. I will not take it personally.",
    ),
    by: "MCP-000",
    find: "device",
    at: { device: "MCP-000" },
    when: { device: "PWR-001", state: "built" },
    whenHint: tr("The registry lists nothing that is actually standing here yet."),
    about: [{ kind: "hub", id: "MCP-000" }],
  },
  {
    id: "sys_echo_feed",
    tier: 2,
    value: 2,
    topic: "network",
    title: tr("Echo feed"),
    text: tr(
      "Output: 24-bit echo stream, port NET. Consumers: Narrow Speaker (focus stage).\nWithout a network link the stream stays in this box. Like the echoes did, for seven years.",
    ),
    by: "ECR-001",
    find: "device",
    at: { device: "ECR-001" },
    about: [
      { kind: "hub", id: "NET-001" },
      { kind: "device", id: "SPK-001" },
    ],
  },
  {
    id: "sys_fusion_sequencer",
    tier: 2,
    value: 3,
    topic: "power",
    title: tr("Fusion start sequence"),
    text: tr(
      "Load-shedding profile for a fusion ignition: NOT INSTALLED.\nImage 1.1.0 is held by the MCP. Add PWR-001 to the MCP's device registry, then flash here. The reactor's plasma stage will not spin up without it.",
    ),
    by: "PWR-001",
    find: "device",
    at: { device: "PWR-001" },
    when: { device: "NXS-01", state: "built" },
    whenHint: tr("A greyed-out profile slot: “fusion”. Nothing here needs it yet."),
    about: [
      { kind: "firmware", id: "PWR-001" },
      { kind: "device", id: "MFR-001" },
    ],
  },
  {
    id: "sys_thermal_loops",
    tier: 1,
    value: 2,
    topic: "power",
    title: tr("Loop chart"),
    text: tr(
      "A laminated chart next to the gauges:\nMachines on a THM loop run cooler and draw about a tenth less. Balanced loops: a fifth.\nHeavy consumers first. — J.L.",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:kuehlung:a6" },
    about: [{ kind: "hub", id: "THM-001" }],
  },
  {
    id: "sys_probes",
    tier: 1,
    value: 2,
    topic: "devices",
    title: tr("Probe any device"),
    text: tr(
      "Probe ports: 6. A probed device reports into my readout — no power, overheating, switched off.\nWith deep scan I also report which firmware each probe is still waiting for, and where it comes from.",
    ),
    by: "DGN-001",
    find: "device",
    at: { device: "DGN-001" },
    about: [{ kind: "hub", id: "DGN-001" }],
  },
  {
    id: "sys_compute_mesh",
    tier: 2,
    value: 3,
    topic: "network",
    title: tr("Mesh jobs"),
    text: tr(
      "Queued job: PORTAL-COORD (TLP-001). Requires an AI core on the mesh — link AIC-001 here.\nIdle mesh cycles are donated to the Nexus research queue: +1 point per cycle for each machine on the mesh.",
    ),
    by: "SCA-001",
    find: "device",
    at: { device: "SCA-001" },
    about: [
      { kind: "hub", id: "SCA-001" },
      { kind: "device", id: "TLP-001" },
    ],
  },
  {
    id: "sys_deep_scan_ghost",
    tier: 4,
    value: 3,
    topic: "lore",
    title: tr("Address 0x0089"),
    text: tr(
      "Deep scan, full bus: 38 devices answer. A 39th address, 0x0089, acknowledges every packet and never sends one.\nLast registered by: D.F., 2019-02-14, 03:27. Device class: “crystal”.",
    ),
    by: "DGN-001",
    find: "device",
    at: { device: "DGN-001" },
    when: { firmware: "DGN-001", min: "2.1.0" },
    whenHint: tr(
      "The bus scan stops at the first 38 addresses. A deeper scan needs newer firmware.",
    ),
    about: [{ kind: "ending", id: "kristall" }],
  },
];
