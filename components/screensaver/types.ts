export type ScreensaverPattern = 'moire' | 'lissajous' | 'plasma' | 'tunnel' | 'spirograph' | 'matrix' | 'warp'

export interface MoireParams {
  ringCount: number
  rotationSpeed: number
  lineWidth: number
  centerDistance: number
}

export interface LissajousParams {
  freqA: number
  freqB: number
  phaseSpeed: number
  trailLength: number
}

export interface PlasmaParams {
  scale: number
  speed: number
  complexity: number
  palette: 'neon' | 'fire' | 'ocean' | 'acid' | 'mono'
}

export interface TunnelParams {
  ringCount: number
  speed: number
  rotationSpeed: number
  shape: 'circle' | 'hex' | 'square'
}

export interface SpirographParams {
  outerRadius: number
  innerRadius: number
  penOffset: number
  speed: number
  fadeRate: number
}

export interface MatrixParams {
  density: number
  speed: number
  fontSize: number
  charset: 'katakana' | 'latin' | 'binary' | 'hex' | 'mixed'
}

export interface WarpParams {
  starCount: number
  speed: number
  trailLength: number
  fov: number
}

export interface PatternParamsMap {
  moire: MoireParams
  lissajous: LissajousParams
  plasma: PlasmaParams
  tunnel: TunnelParams
  spirograph: SpirographParams
  matrix: MatrixParams
  warp: WarpParams
}

export interface ScreensaverConfig {
  activePattern: ScreensaverPattern
  colorSource: 'theme' | 'custom'
  customColor: string
  globalBrightness: number
  crtOverlay: boolean
  patterns: PatternParamsMap
}

export const PATTERN_LABELS: Record<ScreensaverPattern, string> = {
  moire: 'Moire Interference',
  lissajous: 'Lissajous Curves',
  plasma: 'Plasma Field',
  tunnel: 'Infinity Tunnel',
  spirograph: 'Spirograph',
  matrix: 'Matrix Rain',
  warp: 'Star Warp',
}

export const ALL_PATTERNS: ScreensaverPattern[] = ['moire', 'lissajous', 'plasma', 'tunnel', 'spirograph', 'matrix', 'warp']

const STORAGE_KEY = 'unlabs_screensaver_config'

export function getDefaultConfig(): ScreensaverConfig {
  return {
    activePattern: 'moire',
    colorSource: 'theme',
    customColor: '#00FF41',
    globalBrightness: 80,
    crtOverlay: true,
    patterns: {
      moire: { ringCount: 8, rotationSpeed: 40, lineWidth: 2, centerDistance: 50 },
      lissajous: { freqA: 3, freqB: 4, phaseSpeed: 30, trailLength: 200 },
      plasma: { scale: 40, speed: 50, complexity: 3, palette: 'neon' },
      tunnel: { ringCount: 15, speed: 50, rotationSpeed: 20, shape: 'circle' },
      spirograph: { outerRadius: 70, innerRadius: 25, penOffset: 40, speed: 40, fadeRate: 10 },
      matrix: { density: 60, speed: 50, fontSize: 14, charset: 'katakana' },
      warp: { starCount: 200, speed: 50, trailLength: 60, fov: 90 },
    },
  }
}

export function loadScreensaverConfig(): ScreensaverConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultConfig()
    const parsed = JSON.parse(raw)
    // Merge with defaults to ensure all fields exist
    const defaults = getDefaultConfig()
    return {
      ...defaults,
      ...parsed,
      patterns: {
        ...defaults.patterns,
        ...parsed.patterns,
        moire: { ...defaults.patterns.moire, ...parsed.patterns?.moire },
        lissajous: { ...defaults.patterns.lissajous, ...parsed.patterns?.lissajous },
        plasma: { ...defaults.patterns.plasma, ...parsed.patterns?.plasma },
        tunnel: { ...defaults.patterns.tunnel, ...parsed.patterns?.tunnel },
        spirograph: { ...defaults.patterns.spirograph, ...parsed.patterns?.spirograph },
        matrix: { ...defaults.patterns.matrix, ...parsed.patterns?.matrix },
        warp: { ...defaults.patterns.warp, ...parsed.patterns?.warp },
      },
    }
  } catch {
    return getDefaultConfig()
  }
}

export function saveScreensaverConfig(config: ScreensaverConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Storage full or unavailable - silently fail
  }
}
