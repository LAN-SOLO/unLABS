# Native builds — macOS, Windows, Linux (Flatpak)

UnstableLabs ships as a **native desktop app**, not as a website. The app is
Electron: Chromium renders the game through ANGLE onto the platform's native
graphics API (Metal on macOS, Direct3D 11 on Windows, OpenGL/EGL on Linux),
and the app bundles its own local stack (Next.js server, PostgreSQL,
PostgREST, GoTrue) bound to `127.0.0.1`. There is no engine rewrite: the
same three.js / WebGL2 renderer (clarity passes, hero characters) runs in
every package.

| Platform | Package                         | Arch  | Build host              |
| -------- | ------------------------------- | ----- | ----------------------- |
| macOS    | `.dmg`                          | arm64 | macOS                   |
| Windows  | NSIS setup `.exe`               | x64   | macOS or Windows        |
| Linux    | **Flatpak** + AppImage fallback | x64   | Linux (flatpak-builder) |

All artifacts land in **`.INSTALL/`** (leading dot).

## Build commands

```bash
pnpm build:mac     # DMG
pnpm build:win     # Windows installer
pnpm build:linux   # Flatpak + AppImage (Linux host only)
pnpm build:all     # all three (needs a Linux host for the Flatpak)
```

`scripts/build-desktop.ts` runs: DB content check → platform binaries
(`scripts/download-binaries.ts --platform=…`) → `pnpm build` with
`UNLABS_DESKTOP_BUILD=1` and `NEXT_PUBLIC_DESKTOP_ONLY=1` → Electron compile →
electron-builder (`electron-builder.config.ts`).

### Linux / Flatpak

Flatpak is the primary Linux package: sandboxed, distro-independent, ready for
Flathub. The AppImage is a no-install fallback for testers.

Host setup (Debian/Ubuntu example; any distro with flatpak works, also CI):

```bash
sudo apt install flatpak flatpak-builder
flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 \
  org.electronjs.Electron2.BaseApp//24.08
pnpm install && pnpm build:linux
flatpak install --user .INSTALL/UnstableLabs-<version>-*.flatpak
flatpak run com.unstablelabs.game
```

Manifest settings (`flatpak` in `electron-builder.config.ts`):

- runtime `org.freedesktop.Platform` / sdk `org.freedesktop.Sdk` **24.08**,
  base `org.electronjs.Electron2.BaseApp` **24.08** (electron-builder's
  default 20.08 is end-of-life).
- `finishArgs`:
  - `--socket=wayland`, `--socket=fallback-x11`, `--share=ipc` — window;
    Wayland first, X11 only without a Wayland session.
  - `--device=dri` — GPU access for WebGL2.
  - `--socket=pulseaudio` — game audio.
  - `--share=network` — **required**: the game is a local stack (Next,
    Postgres, PostgREST, GoTrue) talking over `127.0.0.1`, and Flatpak has no
    loopback-only permission. Exposure stays limited by the app itself: every
    service binds to `127.0.0.1`, the gateway and Next accept loopback hosts
    only (`lib/auth/loopback.ts`, `docs/AUDIT.md`).
  - **no** `--filesystem=home`: saves, secrets and `pgdata` live in the
    sandbox's own `~/.var/app/com.unstablelabs.game/` (Electron `userData`).

The bundled Linux binaries (`bin/linux-x64` → `resources/bin`) are found by
`electron/main.ts` (`bin/${platform}-${arch}` in dev, `resources/bin` when
packaged). The `afterPack` hook already uses the non-mac layout
(`<appOutDir>/resources/app`) for Linux.

## Bundled binaries (linux-x64)

`scripts/download-binaries.ts --platform=linux-x64` downloads over HTTPS and
aborts on any SHA-256 mismatch:

| Archive                                             | SHA-256                                                            | Verified how                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `embedded-postgres-binaries-linux-amd64-17.2.0.jar` | `bfee37aa1ab2d465abf471ad2a478fb31a527fbae1c2e7bda024544244870eb2` | SHA-1 equals Maven Central's `.sha1` (`035ad4fb…c9186d`)                                  |
| `postgrest-v12.2.8-linux-static-x86-64.tar.xz`      | `7da60261909ab7e6fc2f0c0c1d484985f17710151e1c94e8229559eaa23cd611` | **No upstream digest** for v12.2.8 — pinned on first TLS download from the GitHub release |
| `auth-v2.188.1-x86.tar.gz` (GoTrue)                 | `f3472263b480d2192f34ab2e38687c1a42072617c4967ebc4fdc4087fd3bec77` | Equals the `sha256` digest GitHub publishes for the release asset                         |

PostgREST is statically linked; GoTrue is statically linked; Postgres is a
glibc build (the freedesktop runtime provides glibc). No arm64 Linux build:
PostgREST v12.2.8 publishes no generic linux-arm64 asset.

## GPU

`electron/gpu-switches.ts` (pure, tested in `tests/native/gate.test.ts`) is
applied in `electron/main.ts` before `app.ready`:

- `ignore-gpu-blocklist` — keep hardware WebGL on conservatively blocklisted
  drivers (otherwise SwiftShader → a few fps).
- `enable-gpu-rasterization`, `enable-zero-copy`.
- macOS: `force_high_performance_gpu` (discrete GPU on dual-GPU Macs).
- Linux: `ozone-platform-hint=auto` (Wayland when available, else X11).
  ANGLE keeps its default GL backend; Vulkan-ANGLE on Linux is experimental.
- Escape hatch: `UNLABS_SAFE_GPU=1` skips all switches.

The window hardening from the audit is unchanged (`sandbox`,
`contextIsolation`, navigation/popup/permission lock-down, IPC main-frame
checks — `electron/window.ts`, `docs/AUDIT.md`).

## Desktop-only gate

`NEXT_PUBLIC_DESKTOP_ONLY=1` (set by the desktop build, off in `pnpm dev`)
makes `/world` and `/terminal` show a bilingual "UnstableLabs is a desktop
game" page in a plain browser instead of the game.

- Decision: `nativeGate(desktopOnly, isDesktop)` in `lib/native/gate.ts`.
- Detection: `inDesktopShell()` — the preload's
  `window.__ELECTRON_CONFIG__.isDesktop`; the terminal embedded as an iframe in
  the world (no preload there) asks its same-origin top frame.
- UI: `components/native/DesktopGate.tsx` (wraps `app/world/page.tsx` and
  `app/(game)/terminal/page.tsx`); German strings in `lib/i18n/de/native.ts`.

The gate is a product decision, not a security boundary: anyone can build
the web version without the flag.

## Not yet tested

- Flatpak / AppImage on real Linux hardware (built configs only; the macOS dev
  machine cannot run flatpak-builder). Check: GPU in the sandbox (Mesa and
  NVIDIA), Postgres `initdb` inside `~/.var/app`, Wayland vs X11, audio.
- `electron-builder --linux` packaging itself was not run here (needs the
  Next production build and the Linux Electron download on a Linux host/CI).
- Code signing / notarisation (Apple ID, Windows certificate) — still open
  (see `docs/AUDIT.md`).
- Flathub submission (needs an AppStream metainfo file, screenshots, review).
- Windows hardware test of the GPU switches.
