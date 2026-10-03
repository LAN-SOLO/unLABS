# Root Lab — the terminal as the lab behind the lab

The terminal is where `_unLABS` began. In the lab world it was a side door:
room consoles that read mail and flip relays, and a Main Console you could
visit. The Root Lab makes it what it should have been: **the place where a
nerd takes the system apart and tunes it down to the last bit.** The world
is the hardware; the terminal is root on that hardware.

Design rules:

1. **Everything the game decides with a number should one day be a knob.**
   Constants become tunables (`sysctl`), devices get firmware curves (`fw`),
   behaviour becomes scripts (`cron`).
2. **Nothing is free.** Every tweak costs: kernel load on the MCP-000, heat,
   stability, lost firmware features. Optimising means trading, not cheating.
3. **Access is earned in the story.** Four rings, granted by the MCP once Jade
   has brought the right hardware online.
4. **One shell, every console.** Room terminals, the Main Console (`root …`)
   and cron run the same pure code path (`lib/world/root/shell.ts`).
5. **Always a way back.** `rescue --yes` works at every ring; the audit trail
   shows who changed what.

## Rings

| Ring | Name     | Granted when (`access.ts`)                    | Unlocks                                                     |
| ---- | -------- | --------------------------------------------- | ----------------------------------------------------------- |
| 0    | operator | start                                         | read everything: `sysctl -a`, `fw`, `sensors`, `audit`      |
| 1    | wheel    | DGN-001 online + logged into 2 room terminals | `sudo` (also relays from any console), `cron`, ring-1 knobs |
| 2    | root     | CPU-001, MEM-001, TMP-001 online              | firmware tuning, power tunables, profiles                   |
| 3    | kernel   | SCA-001 online                                | wide ranges: overdrive, deep undervolt, kernel limits       |

`su` climbs one ring and otherwise lists what the MCP still wants to see;
`su operator` drops down (credentials stay). The prompt follows:
`jade@room:~$` → `root@room:~#` → `kernel@room:~#`.

## The model (`lib/world/root/model.ts`)

Firmware: every device runs at `clock` % and `volt` % of its rating.

- consumer draw × clock · volt² — generators output × clock
- heat = clock · volt; limit 1.20 alone, 1.50 × THM-001's clock when linked to
  a running THM-001 — too hot trips the device
- stable while clock ≤ volt² — an undervolted core browns out
- below 90 % clock the firmware update features (`hasFeature`) switch off
- every tuned device adds a 0.4 W governor to the kernel load
- a faster AIC-001 shortens research, EXD-001 drone turnaround, THM-001 cools more
- the MCP-000 itself is not tunable (it runs the shell)

Tunables (`tunables.ts`): UEC nominal output, PWD compensation, battery
buffer, research cooldown + yield, drone cooldown, plant growth, dust rate.
Each has a default (the game's old constant), a range per ring, and a cost in
kernel watts on the MCP-000.

## Commands (`shell.ts`)

| Command   | What it does                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| `su`      | climb/drop a ring                                                                     |
| `sysctl`  | `-a` list, `<key>` explain, `<key>=<v>` set, `reset <key\|all>`                       |
| `fw`      | table, details, `<ID> <clk> [volt] [--dry]`, `profile`, `autotune perf\|eco`, `reset` |
| `sensors` | heat bars per device, kernel load breakdown, grid                                     |
| `cron`    | `add <s> [when <metric><op><n>] <cmd>[; <cmd>]`, `rm`, `list`                         |
| `profile` | `save/load/rm/show/list`, `export` → share code `UNR1-…`, `import`                    |
| `audit`   | last changes with play time and source (`term_…`, `Main Console`, `cron#3`)           |
| `rescue`  | factory curves for every tunable and firmware (any ring)                              |

Cron metrics: `gen`, `load`, `balance`, `starved`, `kload`. Allowed in cron:
`sysctl`, `fw`, `profile`, `switch`. Jobs run in play time (`rootTick`, 1 Hz in
`useWorld`) with the ring they were created at, never above Jade's current one.

## Integration

| Where                      | How                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| State                      | `WorldState.root` (save v10, `sanitizeRoot`, migration 9 → 10)                                                                        |
| Game rules                 | `power()` (fw faults, clocks, kernel load), `batteryBuffer`, `researchCooldown/PerCycle`, `droneCooldown`, `agingTick`, `hasFeature`  |
| Room terminals             | `terminal-lite.ts` registers the root commands; ops come back as `{ kind: "root" }` effects                                           |
| Main Console (`/terminal`) | `root <cmd>` and `labor root <cmd>` → `bridge.labRoot` → slot save + terminal event (replayed idempotently by `absorbTerminalEvents`) |
| Tests                      | `tests/world/root.test.ts`                                                                                                            |

## Roadmap — where the knobs go next

The first slice proves the pattern. Each next step adds a layer, not a new system:

1. **More tunables** — doors (`door.cycle`, airlock steam), bots (duty
   speed, wear), recipes (salvage yield vs. volatility), audio/visual kernel
   params for show-offs. Rule: each new knob needs a default, a ring, a cost.
2. **Firmware scripting** — per-device curves (`fw <ID> curve`) that react to
   load or time of day; later a tiny DSL compiled on SCA-001.
3. **Kernel modules** — `modprobe` optional behaviours bought with kernel load
   (e.g. predictive brownout shedding, thermal throttling instead of tripping).
4. **Bus sniffing** — `tcpdump` on the bot network and the signal bus: lore,
   hidden codes, bot routines as readable packets.
5. **Benchmarks and leaderboards** — `bench` scores a lab configuration
   (watts per research point, cycle times); share codes make them comparable.
6. **Visible in the world** — tuned devices glow hotter, fans spin up, the
   MCP's screen shows kernel load; surveillance station gets a "System" tab.
7. **Big terminal parity** — the `_unOS` kernel (`lib/unos/kernel`) mirrors
   the lab's processes in `/unproc/lab/*` so `ps`, `top` and `kill` reach real
   lab devices.
