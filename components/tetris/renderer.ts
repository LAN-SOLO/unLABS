// _unTETRIS - Canvas rendering functions

import {
  COLS, VISIBLE_ROWS,
  PIECE_SHAPES,
  DECAY_STABLE_RATIO, DECAY_FADING_RATIO,
  type TetrisTheme, type PieceType, type CellValue, type PlayerState, type GameState,
} from './types'
import { getPieceCells, getGhostPiece, getDecayProgress, computeVolatilityIndex } from './engine'

// ── Tier Label for aged clears ─────────────────────────────────
export interface TierLabel {
  text: string
  multiplier: number
  spawnTime: number       // performance.now() when created
  player: number
}

const SIDEBAR_WIDTH = 140
const BOARD_PADDING = 4
const HEADER_HEIGHT = 40

// ── Layout Calculation ──────────────────────────────────────────

export interface BoardLayout {
  cellSize: number
  boardX: number
  boardY: number
  boardW: number
  boardH: number
  sidebarX: number
  totalW: number
  totalH: number
}

export function calculateLayout(canvasW: number, canvasH: number, mode: '1p' | '2p'): BoardLayout[] {
  const playerCount = mode === '2p' ? 2 : 1
  const availableH = canvasH - HEADER_HEIGHT - 20
  const cellFromH = Math.floor(availableH / VISIBLE_ROWS)

  const sideW = SIDEBAR_WIDTH
  const singleBoardW = cellFromH * COLS
  const singleTotalW = singleBoardW + sideW + BOARD_PADDING * 2 + 10
  const totalNeededW = singleTotalW * playerCount + (playerCount === 2 ? 40 : 0)

  const cellSize = totalNeededW > canvasW
    ? Math.floor((canvasW - (sideW + BOARD_PADDING * 2 + 10) * playerCount - (playerCount === 2 ? 40 : 0)) / (COLS * playerCount))
    : cellFromH

  const boardW = cellSize * COLS
  const boardH = cellSize * VISIBLE_ROWS
  const actualTotalW = (boardW + sideW + BOARD_PADDING * 2 + 10) * playerCount + (playerCount === 2 ? 40 : 0)
  const startX = Math.floor((canvasW - actualTotalW) / 2)

  const layouts: BoardLayout[] = []
  for (let p = 0; p < playerCount; p++) {
    const playerOffset = p * (boardW + sideW + BOARD_PADDING * 2 + 10 + (playerCount === 2 ? 40 : 0))
    const boardX = startX + playerOffset + BOARD_PADDING
    const boardY = HEADER_HEIGHT + Math.floor((availableH - boardH) / 2)
    const sidebarX = boardX + boardW + 10

    layouts.push({
      cellSize,
      boardX,
      boardY,
      boardW,
      boardH,
      sidebarX,
      totalW: boardW + sideW + BOARD_PADDING * 2 + 10,
      totalH: boardH,
    })
  }

  return layouts
}

// ── Drawing Helpers ─────────────────────────────────────────────

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number,
  type: PieceType, theme: TetrisTheme,
  alpha = 1,
  decayProgress = 0,
  time = 0,
) {
  const color = theme.pieceColors[type]
  const border = theme.pieceBorderColors[type]

  // Compute effective alpha based on decay phase
  let effectiveAlpha = alpha
  let desaturate = 0
  let dashed = false

  if (decayProgress >= DECAY_FADING_RATIO) {
    // Phase 2 — Critical: pulsing alpha 0.3–0.6
    const pulse = Math.sin(time * 0.008) * 0.5 + 0.5 // 0–1
    effectiveAlpha = alpha * (0.3 + pulse * 0.3)
    desaturate = 0.5
    dashed = true
  } else if (decayProgress >= DECAY_STABLE_RATIO) {
    // Phase 1 — Fading: alpha lerps 1.0 → 0.6, slight desaturation
    const fadeT = (decayProgress - DECAY_STABLE_RATIO) / (DECAY_FADING_RATIO - DECAY_STABLE_RATIO)
    effectiveAlpha = alpha * (1.0 - fadeT * 0.4)
    desaturate = fadeT * 0.3
  }

  ctx.globalAlpha = effectiveAlpha

  // Desaturation: blend toward gray
  if (desaturate > 0) {
    ctx.filter = `saturate(${1 - desaturate})`
  }

  ctx.fillStyle = color
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2)

  // Inner highlight
  ctx.fillStyle = border
  ctx.fillRect(x + 1, y + 1, size - 2, 2)
  ctx.fillRect(x + 1, y + 1, 2, size - 2)

  // Inner shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(x + size - 3, y + 1, 2, size - 2)
  ctx.fillRect(x + 1, y + size - 3, size - 2, 2)

  ctx.filter = 'none'
  ctx.globalAlpha = 1

  // Dashed border for critical-phase cells
  if (dashed) {
    ctx.globalAlpha = effectiveAlpha * 1.5
    ctx.strokeStyle = theme.text
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2)
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }
}

function drawGhostCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, theme: TetrisTheme) {
  ctx.strokeStyle = theme.ghost
  ctx.lineWidth = 1.5
  ctx.strokeRect(x + 2, y + 2, size - 4, size - 4)
}

// ── Mini Piece (for sidebar) ────────────────────────────────────

function drawMiniPiece(ctx: CanvasRenderingContext2D, type: PieceType, x: number, y: number, cellSize: number, theme: TetrisTheme) {
  const shape = PIECE_SHAPES[type][0]
  // Center the piece
  let minC = 10, maxC = 0, minR = 10, maxR = 0
  for (const [r, c] of shape) {
    minR = Math.min(minR, r); maxR = Math.max(maxR, r)
    minC = Math.min(minC, c); maxC = Math.max(maxC, c)
  }
  const pw = (maxC - minC + 1) * cellSize
  const ph = (maxR - minR + 1) * cellSize
  const offsetX = x + (cellSize * 4 - pw) / 2 - minC * cellSize
  const offsetY = y + (cellSize * 2 - ph) / 2 - minR * cellSize

  for (const [r, c] of shape) {
    drawCell(ctx, offsetX + c * cellSize, offsetY + r * cellSize, cellSize, type, theme)
  }
}

// ── Board Rendering ─────────────────────────────────────────────

