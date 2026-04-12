# UnstableLabs — Device Registry

Complete documentation for all 37 devices installed in the \_unOS laboratory system.

## Directory Structure

```
devices/
├── README.md                              ← You are here
├── tier-1/                                ← 19 devices (foundational)
├── tier-2/                                ← 11 devices (advanced)
└── tier-3/                                ←  7 devices (elite)
```

Each device folder contains:

- `DEVICE-ID.md` — Full device documentation (specs, commands, states, source files)
- `firmware.json` — Firmware metadata export (version, checksum, features, power specs)

---

## Device Overview by Tier

### Tier 1 — Foundational (19 devices)

| ID      | Device                | Version | Category | Group                   |
| ------- | --------------------- | ------- | -------- | ----------------------- |
| ATK-001 | Abstractum Tank       | v2.1.0  | Storage  | Exploration & Resources |
| BAT-001 | Battery Pack          | v1.8.0  | Storage  | Power & Energy          |
| BTK-001 | Basic Toolkit         | v1.2.0  | Light    | Tools & Fabrication     |
| CDC-001 | Crystal Data Cache    | v1.4.2  | Medium   | Data & Communications   |
| CLK-001 | Lab Clock             | v2.4.0  | Light    | System                  |
| CPU-001 | CPU Monitor           | v3.2.1  | Light    | Compute & Memory        |
| ECR-001 | Echo Recorder         | v1.1.0  | Light    | Data & Communications   |
| MEM-001 | Memory Monitor        | v3.1.0  | Light    | Compute & Memory        |
| MSC-001 | Material Scanner      | v1.3.0  | Light    | Tools & Fabrication     |
| NET-001 | Network Monitor       | v2.1.0  | Light    | Data & Communications   |
| PWB-001 | Portable Workbench    | v1.1.0  | Light    | Tools & Fabrication     |
| PWD-001 | Power Display Panel   | v1.0.0  | Monitor  | Power & Energy          |
| PWR-001 | Power Management Sys. | v1.0.0  | Control  | Power & Energy          |
| RMG-001 | Resource Magnet       | v1.2.0  | Medium   | Exploration & Resources |
| SPK-001 | Narrow Speaker        | v1.0.0  | Light    | Data & Communications   |
| TMP-001 | Temperature Monitor   | v1.0.0  | Light    | Thermal & Environmental |
| THM-001 | Thermal Manager       | v1.0.0  | Control  | Thermal & Environmental |
| VNT-001 | Ventilation System    | v1.0.0  | Light    | Thermal & Environmental |
| VLT-001 | Volt Meter Display    | v1.0.0  | Monitor  | Power & Energy          |

### Tier 2 — Advanced (11 devices)

| ID      | Device               | Version | Category  | Group                   |
| ------- | -------------------- | ------- | --------- | ----------------------- |
| AND-001 | Anomaly Detector     | v2.3.0  | Medium    | Quantum & Dimensional   |
| DGN-001 | Diagnostics Console  | v2.0.4  | Light     | System                  |
| DIM-001 | Dimension Monitor    | v1.0.0  | Light     | Quantum & Dimensional   |
| EXD-001 | Explorer Drone       | v3.1.2  | Heavy     | Exploration & Resources |
| HMS-001 | Handmade Synthesizer | v3.2.1  | Medium    | Tools & Fabrication     |
| INT-001 | Interpolator         | v2.5.3  | Medium    | Data & Communications   |
| LCT-001 | Precision Laser      | v2.1.0  | Heavy     | Tools & Fabrication     |
| OSC-001 | Oscilloscope Array   | v4.6.0  | Analysis  | Data & Communications   |
| P3D-001 | 3D Fabricator        | v3.2.1  | Heavy     | Tools & Fabrication     |
| QCP-001 | Quantum Compass      | v1.5.0  | Light     | Quantum & Dimensional   |
| UEC-001 | Unstable Energy Core | v2.0.1  | Generator | Power & Energy          |

### Tier 3 — Elite (7 devices)

| ID      | Device                    | Version | Category  | Group                   |
| ------- | ------------------------- | ------- | --------- | ----------------------- |
| AIC-001 | AI Assistant Core         | v2.4.0  | Heavy     | Compute & Memory        |
| EMC-001 | Exotic Matter Containment | v4.0.1  | Heavy     | Exploration & Resources |
| MFR-001 | Microfusion Reactor       | v2.3.0  | Generator | Power & Energy          |
| QAN-001 | Quantum Analyzer          | v3.7.2  | Heavy     | Quantum & Dimensional   |
| QSM-001 | Quantum State Monitor     | v1.2.0  | Heavy     | Quantum & Dimensional   |
| SCA-001 | Supercomputer Array       | v5.2.0  | Heavy     | Compute & Memory        |
| TLP-001 | Teleport Pad              | v2.2.0  | Heavy     | Quantum & Dimensional   |

