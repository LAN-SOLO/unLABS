/**
 * Device interface registry: one spec per device (tests/world/device-ui.test.ts
 * requires every device + MCP-000 to have its own).
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { TIER1_UI } from "@/lib/world/device-ui/specs/tier1";
import { TIER2_UI } from "@/lib/world/device-ui/specs/tier2";
import { TIER3_UI } from "@/lib/world/device-ui/specs/tier3";
import { drawW } from "@/lib/world/device-ui/metrics";
import type { DeviceUiSpec } from "@/lib/world/device-ui/types";

export * from "@/lib/world/device-ui/types";

export const DEVICE_UI: ReadonlyMap<string, DeviceUiSpec> = new Map(
  [...TIER1_UI, ...TIER2_UI, ...TIER3_UI].map((u) => [u.id, u]),
);

/** Minimal faceplate for a device without its own spec (never shipped: the test demands one each). */
function fallback(id: string): DeviceUiSpec {
  return {
    id,
    model: DEVICE_BY_ID.get(id)?.name ?? id,
    face: "console",
    font: "mono",
    accent: "#33ff33",
    plate: "#1b1f1b",
    boot: [],
    pages: [
      {
        id: "status",
        label: tr("Status"),
        widgets: [
          { kind: "readout", label: tr("Draw"), value: (c) => drawW(c), unit: "W" },
          { kind: "button", label: tr("Read out"), action: "use" },
        ],
      },
    ],
  };
}

export function deviceUi(id: string): DeviceUiSpec {
  return DEVICE_UI.get(id) ?? fallback(id);
}
