# \_unOS Firmware API Reference

> API reference for tool developers integrating with the UnstableLabs firmware system.
> Revision 1.0 — 2026.02.23

---

## 1. FirmwareActions Interface

The `FirmwareActions` interface provides all methods for querying and managing device firmware state. It is exposed to terminal commands via `ctx.data.firmwareActions` in the `DataFetchers` object.

```typescript
interface FirmwareActions {
  getDeviceState(deviceId: string): DeviceFirmwareState;
  getAllStates(): Map<string, DeviceFirmwareState>;
  getInstalledVersion(deviceId: string): FirmwareVersion;
  checkForUpdate(deviceId: string): FirmwareUpdateCheck;
  getDevicesWithUpdates(): FirmwareUpdateInfo[];
  applyUpdate(deviceId: string): Promise<boolean>;
  rollback(deviceId: string): boolean;
  toSaveData(): FirmwareSaveData;
}
```

---

## 2. Method Reference

### 2.1 getDeviceState(deviceId)

Returns the complete firmware state for a single device.

```typescript
getDeviceState(deviceId: string): DeviceFirmwareState
```

**Parameters:**

- `deviceId` — Device identifier (e.g., `"CDC-001"`)

**Returns:** `DeviceFirmwareState` object containing installed version, update status, power profile, and current update state machine position.

**Throws:** If `deviceId` is not found in the device registry.

**Example:**

```typescript
const state = firmwareActions.getDeviceState("CDC-001");
console.log(state.firmware.version); // "1.4.2"
console.log(state.updateState); // "idle"
```

### 2.2 getAllStates()

Returns the firmware state for every registered device.

```typescript
getAllStates(): Map<string, DeviceFirmwareState>
```

**Returns:** A `Map` keyed by device ID, with `DeviceFirmwareState` values.

**Example:**

```typescript
const allStates = firmwareActions.getAllStates();
for (const [id, state] of allStates) {
  console.log(`${id}: v${state.firmware.version}`);
}
```

### 2.3 getInstalledVersion(deviceId)

Returns only the installed firmware version for a device.

```typescript
getInstalledVersion(deviceId: string): FirmwareVersion
```

**Parameters:**

- `deviceId` — Device identifier

**Returns:** `FirmwareVersion` object with `version`, `build`, and `checksum` fields.

**Example:**

```typescript
const ver = firmwareActions.getInstalledVersion("MFR-001");
console.log(ver.version); // "2.3.0"
console.log(ver.checksum); // "B8D4E6F2"
```

### 2.4 checkForUpdate(deviceId)

Checks whether a firmware update is available for the specified device.

```typescript
checkForUpdate(deviceId: string): FirmwareUpdateCheck
```

**Parameters:**

- `deviceId` — Device identifier

**Returns:**

```typescript
{
  available: boolean
  update?: FirmwareUpdate        // Present only if available === true
  currentVersion: string         // Installed version string
  latestVersion?: string         // Update version string (if available)
}
```

**Example:**

```typescript
const check = firmwareActions.checkForUpdate("CDC-001");
if (check.available) {
  console.log(`Update: v${check.currentVersion} -> v${check.latestVersion}`);
  console.log(check.update.changelog);
}
```

### 2.5 getDevicesWithUpdates()

Returns an array of all devices that have pending firmware updates.

```typescript
getDevicesWithUpdates(): FirmwareUpdateInfo[]
```

**Returns:** Array of objects:

```typescript
{
  deviceId: string;
  deviceName: string;
  currentVersion: string;
  updateVersion: string;
  requiresReboot: boolean;
}
```

**Example:**

```typescript
const updates = firmwareActions.getDevicesWithUpdates();
console.log(`${updates.length} device(s) have updates available`);
updates.forEach((u) => {
  console.log(`  ${u.deviceId}: v${u.currentVersion} -> v${u.updateVersion}`);
});
```

### 2.6 applyUpdate(deviceId)

Initiates the firmware update process for a device. Progresses through the full state machine: checking, downloading, verifying, flashing, and optionally rebooting.

```typescript
applyUpdate(deviceId: string): Promise<boolean>
```

**Parameters:**

- `deviceId` — Device identifier

**Returns:** `Promise<boolean>` — Resolves to `true` if the update completed successfully, `false` if it failed at any stage.

**Side effects:**

- Transitions the device through the update state machine
- If `requires_reboot` is true, the device enters REBOOTING state before COMPLETE
- On failure, the device enters FAILED state (use `rollback()` to recover)

**Example:**

```typescript
const success = await firmwareActions.applyUpdate("CDC-001");
if (success) {
  console.log("Firmware updated successfully");
} else {
  console.log("Update failed — initiating rollback");
  firmwareActions.rollback("CDC-001");
}
```

### 2.7 rollback(deviceId)

Restores the previous firmware version after a failed update.

```typescript
rollback(deviceId: string): boolean
```

**Parameters:**

- `deviceId` — Device identifier

**Returns:** `true` if rollback succeeded, `false` if no rollback was possible (e.g., device was not in FAILED state).