---

## Functional Groups

| Group                       | Devices                                              |
| --------------------------- | ---------------------------------------------------- |
| **Power & Energy**          | UEC-001, MFR-001, BAT-001, PWR-001, PWD-001, VLT-001 |
| **Compute & Memory**        | CPU-001, MEM-001, SCA-001, AIC-001                   |
| **Quantum & Dimensional**   | QAN-001, QSM-001, QCP-001, DIM-001, AND-001, TLP-001 |
| **Data & Communications**   | CDC-001, NET-001, ECR-001, INT-001, OSC-001, SPK-001 |
| **Thermal & Environmental** | TMP-001, THM-001, VNT-001                            |
| **Tools & Fabrication**     | BTK-001, MSC-001, LCT-001, P3D-001, HMS-001          |
| **Exploration & Resources** | EXD-001, RMG-001, ATK-001, EMC-001                   |
| **System**                  | DGN-001, CLK-001, PWB-001                            |

---

## Power Categories

| Category      | Description        | Devices                                                                                                                      |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Generator** | Produces energy    | UEC-001, MFR-001                                                                                                             |
| **Storage**   | Stores energy      | BAT-001                                                                                                                      |
| **Heavy**     | >20 E/s full load  | AIC-001, SCA-001, TLP-001, QAN-001, EMC-001, QSM-001, EXD-001, LCT-001, P3D-001                                              |
| **Medium**    | 5–20 E/s full load | CDC-001, HMS-001, IPL/INT-001, AND-001, RMG-001                                                                              |
| **Light**     | <5 E/s full load   | VNT-001, TMP-001, DIM-001, MSC-001, NET-001, DGN-001, SPK-001, QCP-001, BTK-001, PWB-001, CPU-001, MEM-001, CLK-001, ECR-001 |

---

## Tech Trees

| Tree               | Devices                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Tech**           | CDC-001 (T1), UEC-001 (T1), BAT-001 (T2), MFR-001 (T2), AIC-001 (T3), SCA-001 (T4) |
| **Infrastructure** | VNT-001, NET-001, TMP-001, CPU-001, CLK-001, MEM-001 (all T1)                      |
| **Science**        | AND-001 (T2), QAN-001 (T2), EMC-001 (T3)                                           |
| **Quantum**        | QSM-001 (T2), DIM-001 (T3)                                                         |
| **Exploration**    | EXD-001 (T2), QCP-001 (T2)                                                         |
| **Audio**          | SPK-001 (T1), OSC-001 (T2)                                                         |
| **Synthesizers**   | HMS-001 (T1)                                                                       |
| **Adapters**       | ECR-001 (T1)                                                                       |
| **Optics**         | INT-001 (T1)                                                                       |
| **Economy**        | RMG-001 (T1), ATK-001 (T1)                                                         |

---

## Terminal Commands

All devices are accessible via the `device` command:

```
device                    # List all devices
device [name]             # Query specific device
```

Individual device commands:

```
aic, and, bat, btk, cdc, clk, cpu, dgn, dim, ecr, emc,
exd, hms, ipl, lct, mem, mfr, msc, net, p3d, power,
pwb, qcp, qsm, qua, rmg, sca, spk, thermal, tlp, tmp,
uec, vnt
```

---

## Source Architecture

- **Manager Contexts**: `contexts/[XXX]Manager.tsx` — React context providers with device state, firmware, power specs, and actions
- **Terminal Commands**: `lib/terminal/commands.ts` — CLI command definitions
- **Type Definitions**: `lib/terminal/types.ts` — Device state/action interfaces
- **DB Types**: `types/devices.ts` — Database schema types (Device, DeviceRuntimeState, etc.)
- **API Layer**: `lib/api/devices.ts` — Supabase CRUD for device queries, state management, combinations, tweaks
- **Kernel Layer**: `lib/unos/devices.ts` — OS-level device manager (14 core devices)
- **Components**: `components/panel/modules/` — UI panel modules (VentilationFan, NarrowSpeaker, etc.)
- **Hook Wiring**: `hooks/useTerminal.ts` — Connects manager contexts to terminal DataFetchers
- **Instantiation**: `components/terminal/Terminal.tsx` — Creates all manager refs and device action objects
