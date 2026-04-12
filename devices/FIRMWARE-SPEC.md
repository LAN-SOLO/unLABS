# \_unOS Firmware Specification

> Master specification for all device firmware in the UnstableLabs ecosystem.
> Revision 1.0 — 2026.02.23

---

## 1. Firmware Manifest Schema

Every device directory MUST contain a `firmware.json` file conforming to the following schema:

```json
{
  "device_id": "XXX-001",
  "device_name": "Human-Readable Device Name",
  "tier": 1,
  "firmware": {
    "version": "1.0.0",
    "build": "YYYY.MM.DD",
    "checksum": "A1B2C3D4",
    "features": ["feature-a", "feature-b"],
    "securityPatch": "YYYY.MM.DD"
  },
  "power": {
    "full": 10,
    "idle": 3,
    "standby": 0.5,
    "category": "medium",
    "priority": 2
  },
  "update": {
    "version": "1.1.0",
    "build": "YYYY.MM.DD",
    "checksum": "E5F6A7B8",
    "changelog": ["Description of change 1", "Description of change 2", "Description of change 3"],
    "min_version": "1.0.0",
    "requires_reboot": true
  }
}
```

### 1.1 Required Fields

| Field                    | Type     | Description                                 |
| ------------------------ | -------- | ------------------------------------------- |
| `device_id`              | string   | Unique device identifier (see Section 4)    |
| `device_name`            | string   | Human-readable device name                  |
| `tier`                   | integer  | Device tier classification (see Section 5)  |
| `firmware`               | object   | Current firmware metadata                   |
| `firmware.version`       | string   | Semantic version (see Section 2)            |
| `firmware.build`         | string   | Build date in `YYYY.MM.DD` format           |
| `firmware.checksum`      | string   | Integrity checksum (see Section 3)          |
| `firmware.features`      | string[] | List of firmware feature identifiers        |
| `firmware.securityPatch` | string   | Date of last security patch in `YYYY.MM.DD` |
| `power`                  | object   | Power consumption profile (see Section 6)   |

### 1.2 Optional Fields

| Field                    | Type     | Description                                      |
| ------------------------ | -------- | ------------------------------------------------ |
| `update`                 | object   | Pending firmware update (omit if none available) |
| `update.version`         | string   | Target version for the update                    |
| `update.build`           | string   | Build date of the update payload                 |
| `update.checksum`        | string   | Checksum of the update payload                   |
| `update.changelog`       | string[] | List of human-readable change descriptions       |
| `update.min_version`     | string   | Minimum installed version required to apply      |
| `update.requires_reboot` | boolean  | Whether the device must reboot after flashing    |

---

## 2. Versioning Convention

All firmware versions follow **Semantic Versioning (semver)**:

```
MAJOR.MINOR.PATCH
```

| Component | Incremented When                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------- |
| **MAJOR** | Breaking hardware interface changes, incompatible API modifications, or fundamental architecture rewrites |
| **MINOR** | New features, capabilities, or non-breaking enhancements added to the firmware                            |
| **PATCH** | Bug fixes, security patches, performance improvements with no feature changes                             |

### Examples

- `1.0.0` to `2.0.0` — New hardware revision requires different driver interface
- `2.1.0` to `2.2.0` — Added multi-channel scanning feature
- `3.2.0` to `3.2.1` — Fixed race condition in auto-sync routine

### Pre-release and Build Metadata

Pre-release versions are NOT used in production firmware manifests. Build metadata is encoded in the separate `build` field as a date string, not appended to the version.

---

## 3. Checksum Format

Firmware integrity is verified using **CRC32-style checksums**:

- **Length:** Exactly 8 characters
- **Character Set:** Uppercase hexadecimal (`0-9`, `A-F`) or alphanumeric device-specific mnemonics
- **Encoding:** CRC32 of the firmware binary payload
- **Usage:** Compared before and after transfer to detect corruption

### Examples

```
A7F3B2E1   — Standard hex checksum
CPU3M0N1   — Mnemonic-style checksum (valid for device-specific builds)
T3L3P0RT   — Mnemonic-style checksum
```

Both the installed firmware and any pending update carry independent checksums. The update checksum is verified against the downloaded payload before flashing begins.

---

## 4. Device ID Format

```
XXX-NNN
```

| Segment | Description                                               |
| ------- | --------------------------------------------------------- |
| `XXX`   | 3-letter uppercase device code (mnemonic for device type) |
| `-`     | Literal hyphen separator                                  |
| `NNN`   | 3-digit zero-padded instance number (starting at `001`)   |

### Examples

| Device ID | Device Code | Meaning                     |
| --------- | ----------- | --------------------------- |
| `CDC-001` | CDC         | Crystal Data Cache, unit 1  |
| `MFR-001` | MFR         | Microfusion Reactor, unit 1 |
| `TLP-001` | TLP         | Teleport Pad, unit 1        |

The instance number allows multiple units of the same device type. Currently all devices are single-instance (`001`).

---

## 5. Tier Classification

| Tier  | Label             | Description                                                                     |
| ----- | ----------------- | ------------------------------------------------------------------------------- |
| **1** | Basic / Essential | Core lab infrastructure — monitors, tools, storage, power displays              |
| **2** | Advanced          | Specialized equipment — analyzers, fabricators, drones, synthesizers            |
| **3** | Exotic / Rare     | Cutting-edge or dangerous technology — reactors, quantum systems, teleportation |

### Tier Distribution (Current Fleet)