function drawBoard(ctx: CanvasRenderingContext2D, player: PlayerState, layout: BoardLayout, theme: TetrisTheme, time: number) {
  const { cellSize, boardY, boardW, boardH } = layout

  // Guard: if cellAges missing (HMR / legacy state), skip decay visuals
  const hasCellAges = !!player.cellAges

  // Compute V-INDEX for board jitter
  const vIndex = hasCellAges
    ? computeVolatilityIndex(player.board, player.cellAges, time, player.level)
    : 0

  // Board jitter when V-INDEX > 0.8
  let boardX = layout.boardX
  if (vIndex > 0.8) {
    boardX += Math.sin(time * 0.003) * (vIndex - 0.8) * 20
  }

  // Board background
  ctx.fillStyle = theme.boardBg
  ctx.fillRect(boardX, boardY, boardW, boardH)

  // Grid lines
  ctx.strokeStyle = theme.gridLine
  ctx.lineWidth = 0.5
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(boardX + c * cellSize, boardY)
    ctx.lineTo(boardX + c * cellSize, boardY + boardH)
    ctx.stroke()
  }
  for (let r = 0; r <= VISIBLE_ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(boardX, boardY + r * cellSize)
    ctx.lineTo(boardX + boardW, boardY + r * cellSize)
    ctx.stroke()
  }

  // Draw placed cells (only visible rows: 0 to VISIBLE_ROWS-1)
  for (let r = 0; r < VISIBLE_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = player.board[r][c]
      if (cell) {
        const dp = hasCellAges ? getDecayProgress(player.cellAges[r][c], time, player.level) : 0
        drawCell(ctx, boardX + c * cellSize, boardY + r * cellSize, cellSize, cell, theme, 1, dp, time)
      }
    }
  }

  // Draw ghost piece
  if (player.currentPiece) {
    const ghost = getGhostPiece(player.board, player.currentPiece)
    const ghostCells = getPieceCells(ghost)
    for (const [r, c] of ghostCells) {
      if (r >= 0 && r < VISIBLE_ROWS) {
        drawGhostCell(ctx, boardX + c * cellSize, boardY + r * cellSize, cellSize, theme)
      }
    }

    // Draw current piece (no decay — active piece is always fresh)
    const cells = getPieceCells(player.currentPiece)
    for (const [r, c] of cells) {
      if (r >= 0 && r < VISIBLE_ROWS) {
        drawCell(ctx, boardX + c * cellSize, boardY + r * cellSize, cellSize, player.currentPiece.type, theme)
      }
    }
  }

  // Board border
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 2
  ctx.strokeRect(boardX - 1, boardY - 1, boardW + 2, boardH + 2)

  // Accent corners
  const cornerLen = 12
  ctx.strokeStyle = theme.accentCorner
  ctx.lineWidth = 2
  // Top-left
  ctx.beginPath()
  ctx.moveTo(boardX - 1, boardY - 1 + cornerLen)
  ctx.lineTo(boardX - 1, boardY - 1)
  ctx.lineTo(boardX - 1 + cornerLen, boardY - 1)
  ctx.stroke()
  // Top-right
  ctx.beginPath()
  ctx.moveTo(boardX + boardW + 1 - cornerLen, boardY - 1)
  ctx.lineTo(boardX + boardW + 1, boardY - 1)
  ctx.lineTo(boardX + boardW + 1, boardY - 1 + cornerLen)
  ctx.stroke()
  // Bottom-left
  ctx.beginPath()
  ctx.moveTo(boardX - 1, boardY + boardH + 1 - cornerLen)
  ctx.lineTo(boardX - 1, boardY + boardH + 1)
  ctx.lineTo(boardX - 1 + cornerLen, boardY + boardH + 1)
  ctx.stroke()
  // Bottom-right
  ctx.beginPath()
  ctx.moveTo(boardX + boardW + 1 - cornerLen, boardY + boardH + 1)
  ctx.lineTo(boardX + boardW + 1, boardY + boardH + 1)
  ctx.lineTo(boardX + boardW + 1, boardY + boardH + 1 - cornerLen)
  ctx.stroke()
}

// ── Sidebar Rendering ───────────────────────────────────────────

function drawSidebar(ctx: CanvasRenderingContext2D, player: PlayerState, layout: BoardLayout, playerLabel: string, theme: TetrisTheme, time: number) {
  const { cellSize, sidebarX, boardY } = layout
  const miniCellSize = Math.floor(cellSize * 0.6)
  let y = boardY

  ctx.font = `bold 12px monospace`
  ctx.fillStyle = theme.text
  ctx.textAlign = 'left'

  // Player label
  ctx.fillText(playerLabel, sidebarX, y + 12)
  y += 24

  // Score
  ctx.font = '10px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('SCORE', sidebarX, y + 10)
  y += 14
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = theme.text
  ctx.fillText(player.score.toLocaleString(), sidebarX, y + 14)
  y += 24

  // Level
  ctx.font = '10px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('LEVEL', sidebarX, y + 10)
  y += 14
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = theme.text
  ctx.fillText(String(player.level), sidebarX, y + 14)
  y += 24

  // Lines
  ctx.font = '10px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('LINES', sidebarX, y + 10)
  y += 14
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = theme.text
  ctx.fillText(String(player.lines), sidebarX, y + 14)
  y += 30

  // Hold piece
  ctx.font = '10px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('HOLD', sidebarX, y + 10)
  y += 16
  if (player.holdPiece) {
    drawMiniPiece(ctx, player.holdPiece, sidebarX, y, miniCellSize, theme)
  }
  y += miniCellSize * 2 + 10

  // Next pieces
  ctx.font = '10px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('NEXT', sidebarX, y + 10)
  y += 16
  for (let i = 0; i < Math.min(3, player.nextPieces.length); i++) {
    drawMiniPiece(ctx, player.nextPieces[i], sidebarX, y, miniCellSize, theme)
    y += miniCellSize * 2 + 8
  }

  // Combo indicator
  if (player.combo > 0) {
    y += 10
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = theme.accentCorner
    ctx.fillText(`COMBO x${player.combo}`, sidebarX, y + 10)
  }

  // Back-to-back indicator
  if (player.backToBack) {
    y += 16
    ctx.font = 'bold 10px monospace'
    ctx.fillStyle = theme.accentCorner
    ctx.fillText('B2B', sidebarX, y + 10)
  }

  // V-INDEX stability meter
  y += 26
  const vIndex = player.cellAges
    ? computeVolatilityIndex(player.board, player.cellAges, time, player.level)
    : 0
  drawStabilityMeter(ctx, sidebarX, y, vIndex, theme)
}

