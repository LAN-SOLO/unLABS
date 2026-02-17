// _unTETRIS - Inverted Tetris for _unOS
// Types, constants, key bindings, theme colors

export const COLS = 10
export const ROWS = 23 // 20 visible + 3 hidden spawn rows at bottom (3 needed for X piece)
export const VISIBLE_ROWS = 20
export const HIDDEN_ROWS = 3
export const LOCK_DELAY = 500
export const INITIAL_GRAVITY = 1000 // ms per drop at level 1
export const GRAVITY_FACTOR = 0.85 // multiply per level
export const LINES_PER_LEVEL = 10
export const SOFT_DROP_FACTOR = 20 // 20x speed
export const MAX_LOCK_RESETS = 15

// Piece types (standard Tetromino names + _un_ exclusive shapes)
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L' | 'X' | 'U' | 'V'
export const PIECE_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L', 'X', 'U', 'V']

// Rotation states: 0=spawn, 1=CW, 2=180, 3=CCW
export type RotationState = 0 | 1 | 2 | 3

// Piece shapes (row, col offsets from center) - standard SRS
// Note: in our inverted system, row 0 is top, row 21 is bottom
// Pieces spawn at bottom and rise up
export const PIECE_SHAPES: Record<PieceType, number[][][]> = {
  I: [
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,1],[1,1],[2,1],[3,1]],
  ],
  O: [
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ],
  T: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]],
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,2],[1,1],[1,2],[2,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  J: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,0],[2,1]],
  ],
  L: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
  // ── _un_ exclusive shapes ──────────────────────────────────
  // X: Plus/cross pentomino (5 cells) — rotationally symmetric
  //  .#.
  //  ###
  //  .#.
  X: [
    [[0,1],[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[1,2],[2,1]],
  ],
  // U: U-pentomino (5 cells) — creates internal gaps
  //  #.#
  //  ###
  U: [
    [[0,0],[0,2],[1,0],[1,1],[1,2]],  // #.# / ###
    [[0,0],[0,1],[1,1],[2,0],[2,1]],  // ## / .# / ##
    [[0,0],[0,1],[0,2],[1,0],[1,2]],  // ### / #.#
    [[0,0],[0,1],[1,0],[2,0],[2,1]],  // ## / #. / ##
  ],
  // V: Corner tromino (3 cells) — small, creates awkward gaps
  //  #.
  //  ##
  V: [
    [[0,0],[1,0],[1,1]],  // #. / ##
    [[0,0],[0,1],[1,0]],  // ## / #.
    [[0,0],[0,1],[1,1]],  // ## / .#
    [[0,1],[1,0],[1,1]],  // .# / ##
  ],
}

// SRS wall kick data (inverted: row offsets negated)
// Format: [fromState][toState] = array of (dx, dy) tests
// For inverted gravity, dy offsets are negated
const KICK_JLSTZ: [number, number][][] = [
  // 0->1
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  // 1->2
  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  // 2->3
  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  // 3->0
  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
]

const KICK_JLSTZ_CCW: [number, number][][] = [
  // 0->3
  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  // 1->0
  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  // 2->1
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  // 3->2
  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
]