- **Tier 1:** 19 devices
- **Tier 2:** 11 devices
- **Tier 3:** 7 devices

Higher tiers generally require more power, have more complex firmware, and carry stricter update requirements (more reboots, longer flash times).

---

## 6. Power Categories

Power consumption is classified into four categories based on the device's `full` (maximum) draw:

| Category      | Wattage Range                 | Description                                         |
| ------------- | ----------------------------- | --------------------------------------------------- |
| **light**     | < 5W                          | Low-power sensors, monitors, and displays           |
| **medium**    | 5W -- 15W                     | Moderate-draw processing and analysis devices       |
| **heavy**     | > 15W                         | High-draw fabricators, reactors, and compute arrays |
| **generator** | Negative net (produces power) | Devices that output more energy than they consume   |
| **storage**   | 0W full draw                  | Energy storage devices (batteries, capacitors)      |

### Power Object Fields

| Field      | Type    | Description                                                                 |
| ---------- | ------- | --------------------------------------------------------------------------- |
| `full`     | number  | Maximum power draw in watts during active operation                         |
| `idle`     | number  | Power draw when powered on but not actively working                         |
| `standby`  | number  | Minimal power draw in sleep/standby state                                   |
| `category` | string  | One of: `light`, `medium`, `heavy`, `generator`, `storage`                  |
| `priority` | integer | Power allocation priority (0 = highest / critical, 4 = lowest / deferrable) |

Generator-type devices use `output` or `output_max` instead of `full` to indicate power production capacity. The `per_tier` field on generators indicates output scaling.

---

## 7. Update Protocol

Firmware updates follow a strict state machine to ensure device integrity:

```
┌───────────────────────────────────────────────────────┐
│                  FIRMWARE UPDATE PROTOCOL              │
├───────────────────────────────────────────────────────┤
│                                                       │
│   ┌──────┐    ┌───────────┐    ┌──────────────┐      │
│   │ IDLE │───>│ CHECKING  │───>│ DOWNLOADING  │      │
│   └──────┘    └───────────┘    └──────────────┘      │
│      ^              │                  │              │
│      │           (no update)           v              │
│      │              │          ┌──────────────┐       │
│      │              v          │  VERIFYING   │       │
│      │         ┌────────┐     └──────────────┘       │
│      │         │  IDLE  │              │              │
│      │         └────────┘              v              │
│      │                         ┌──────────────┐       │
│      │                         │  FLASHING    │       │
│      │                         └──────────────┘       │
│      │                                 │              │
│      │                    ┌────────────┼────────┐     │
│      │                    v            v        v     │
│      │             ┌───────────┐ ┌──────────┐ ┌────┐ │
│      │             │ REBOOTING │ │ COMPLETE │ │FAIL│ │
│      │             └───────────┘ └──────────┘ └────┘ │
│      │                    │            │        │     │
│      │                    v            │        │     │
│      │             ┌──────────┐        │        │     │
│      └─────────────│ COMPLETE │<───────┘        │     │
│                    └──────────┘                  │     │
│      ┌──────────────────────────────────────────┘     │
│      v                                                │
│   ┌──────────┐                                        │
│   │ ROLLBACK │──────> IDLE                            │
│   └──────────┘                                        │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 7.1 State Descriptions

| State           | Description                                              |
| --------------- | -------------------------------------------------------- |
| **IDLE**        | Device running normally, no update in progress           |
| **CHECKING**    | Querying firmware manifest for available updates         |
| **DOWNLOADING** | Fetching update payload from firmware registry           |
| **VERIFYING**   | Comparing downloaded payload checksum against manifest   |
| **FLASHING**    | Writing new firmware to device flash memory              |
| **REBOOTING**   | Device is restarting (only if `requires_reboot` is true) |
| **COMPLETE**    | Update successfully applied; device returns to IDLE      |
| **FAILED**      | Update failed at any stage; rollback may be initiated    |
| **ROLLBACK**    | Restoring previous firmware version after failure        |

### 7.2 Update Preconditions

Before an update can proceed, the following conditions MUST be met:

1. **Version gate:** The installed version must be >= `update.min_version`
2. **Checksum match:** The downloaded payload must match `update.checksum`
3. **Power state:** The device must not be in standby mode during flash
4. **No active operations:** The device must not be performing critical work

### 7.3 Rollback

If a firmware flash fails or the device fails to reach COMPLETE state:

1. The previous firmware image is restored from backup partition
2. The device reverts to its prior version and checksum
3. The update remains available for retry
4. A failure event is logged to the diagnostics subsystem

---

## 8. Feature Identifiers

Feature strings in the `features` array use lowercase kebab-case:

```
crystal-index
auto-sync
thermal-protect
quantum-lock
```

Features are device-specific and do not follow a global registry. They serve as human-readable capability tags for the diagnostics and inventory systems.

---

## 9. File Organization

```
devices/
├── FIRMWARE-SPEC.md          # This document
├── FIRMWARE-API.md           # API reference for tool developers
├── tier-1/
│   ├── CDC-001_Crystal-Data-Cache/
│   │   ├── firmware.json     # Firmware manifest
│   │   └── FIRMWARE.md       # Firmware history document
│   ├── BAT-001_Battery-Pack/
│   │   ├── firmware.json
│   │   └── FIRMWARE.md
│   └── ...
├── tier-2/
│   └── ...
└── tier-3/
    └── ...
```

Each device directory contains exactly one `firmware.json` manifest and one `FIRMWARE.md` history document.
