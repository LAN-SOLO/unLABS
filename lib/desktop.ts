/**
 * Desktop (Electron) runtime detection.
 *
 * The Electron preload script exposes `window.__ELECTRON_CONFIG__` with
 * runtime values (see electron/preload.ts). In the browser the global is
 * absent, so every helper here degrades gracefully to "not desktop".
 */

export interface ElectronConfig {
  isDesktop?: boolean;
  version?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  resizeWindow?: (width: number, height: number) => void;
}

export function getElectronConfig(): ElectronConfig | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as Record<string, unknown>).__ELECTRON_CONFIG__ as
    | ElectronConfig
    | undefined;
}

export function isDesktopApp(): boolean {
  return getElectronConfig()?.isDesktop === true;
}