const KICK_I: [number, number][][] = [
  // 0->1
  [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  // 1->2
  [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  // 2->3
  [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  // 3->0
  [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
]

const KICK_I_CCW: [number, number][][] = [
  // 0->3
  [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  // 1->0
  [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  // 2->1
  [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  // 3->2
  [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
]

export function getWallKicks(piece: PieceType, fromRot: RotationState, clockwise: boolean): [number, number][] {
  if (piece === 'O' || piece === 'X') return [[0, 0]] // symmetric — no kicks needed
  const idx = fromRot
  if (piece === 'I') {
    return clockwise ? KICK_I[idx] : KICK_I_CCW[idx]
  }
  return clockwise ? KICK_JLSTZ[idx] : KICK_JLSTZ_CCW[idx]
}

// Dynamic theme derived from terminal colors
export interface TetrisTheme {
  bg: string
  boardBg: string
  gridLine: string
  border: string
  accentCorner: string
  text: string
  textDim: string
  ghost: string
  overlay: string
  pieceColors: Record<PieceType, string>
  pieceBorderColors: Record<PieceType, string>
}

// Parse a hex color to HSL components
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

// Build a complete TetrisTheme from terminal colors
export function buildTetrisTheme(fg: string, screen: string, glow: string): TetrisTheme {
  const [fgR, fgG, fgB] = hexToRgb(fg)
  const [scR, scG, scB] = hexToRgb(screen)
  const [fgH, fgS] = hexToHsl(fg)

  // Board bg: slightly lighter than screen
  const boardBg = `rgb(${Math.min(scR + 12, 255)}, ${Math.min(scG + 12, 255)}, ${Math.min(scB + 12, 255)})`

  // Generate distinct piece hues by rotating from the fg hue (360° / N pieces)
  const pieceColors = {} as Record<PieceType, string>
  const pieceBorderColors = {} as Record<PieceType, string>
  const pieceSat = Math.max(fgS, 0.5) // ensure pieces are vibrant enough
  for (let i = 0; i < PIECE_TYPES.length; i++) {
    const hue = fgH + i * (360 / PIECE_TYPES.length)
    pieceColors[PIECE_TYPES[i]] = hslToHex(hue, pieceSat, 0.45)
    pieceBorderColors[PIECE_TYPES[i]] = hslToHex(hue, pieceSat, 0.55)
  }

  return {
    bg: screen,
    boardBg,
    gridLine: `rgba(${fgR}, ${fgG}, ${fgB}, 0.1)`,
    border: fg,
    accentCorner: glow,
    text: fg,
    textDim: `rgba(${fgR}, ${fgG}, ${fgB}, 0.5)`,
    ghost: `rgba(${fgR}, ${fgG}, ${fgB}, 0.2)`,
    overlay: `rgba(${scR}, ${scG}, ${scB}, 0.85)`,
    pieceColors,
    pieceBorderColors,
  }
}

// Default fallback theme (green terminal aesthetic)
export const DEFAULT_TETRIS_THEME = buildTetrisTheme('#00FF41', '#0a0a0a', '#00FF41')

// Key bindings
export interface KeyBindings {
  left: string
  right: string
  rotateCW: string
  rotateCCW: string
  softDrop: string
  hardDrop: string
  hold: string
}

export const P1_KEYS: KeyBindings = {
  left: 'a',
  right: 'd',
  rotateCW: 'w',
  rotateCCW: 'q',
  softDrop: 's',
  hardDrop: ' ',   // Space
  hold: 'e',
}

export const P2_KEYS: KeyBindings = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  rotateCW: 'ArrowUp',
  rotateCCW: '/',
  softDrop: 'ArrowDown',
  hardDrop: 'Enter',
  hold: '.',
}

// Scoring
export const LINE_CLEAR_POINTS = [0, 100, 300, 500, 800] // 0, single, double, triple, tetris
export const LINE_CLEAR_GARBAGE = [0, 0, 1, 2, 4]
export const COMBO_BONUS = 50
export const B2B_MULTIPLIER = 1.5

// ── Decay / Unstable Matter ────────────────────────────────────
export const DECAY_BASE_LIFESPAN = 90000      // 90s at level 1
export const DECAY_SPEED_FACTOR = 0.95         // 5% faster per level
export const DECAY_STABLE_RATIO = 0.5          // first 50% of life is stable
export const DECAY_FADING_RATIO = 0.83         // 50-83% is fading, 83-100% critical
export const VOLATILITY_CONTAGION_THRESHOLD = 0.75
export const VOLATILITY_CONTAGION_SPEEDUP = 0.8  // 20% faster decay when V-INDEX > 75%

export const AGED_THRESHOLDS = [
  { name: 'FRESH',    minRatio: 0.0,  multiplier: 1.0 },
  { name: 'AGED',     minRatio: 0.3,  multiplier: 1.25 },
  { name: 'VINTAGE',  minRatio: 0.6,  multiplier: 1.5 },
  { name: 'CRITICAL', minRatio: 0.85, multiplier: 2.0 },
] as const

export type AgeTier = typeof AGED_THRESHOLDS[number]

// Game state types
export type CellValue = PieceType | null

export interface Piece {
  type: PieceType
  rotation: RotationState
  row: number // top-left corner of bounding box
  col: number
}

export interface PlayerState {
  board: CellValue[][]
  cellAges: number[][]   // parallel to board — placement timestamp (ms), 0 = empty
  currentPiece: Piece | null
  holdPiece: PieceType | null
  holdUsed: boolean
  nextPieces: PieceType[]
  bag: PieceType[]
  score: number
  level: number
  lines: number
  combo: number
  backToBack: boolean
  gameOver: boolean
  lastGravityTime: number
  lockTimer: number | null
  lockResets: number
  pendingGarbage: number
  garbageGapCol: number
}

export interface GameState {
  players: PlayerState[]
  mode: '1p' | '2p'
  paused: boolean
  gameOverFlag: boolean
  winner: number | null // 0 or 1, null if 1p or not over
  startTime: number
  muted: boolean
}

export type GameAction =
  | { type: 'move'; player: number; dx: number }
  | { type: 'rotateCW'; player: number }
  | { type: 'rotateCCW'; player: number }
  | { type: 'softDrop'; player: number }
  | { type: 'hardDrop'; player: number }
  | { type: 'hold'; player: number }
  | { type: 'gravity'; player: number; time: number }
  | { type: 'lock'; player: number }
  | { type: 'restart' }

export interface GameEvent {
  type: 'move' | 'rotate' | 'hardDrop' | 'lock' | 'lineClear' | 'levelUp' | 'gameOver' | 'garbage' | 'hold' | 'decay'
  player: number
  linesCleared?: number
  ageTier?: string          // 'FRESH' | 'AGED' | 'VINTAGE' | 'CRITICAL'
  ageMultiplier?: number    // 1.0 – 2.0
}
