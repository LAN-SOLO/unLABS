# Thermal Subsystem (THM-001)

The thermal subsystem models the \_unOS chassis as a fixed-volume enclosure
that heats up when devices work and cools down when fans push air through
it. This document explains the model, the data flow, and the `thermal`
terminal command that drives it.

---

## 1. The volume model

Every part of the chassis has a **fixed, realistic volume** declared in
[`lib/thermal/volumes.ts`](../lib/thermal/volumes.ts). Volumes are not
runtime-tweakable, so saves stay reproducible across sessions.

| Surface             | Volume   | Heat capacity (J/K) | Notes                                 |
| ------------------- | -------- | ------------------- | ------------------------------------- |
| Terminal chassis    | **28 L** | ≈ 345               | Mini-tower enclosure                  |
| CPU module          | 0.45 L   | ≈ 12                | Small, dense, large `solidMassFactor` |
| Supercomputer Array | 4.2 L    | ≈ 103               | Largest single device                 |
| Microfusion Reactor | 3.5 L    | ≈ 78                |                                       |
| Battery Pack        | 2.2 L    | ≈ 22                |                                       |
| Lab Clock           | 0.15 L   | ≈ 1.5               | Smallest                              |

(Full table: see `DEVICE_THERMAL_SPECS` in `lib/thermal/volumes.ts`.)

The chassis volume is **fixed at 28 L**. The sum of every device volume is
about 11 L, leaving roughly 17 L of air gap that the ventilation fans
circulate.

### 1.1 Heat capacity

Heat capacity in J/K is computed from the volume using:

```
C = V_L · ρ_air · c_p · solidMassFactor
  = V_L · 1.225 g/L · 1.005 J/(g·K) · m
```

`solidMassFactor` (default 8, up to 22 for CPUs) lumps in the silicon, PCB
and heatsink mass that air alone cannot account for. Without it, the model
would heat and cool unrealistically fast for a few liters of air.

---

## 2. The thermal model

The simulation tick runs every **1 s** inside `ThermalManagerProvider`
(`contexts/ThermalManager.tsx`). Each tick:

1. **Sum heat input** (W) from every registered device:
   `Q_in = Σ heatOutput · (0.10 + 0.90 · load/100)`
2. **Sum cooling** (W) from active fans, with non-linear efficiency:
   `Q_out = Σ coolingPower · (speed/100) ^ 1.2`
3. **Chassis temperature**: net heat updates the chassis using its heat
   capacity, with a passive ambient term:
   ```
   ΔT_chassis = ((Q_in - Q_out) - k_amb · (T_chassis - T_ambient)) · dt / C_chassis
   ```
4. **Per-device sub-zones**: every device has its own temperature, driven
   by its own load and _coupled_ to the chassis through the fans:
   ```
   coupling = (T_device - T_chassis) · (0.8 + 4.5 · avgFanSpeed)
   ΔT_device = (Q_device - coupling) · dt / C_device
   ```
5. **Status thresholds**: each thermal zone has `targetTemp`,
   `warningThreshold`, and `criticalThreshold`. The worst zone determines
   the overall status (`nominal` → `elevated` → `warning` → `critical`).
6. **AUTO mode** ramps fan speeds linearly from 25 % at the target temp to
   100 % at the warning threshold, smoothed at 10 % per tick.
7. **Critical override**: when `isOverheating`, fans add 5 percentage
   points per tick regardless of the user-set mode.