// ── V-INDEX Stability Meter ──────────────────────────────────────

function drawStabilityMeter(ctx: CanvasRenderingContext2D, x: number, y: number, vIndex: number, theme: TetrisTheme) {
  const barW = 14
  const barH = 80
  const labelY = y

  ctx.font = '10px monospace'
  ctx.fillStyle = theme.textDim
  ctx.textAlign = 'left'
  ctx.fillText('V-INDEX', x, labelY + 10)

  const meterY = labelY + 16

  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(x, meterY, barW, barH)

  // Fill bar from bottom upward
  const fillH = barH * vIndex
  let barColor: string
  let statusLabel: string
  if (vIndex < 0.3) {
    barColor = '#22c55e'
    statusLabel = 'STABLE'
  } else if (vIndex < 0.6) {
    barColor = '#eab308'
    statusLabel = 'WARMING'
  } else if (vIndex < 0.8) {
    barColor = '#f97316'
    statusLabel = 'VOLATILE'
  } else {
    barColor = '#ef4444'
    statusLabel = 'CRITICAL'
  }

  ctx.fillStyle = barColor
  ctx.fillRect(x, meterY + barH - fillH, barW, fillH)

  // Pulsing glow for critical
  if (vIndex > 0.8) {
    const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.4
    ctx.globalAlpha = pulse
    ctx.fillStyle = barColor
    ctx.fillRect(x - 1, meterY + barH - fillH - 1, barW + 2, fillH + 2)
    ctx.globalAlpha = 1
  }

  // Border
  ctx.strokeStyle = theme.textDim
  ctx.lineWidth = 1
  ctx.strokeRect(x, meterY, barW, barH)

  // Percentage
  ctx.font = 'bold 10px monospace'
  ctx.fillStyle = barColor
  ctx.textAlign = 'left'
  ctx.fillText(`${Math.round(vIndex * 100)}%`, x + barW + 4, meterY + barH / 2 + 4)

  // Status label
  ctx.font = '8px monospace'
  ctx.fillStyle = barColor
  ctx.fillText(statusLabel, x, meterY + barH + 12)
}

// ── Tier Label for Aged Clears ──────────────────────────────────