**Example:**

```typescript
const rolled = firmwareActions.rollback("CDC-001");
if (rolled) {
  const ver = firmwareActions.getInstalledVersion("CDC-001");
  console.log(`Rolled back to v${ver.version}`);
}
```

### 2.8 toSaveData()

Serializes the entire firmware manager state for persistence.

```typescript
toSaveData(): FirmwareSaveData
```

**Returns:** `FirmwareSaveData` — A JSON-serializable snapshot of all device firmware states, suitable for writing to localStorage.

---

## 3. Update State Machine

```
  ┌──────┐     ┌──────────┐     ┌─────────────┐     ┌───────────┐
  │ idle │────>│ checking │────>│ downloading │────>│ verifying │
  └──────┘     └──────────┘     └─────────────┘     └───────────┘
     ^                                                     │
     │                                                     v
     │           ┌──────────┐     ┌───────────┐     ┌───────────┐
     │           │ complete │<────│ rebooting │<────│ flashing  │
     │           └──────────┘     └───────────┘     └───────────┘
     │                │                                    │
     │                v                                    v
     └────────── [returns                            ┌──────────┐
                  to idle]                           │  failed  │
                                                     └──────────┘
                                                          │
                                                          v
                                                     ┌──────────┐
                                                     │ rollback │──> idle
                                                     └──────────┘
```

### State Transitions

| From          | To            | Trigger                                        |
| ------------- | ------------- | ---------------------------------------------- |
| `idle`        | `checking`    | `applyUpdate()` called                         |
| `checking`    | `downloading` | Update found in manifest                       |
| `checking`    | `idle`        | No update available                            |
| `downloading` | `verifying`   | Payload download complete                      |
| `verifying`   | `flashing`    | Checksum matches                               |
| `verifying`   | `failed`      | Checksum mismatch                              |
| `flashing`    | `rebooting`   | Flash complete AND `requires_reboot === true`  |
| `flashing`    | `complete`    | Flash complete AND `requires_reboot === false` |
| `flashing`    | `failed`      | Flash write error                              |
| `rebooting`   | `complete`    | Device restart successful                      |
| `rebooting`   | `failed`      | Device failed to restart                       |
| `complete`    | `idle`        | State reset after successful update            |
| `failed`      | `rollback`    | `rollback()` called                            |
| `rollback`    | `idle`        | Previous firmware restored                     |

---

## 4. Persistence Format

Firmware state is persisted as part of the panel save data in localStorage.

**Key:** `unlabs_panel_state`

**Path:** `.firmware`

```typescript
interface FirmwareSaveData {
  devices: Record<
    string,
    {
      installedVersion: string;
      installedBuild: string;
      installedChecksum: string;
      updateState: string; // Current state machine position
      previousVersion?: string; // Set after successful update (for rollback)
      previousChecksum?: string;
      lastUpdateAttempt?: string; // ISO 8601 timestamp
      updateHistory: string[]; // Array of previously installed versions
    }
  >;
}
```

**Example localStorage entry:**

```json
{
  "firmware": {
    "devices": {
      "CDC-001": {
        "installedVersion": "1.5.0",
        "installedBuild": "2025.03.01",
        "installedChecksum": "B9D4E7F2",
        "updateState": "idle",
        "previousVersion": "1.4.2",
        "previousChecksum": "A7F3B2E1",
        "lastUpdateAttempt": "2025.03.15T14:22:00Z",
        "updateHistory": ["1.0.0", "1.2.0", "1.4.2", "1.5.0"]
      }
    }
  }
}
```

---

## 5. Type Definitions

```typescript
interface FirmwareVersion {
  version: string;
  build: string;
  checksum: string;
}

interface FirmwareUpdate {
  version: string;
  build: string;
  checksum: string;
  changelog: string[];
  min_version: string;
  requires_reboot: boolean;
}

interface DeviceFirmwareState {
  deviceId: string;
  deviceName: string;
  tier: number;
  firmware: FirmwareVersion & {
    features: string[];
    securityPatch: string;
  };
  power: PowerProfile;
  update?: FirmwareUpdate;
  updateState:
    | "idle"
    | "checking"
    | "downloading"
    | "verifying"
    | "flashing"
    | "rebooting"
    | "complete"
    | "failed"
    | "rollback";
  previousVersion?: string;
  previousChecksum?: string;
}

interface PowerProfile {
  full?: number;
  idle: number;
  standby: number;
  category: "light" | "medium" | "heavy" | "generator" | "storage";
  priority: number;
  output?: number;
  output_max?: number;
  per_tier?: number;
  self_consumption?: number;
  resonance?: number;
}

interface FirmwareUpdateCheck {
  available: boolean;
  update?: FirmwareUpdate;
  currentVersion: string;
  latestVersion?: string;
}

interface FirmwareUpdateInfo {
  deviceId: string;
  deviceName: string;
  currentVersion: string;
  updateVersion: string;
  requiresReboot: boolean;
}
```