The result: more device load → more joules per second → chassis warms up
→ AUTO fans spin up → cooling rises → temperature stabilises (or trips a
warning if cooling can't keep up).

---

## 3. The continuous color gradient

`ThermalManager.getTemperatureColor(temp)` maps a temperature to an
`rgb(...)` string by interpolating across five stops over **20–90 °C**:

| Temp   | Color     | RGB                |
| ------ | --------- | ------------------ |
| 20 °C  | Cool blue | `rgb(0,170,255)`   |
| ~37 °C | Cyan      | `rgb(0,229,255)`   |
| 55 °C  | Green     | `rgb(105,240,174)` |
| ~72 °C | Amber     | `rgb(255,191,0)`   |
| 90 °C+ | Red       | `rgb(255,64,64)`   |

Both the panel `VentilationFan` module and any future thermal display
should call `getTemperatureColor` instead of hard-coding step colors —
this guarantees the gradient is smooth, not banded, and that the panel and
the terminal agree on what "63 °C" looks like.

---

## 4. The `thermal` terminal command

Provider wiring: `app/(game)/terminal/terminal-power-wrapper.tsx` wraps
`<Terminal>` in a `<ThermalManagerProvider>`, so any command can read live
state via `ctx.data.thermalDevice` (typed as `ThermalDeviceActions` in
`lib/terminal/types.ts`).

### 4.1 Subcommands

```
thermal                       # alias for `thermal status`
thermal status                # zones + fans + chassis volume + heat budget
thermal list                  # registered devices, volume, load, sub-zone temp
thermal fan <id> <mode>       # id ∈ {cpu,gpu}; mode ∈ {0-100,auto,low,med,high,off,on}
thermal auto on|off           # toggle automatic fan control
thermal emergency             # force every fan to 100 % (override AUTO)
thermal load <id> <0-100>     # debug: inject a synthetic load on a device
thermal man                   # full manual page
```

Aliases: `therm`, `temp`, `cooling`.

### 4.2 Sample `thermal status`

```
  CHASSIS VOLUME : 28.0 L  (devices: 11.2 L, air gap: 16.8 L)
  HEAT CAPACITY  : 345 J/K
  AMBIENT        : 22.0 °C
  CHASSIS TEMP   : 31.4 °C
  HEAT IN        : 64.3 W
  COOLING OUT    : 58.1 W
  NET            : +6.2 W

  ╔═══════════════════════════════════════════════════════════╗
  ║  THERMAL ZONES                                            ║
  ║  ZONE     TEMP      TARGET   STATUS                       ║
  ║  CPU       42.1 °C    45 °C  NOMINAL                      ║
  ║  GPU       38.7 °C    50 °C  NOMINAL                      ║
  ║  PANEL     31.4 °C    35 °C  NOMINAL                      ║
  ╚═══════════════════════════════════════════════════════════╝

  OVERALL STATUS : NOMINAL
  PERFORMANCE    : 100 %
  AUTO MODE      : ENABLED
```

### 4.3 Examples

```bash
# Inspect every registered device
thermal list

# Pin the CPU fan at 80 %
thermal fan cpu 80

# Hand control back to the controller
thermal auto on

# Stress-test: drive the supercomputer to 100 %
thermal load sca 100
thermal status        # watch the chassis temp climb
```

---

## 5. Architecture & files

| File                                             | Role                                                    |
| ------------------------------------------------ | ------------------------------------------------------- |
| `lib/thermal/volumes.ts`                         | Fixed volumes, heat-capacity helpers, device catalog    |
| `contexts/ThermalManager.tsx`                    | React provider, simulation loop, gradient, public API   |
| `lib/terminal/types.ts` → `ThermalDeviceActions` | Hook-free contract used by terminal commands            |
| `hooks/useTerminal.ts`                           | Builds the `ThermalDeviceActions` adapter from the hook |
| `lib/terminal/commands.ts` → `thermalCommand`    | The `thermal` shell command                             |
| `components/panel/modules/VentilationFan.tsx`    | Panel UI, also consumes `getTemperatureColor`           |
| `app/(game)/terminal/terminal-power-wrapper.tsx` | Mounts the provider for the terminal route              |

### 5.1 Adding a new device to the model

1. Add an entry to `DEVICE_THERMAL_SPECS` in `lib/thermal/volumes.ts`.
2. Have the device's manager call `thermalManager.registerDevice(id, name, initialLoad)`
   when it boots — `ThermalManager` will pick up the volume/heat-capacity
   from the catalog automatically.
3. Drive `updateDeviceLoad(id, 0..100)` from wherever the device's load
   actually changes (job runner, ticker, sim loop, …).

The `thermal list` command will then show the new sub-zone immediately.