function drawTierLabels(ctx: CanvasRenderingContext2D, labels: TierLabel[], layouts: BoardLayout[], time: number, theme: TetrisTheme) {
  const LABEL_DURATION = 1500 // 1.5s display time

  for (const label of labels) {
    const elapsed = time - label.spawnTime
    if (elapsed > LABEL_DURATION) continue

    const layout = layouts[label.player]
    if (!layout) continue

    const progress = elapsed / LABEL_DURATION
    const alpha = 1 - progress
    const offsetY = -progress * 40 // float upward

    const cx = layout.boardX + layout.boardW / 2
    const cy = layout.boardY + layout.boardH / 2 + offsetY

    ctx.globalAlpha = alpha

    // Critical tier gets a glow effect
    if (label.text === 'CRITICAL') {
      ctx.shadowColor = theme.accentCorner
      ctx.shadowBlur = 12
    }

    ctx.font = 'bold 20px monospace'
    ctx.fillStyle = theme.accentCorner
    ctx.textAlign = 'center'
    ctx.fillText(label.text, cx, cy)

    ctx.font = '14px monospace'
    ctx.fillText(`${label.multiplier.toFixed(2)}x`, cx, cy + 20)

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

// ── Overlays ────────────────────────────────────────────────────

function drawPauseOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, theme: TetrisTheme) {
  ctx.fillStyle = theme.overlay
  ctx.fillRect(0, 0, w, h)

  ctx.font = 'bold 32px monospace'
  ctx.fillStyle = theme.text
  ctx.textAlign = 'center'
  ctx.fillText('PAUSED', w / 2, h / 2 - 20)

  ctx.font = '14px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('Press P to resume', w / 2, h / 2 + 15)
  ctx.fillText('Press ESC to quit', w / 2, h / 2 + 35)
}

function drawGameOverOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, game: GameState, theme: TetrisTheme) {
  ctx.fillStyle = theme.overlay
  ctx.fillRect(0, 0, w, h)

  ctx.font = 'bold 32px monospace'
  ctx.fillStyle = theme.text
  ctx.textAlign = 'center'

  if (game.mode === '2p' && game.winner !== null) {
    ctx.fillText(`PLAYER ${game.winner + 1} WINS`, w / 2, h / 2 - 40)
  } else {
    ctx.fillText('GAME OVER', w / 2, h / 2 - 40)
  }

  // Show scores
  const p1 = game.players[0]
  ctx.font = '14px monospace'
  ctx.fillStyle = theme.textDim

  if (game.mode === '2p') {
    ctx.fillText(`P1: ${p1.score.toLocaleString()}  |  P2: ${game.players[1].score.toLocaleString()}`, w / 2, h / 2)
  } else {
    ctx.fillText(`Score: ${p1.score.toLocaleString()}  Level: ${p1.level}  Lines: ${p1.lines}`, w / 2, h / 2)
  }

  ctx.font = '13px monospace'
  ctx.fillStyle = theme.textDim
  ctx.fillText('Press R to restart  |  ESC to quit', w / 2, h / 2 + 35)
}

// ── Header ──────────────────────────────────────────────────────

function drawHeader(ctx: CanvasRenderingContext2D, w: number, game: GameState, theme: TetrisTheme) {
  ctx.font = 'bold 18px monospace'
  ctx.fillStyle = theme.text
  ctx.textAlign = 'center'
  ctx.fillText('_unTETRIS', w / 2, 28)

  // Controls hint
  ctx.font = '9px monospace'
  ctx.fillStyle = theme.textDim
  ctx.textAlign = 'right'
  const hint = game.mode === '2p' ? 'P=Pause  M=Mute  ESC=Quit' : 'P=Pause  M=Mute  ESC=Quit'
  ctx.fillText(hint, w - 12, 16)
  ctx.textAlign = 'left'
}

// ── Main Render ─────────────────────────────────────────────────

export function render(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  game: GameState,
  theme: TetrisTheme,
  time: number,
  tierLabels?: TierLabel[],
) {
  // Clear with background
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, w, h)

  const layouts = calculateLayout(w, h, game.mode)

  // Header
  drawHeader(ctx, w, game, theme)

  // Draw each player
  for (let i = 0; i < game.players.length; i++) {
    const label = game.mode === '2p' ? `P${i + 1}` : ''
    drawBoard(ctx, game.players[i], layouts[i], theme, time)
    drawSidebar(ctx, game.players[i], layouts[i], label, theme, time)
  }

  // Aged clear tier labels
  if (tierLabels && tierLabels.length > 0) {
    drawTierLabels(ctx, tierLabels, layouts, time, theme)
  }

  // Overlays
  if (game.paused) {
    drawPauseOverlay(ctx, w, h, theme)
  } else if (game.gameOverFlag) {
    drawGameOverOverlay(ctx, w, h, game, theme)
  }
}
