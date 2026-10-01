import { describe, expect, it } from "vitest";
import { inDesktopShell, nativeGate } from "@/lib/native/gate";
import { gpuSwitches } from "@/electron/gpu-switches";

describe("desktop-only gate", () => {
  it("plays everywhere without the flag, only in the app with it", () => {
    expect(nativeGate(false, false)).toBe("play");
    expect(nativeGate(false, true)).toBe("play");
    expect(nativeGate(true, true)).toBe("play");
    expect(nativeGate(true, false)).toBe("download");
  });

  it("detects the app frame and embedded frames of it", () => {
    const top = { __ELECTRON_CONFIG__: { isDesktop: true } } as unknown as Window;
    Object.assign(top, { top });
    expect(inDesktopShell(top)).toBe(true);
    const child = { top } as unknown as Window;
    expect(inDesktopShell(child)).toBe(true);
    const plain = {} as Window;
    Object.assign(plain, { top: plain });
    expect(inDesktopShell(plain)).toBe(false);
    expect(inDesktopShell(undefined)).toBe(false);
  });

  it("a cross-origin top frame is not the app", () => {
    const w = {} as Window;
    Object.defineProperty(w, "top", {
      get() {
        throw new Error("SecurityError");
      },
    });
    expect(inDesktopShell(w)).toBe(false);
  });
});

describe("GPU switches", () => {
  it("asks for the fast GPU per platform and can be switched off", () => {
    const mac = gpuSwitches("darwin", {}).map((s) => s[0]);
    expect(mac).toContain("force_high_performance_gpu");
    expect(mac).toContain("ignore-gpu-blocklist");
    expect(gpuSwitches("linux", {})).toContainEqual(["ozone-platform-hint", "auto"]);
    expect(gpuSwitches("win32", {}).map((s) => s[0])).not.toContain("force_high_performance_gpu");
    expect(gpuSwitches("darwin", { UNLABS_SAFE_GPU: "1" })).toEqual([]);
  });
});
