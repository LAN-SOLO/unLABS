# NXS-01 — Nexus

## Overview

| Field     | Value                            |
| --------- | -------------------------------- |
| Device ID | NXS-01                           |
| Full Name | Nexus                            |
| Version   | v1.0.0                           |
| Tier      | 2                                |
| Tech Tree | Gadgets (tree-tier 2)            |
| Category  | Light                            |
| Group     | Research & Visualization         |
| Manager   | `contexts/NexusManager.tsx`      |
| Component | `components/nexus/TechGraph.tsx` |

## Description

The Nexus is a salvaged holo-projector repurposed into a research visualizer. It renders the Lab's deterministic tech graph as a floating 3-D force-directed network — each node a potential upgrade, each edge a dependency. Previous operators called it "the map you have to build before you can read the map." Damien insists it was originally a very expensive aquarium lamp.

The Nexus is the gate for the entire research subsystem: no research job can be started without one booted and online. Build cost is the gameplay gate between Phases 3 and 4. When online, the `research` terminal command and the in-terminal `nexus` app become available.

## Firmware

| Field          | Value      |
| -------------- | ---------- |
| Version        | 1.0.0      |
| Build          | 2026.04.24 |
| Checksum       | NX10A4F2   |
| Security Patch | 2026.04.24 |

### Features

- tech-graph-render
- research-queue
- prereq-resolver
- holo-projection

## Power Specifications

| Mode      | Draw (E/s) |
| --------- | ---------- |
| Full Load | 45         |
| Idle      | 12         |
| Standby   | 2          |

- **Power Category**: light
- **Priority**: P2

## Build Requirements

| Resource    | Cost |
| ----------- | ---- |
| Base Alloy  | 150  |
| Power Cells | 50   |
| \_unSC      | 40   |

### Prerequisites

- UEC-001 online
- EP2 Step 3 completed (journal unlocked, Abstractum bottleneck observed)

## Operational Specifications

| Field             | Value                |
| ----------------- | -------------------- |
| Graph Node Cap    | 256 concurrent nodes |
| Active Jobs       | 1 research job       |
| Projection Volume | 0.4 m³ holo-field    |
| Refresh Rate      | 30 Hz                |

## Terminal Command

```
nexus [status|focus <node>|reset|auto|firmware|info]
```

**Aliases**: nxs, nexus01, tree

### Subcommands

- `status` — Show device status and current research job
- `focus <node>` — Center graph on a tech-tree node
- `reset` — Cancel the current research job
- `auto` — Enable "suggest next" auto-pathing (firmware v1.2+)
- `firmware` — Show firmware info
- `info` — Show device information

### Related Commands

- `research [list|start <id>|status|cancel]` — top-level research control (requires NXS-01 online)
- `run nexus` — launch the full-screen in-terminal app

## Device States

`booting` -> `online` -> `projecting` | `rebooting` | `shutdown` -> `standby`

## Narrative

First encountered in EP2 Step 4 ("Build the Nexus"), triggered by the Jade Lawrence log fragment:

> "…if you're reading this, you've found the Nexus. Build it. The tree was never for us. It's for you."

## Source Files

- Manager: `contexts/NexusManager.tsx`
- Component: `components/nexus/TechGraph.tsx`
- Panel Module: `components/panel/modules/NexusModule.tsx`
- Firmware: `firmware.json`
- Tech Tree Data: `lib/game/techTree/catalog.ts`
