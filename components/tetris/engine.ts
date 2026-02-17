// _unTETRIS - Pure game logic engine (no rendering, no React)

import {
  COLS, ROWS, VISIBLE_ROWS, HIDDEN_ROWS, LOCK_DELAY, INITIAL_GRAVITY, GRAVITY_FACTOR,
  LINES_PER_LEVEL, SOFT_DROP_FACTOR, MAX_LOCK_RESETS,
  PIECE_TYPES, PIECE_SHAPES,
  LINE_CLEAR_POINTS, LINE_CLEAR_GARBAGE, COMBO_BONUS, B2B_MULTIPLIER,
  DECAY_BASE_LIFESPAN, DECAY_SPEED_FACTOR, DECAY_STABLE_RATIO,
  VOLATILITY_CONTAGION_THRESHOLD, VOLATILITY_CONTAGION_SPEEDUP,
  AGED_THRESHOLDS,
  getWallKicks,
  type PieceType, type RotationState, type CellValue, type Piece,
  type PlayerState, type GameState, type GameEvent, type AgeTier,
} from './types'

// ── Bag Randomizer ──────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateBag(): PieceType[] {
  return shuffleArray(PIECE_TYPES)
}

function pullFromBag(state: PlayerState): { piece: PieceType; bag: PieceType[]; nextPieces: PieceType[] } {
  let bag = [...state.bag]
  const nextPieces = [...state.nextPieces]

  // Ensure we always have enough pieces in next queue
  while (nextPieces.length < 4) {
    if (bag.length === 0) bag = generateBag()
    nextPieces.push(bag.pop()!)
  }

  const piece = nextPieces.shift()!

  // Refill
  while (nextPieces.length < 4) {
    if (bag.length === 0) bag = generateBag()
    nextPieces.push(bag.pop()!)
  }

  return { piece, bag, nextPieces }
}

// ── Piece Geometry ──────────────────────────────────────────────

export function getPieceCells(piece: Piece): [number, number][] {
  const shape = PIECE_SHAPES[piece.type][piece.rotation]
  return shape.map(([r, c]) => [piece.row + r, piece.col + c])
}

// ── Decay Helpers ──────────────────────────────────────────────

export function getDecayLifespan(level: number): number {
  return DECAY_BASE_LIFESPAN * Math.pow(DECAY_SPEED_FACTOR, level - 1)
}

export function getDecayProgress(placedAt: number, now: number, level: number): number {
  if (placedAt === 0) return 0
  const age = now - placedAt
  const lifespan = getDecayLifespan(level)
  return Math.min(age / lifespan, 1)
}

export function computeVolatilityIndex(
  board: CellValue[][],
  cellAges: number[][],
  time: number,
  level: number,
): number {
  let totalCells = 0
  let decayingCells = 0
  const lifespan = getDecayLifespan(level)
  const stableMs = lifespan * DECAY_STABLE_RATIO

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== null && cellAges[r][c] > 0) {
        totalCells++
        if (time - cellAges[r][c] > stableMs) {
          decayingCells++
        }
      }
    }
  }

  return totalCells === 0 ? 0 : decayingCells / totalCells
}

export function getAgeTier(ageRatio: number): AgeTier {
  let tier: AgeTier = AGED_THRESHOLDS[0]
  for (const t of AGED_THRESHOLDS) {
    if (ageRatio >= t.minRatio) tier = t
  }
  return tier
}

function getSpawnPosition(type: PieceType): { row: number; col: number } {
  // Pieces spawn at bottom (hidden rows area) and rise upward
  // Spawn row is computed from piece height so it fits entirely within bounds
  const shape = PIECE_SHAPES[type][0] // rotation 0
  const height = Math.max(...shape.map(([r]) => r)) + 1
  const col = (type === 'O' || type === 'V') ? 4 : 3
  return { row: ROWS - height, col }
}

// ── Collision Detection ─────────────────────────────────────────

function isValidPosition(board: CellValue[][], piece: Piece): boolean {
  const cells = getPieceCells(piece)
  for (const [r, c] of cells) {
    if (c < 0 || c >= COLS) return false
    if (r < 0 || r >= ROWS) return false
    if (board[r][c] !== null) return false
  }
  return true
}

// ── Board Operations ────────────────────────────────────────────

function createBoard(): CellValue[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function createCellAges(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0))
}

function lockPiece(board: CellValue[][], cellAges: number[][], piece: Piece, time: number): { board: CellValue[][]; cellAges: number[][] } {
  const newBoard = board.map(row => [...row])
  const newAges = cellAges.map(row => [...row])
  const cells = getPieceCells(piece)
  for (const [r, c] of cells) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      newBoard[r][c] = piece.type
      newAges[r][c] = time
    }
  }
  return { board: newBoard, cellAges: newAges }
}

// In inverted Tetris, completed lines are at the TOP of the board (row 0 upward)
// Lines clear when they're full, rows above shift down (which in inverted = stack compacts upward)
function clearLines(
  board: CellValue[][],
  cellAges: number[][],
  time: number,
  level: number,
): { board: CellValue[][]; cellAges: number[][]; linesCleared: number; avgAgeRatio: number } {
  const newBoard = board.map(row => [...row])
  const newAges = cellAges.map(row => [...row])
  const fullRows: number[] = []

  // Check all rows for full lines
  for (let r = 0; r < ROWS; r++) {
    if (newBoard[r].every(cell => cell !== null)) {
      fullRows.push(r)
    }
  }

  if (fullRows.length === 0) return { board: newBoard, cellAges: newAges, linesCleared: 0, avgAgeRatio: 0 }

  // Compute average age ratio of cleared rows for aged bonus
  const lifespan = getDecayLifespan(level)
  let totalAgeRatio = 0
  let cellCount = 0
  for (const r of fullRows) {
    for (let c = 0; c < COLS; c++) {
      if (newAges[r][c] > 0) {
        const age = time - newAges[r][c]
        totalAgeRatio += Math.min(age / lifespan, 1)
        cellCount++
      }
    }
  }
  const avgAgeRatio = cellCount > 0 ? totalAgeRatio / cellCount : 0

  // Remove full rows from both board and cellAges
  const remainingBoard = newBoard.filter((_, i) => !fullRows.includes(i))
  const remainingAges = newAges.filter((_, i) => !fullRows.includes(i))
  const emptyBoardRows = Array.from({ length: fullRows.length }, () => Array(COLS).fill(null) as CellValue[])
  const emptyAgeRows = Array.from({ length: fullRows.length }, () => Array(COLS).fill(0) as number[])
  // Empty rows go at the bottom (pieces spawn from bottom)
  const resultBoard = [...remainingBoard, ...emptyBoardRows]
  const resultAges = [...remainingAges, ...emptyAgeRows]

  return { board: resultBoard, cellAges: resultAges, linesCleared: fullRows.length, avgAgeRatio }
}

// ── Ghost Piece ─────────────────────────────────────────────────

export function getGhostPiece(board: CellValue[][], piece: Piece): Piece {
  // Ghost piece shows where the piece would land if hard-dropped
  // In inverted gravity, pieces rise UP, so ghost is at the highest valid position
  const ghost = { ...piece }
  while (isValidPosition(board, { ...ghost, row: ghost.row - 1 })) {
    ghost.row--
  }
  return ghost
}

// ── Player State Creation ───────────────────────────────────────

function createPlayerState(time: number): PlayerState {
  const bag = generateBag()
  const nextPieces: PieceType[] = []

  // Fill next queue from bag
  const tempBag = [...bag]
  const tempBag2 = generateBag()
  for (let i = 0; i < 4; i++) {
    if (tempBag.length === 0) tempBag.push(...tempBag2)
    nextPieces.push(tempBag.pop()!)
  }

  const state: PlayerState = {
    board: createBoard(),
    cellAges: createCellAges(),
    currentPiece: null,
    holdPiece: null,
    holdUsed: false,
    nextPieces,
    bag: tempBag.length > 0 ? tempBag : generateBag(),
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    backToBack: false,
    gameOver: false,
    lastGravityTime: time,
    lockTimer: null,
    lockResets: 0,
    pendingGarbage: 0,
    garbageGapCol: Math.floor(Math.random() * COLS),
  }

  return spawnPiece(state, time)
}

// ── Piece Spawning ──────────────────────────────────────────────

function spawnPiece(state: PlayerState, time: number): PlayerState {
  const { piece, bag, nextPieces } = pullFromBag(state)
  const spawn = getSpawnPosition(piece)
  const newPiece: Piece = {
    type: piece,
    rotation: 0,
    row: spawn.row,
    col: spawn.col,
  }

  // Check if spawn position is valid
  if (!isValidPosition(state.board, newPiece)) {
    return { ...state, currentPiece: null, gameOver: true, bag, nextPieces }
  }

  return {
    ...state,
    currentPiece: newPiece,
    bag,
    nextPieces,
    holdUsed: false,
    lastGravityTime: time,
    lockTimer: null,
    lockResets: 0,
  }
}

// ── Movement ────────────────────────────────────────────────────

function movePiece(state: PlayerState, dx: number, dy: number): PlayerState {
  if (!state.currentPiece || state.gameOver) return state

  const moved: Piece = {
    ...state.currentPiece,
    row: state.currentPiece.row + dy,
    col: state.currentPiece.col + dx,
  }

  if (!isValidPosition(state.board, moved)) return state

  // Reset lock timer if piece moved successfully and was in lock state
  let lockTimer = state.lockTimer
  let lockResets = state.lockResets
  if (lockTimer !== null && lockResets < MAX_LOCK_RESETS) {
    lockTimer = performance.now()
    lockResets++
  }

  return { ...state, currentPiece: moved, lockTimer, lockResets }
}

function rotatePiece(state: PlayerState, clockwise: boolean): PlayerState {
  if (!state.currentPiece || state.gameOver) return state
  if (state.currentPiece.type === 'O') return state

  const fromRot = state.currentPiece.rotation
  const toRot = (clockwise ? (fromRot + 1) % 4 : (fromRot + 3) % 4) as RotationState
  const kicks = getWallKicks(state.currentPiece.type, fromRot, clockwise)

  for (const [dx, dy] of kicks) {
    const rotated: Piece = {
      ...state.currentPiece,
      rotation: toRot,
      col: state.currentPiece.col + dx,
      // Invert the dy for inverted gravity
      row: state.currentPiece.row - dy,
    }

    if (isValidPosition(state.board, rotated)) {
      let lockTimer = state.lockTimer
      let lockResets = state.lockResets
      if (lockTimer !== null && lockResets < MAX_LOCK_RESETS) {
        lockTimer = performance.now()
        lockResets++
      }
      return { ...state, currentPiece: rotated, lockTimer, lockResets }
    }
  }

  return state // No valid kick found
}

// ── Gravity & Dropping ──────────────────────────────────────────

function getGravityInterval(level: number): number {
  return INITIAL_GRAVITY * Math.pow(GRAVITY_FACTOR, level - 1)
}

function applyGravity(state: PlayerState, time: number): { state: PlayerState; events: GameEvent[]; playerIdx: number } {
  if (!state.currentPiece || state.gameOver) return { state, events: [], playerIdx: 0 }

  const interval = getGravityInterval(state.level)
  if (time - state.lastGravityTime < interval) return { state, events: [], playerIdx: 0 }

  // In inverted gravity, pieces move UP (row decreases)
  const moved: Piece = {
    ...state.currentPiece,
    row: state.currentPiece.row - 1,
  }

  if (isValidPosition(state.board, moved)) {
    return {
      state: { ...state, currentPiece: moved, lastGravityTime: time },
      events: [],
      playerIdx: 0,
    }
  }

  // Can't move up - start lock timer if not started
  if (state.lockTimer === null) {
    return {
      state: { ...state, lockTimer: time, lastGravityTime: time },
      events: [],
      playerIdx: 0,
    }
  }

  return { state: { ...state, lastGravityTime: time }, events: [], playerIdx: 0 }
}

function softDrop(state: PlayerState): { state: PlayerState; events: GameEvent[]; playerIdx: number } {
  if (!state.currentPiece || state.gameOver) return { state, events: [], playerIdx: 0 }

  // Move piece up by 1 (inverted soft drop)
  const moved: Piece = {
    ...state.currentPiece,
    row: state.currentPiece.row - 1,
  }

  if (isValidPosition(state.board, moved)) {
    return {
      state: { ...state, currentPiece: moved, score: state.score + 1 },
      events: [],
      playerIdx: 0,
    }
  }

  return { state, events: [], playerIdx: 0 }
}

function hardDrop(state: PlayerState, playerIdx: number, time: number): { state: PlayerState; events: GameEvent[] } {
  if (!state.currentPiece || state.gameOver) return { state, events: [] }

  // Move piece as far up as possible (inverted)
  let dropDistance = 0
  const piece = { ...state.currentPiece }
  while (isValidPosition(state.board, { ...piece, row: piece.row - 1 })) {
    piece.row--
    dropDistance++
  }

  const events: GameEvent[] = [{ type: 'hardDrop', player: playerIdx }]
  const score = state.score + dropDistance * 2

  // Lock immediately
  return lockAndSpawn(
    { ...state, currentPiece: piece, score },
    playerIdx,
    time,
    events,
  )
}

// ── Lock & Line Clear ───────────────────────────────────────────

function lockAndSpawn(
  state: PlayerState,
  playerIdx: number,
  time: number,
  events: GameEvent[],
): { state: PlayerState; events: GameEvent[] } {
  if (!state.currentPiece) return { state, events }

  events.push({ type: 'lock', player: playerIdx })

  // Lock piece onto board (stamps cellAges with current time)
  let { board, cellAges } = lockPiece(state.board, state.cellAges, state.currentPiece, time)

  // Apply pending garbage BEFORE line clear check
  if (state.pendingGarbage > 0) {
    const garbageResult = addGarbageLines(board, cellAges, state.pendingGarbage, state.garbageGapCol, time)
    board = garbageResult.board
    cellAges = garbageResult.cellAges
    events.push({ type: 'garbage', player: playerIdx })
  }

  // Clear lines (with age tracking)
  const { board: clearedBoard, cellAges: clearedAges, linesCleared, avgAgeRatio } = clearLines(board, cellAges, time, state.level)
  let score = state.score
  let combo = state.combo
  let backToBack = state.backToBack
  let lines = state.lines
  let level = state.level
  let garbageSent = 0

  if (linesCleared > 0) {
    combo++
    const isTetris = linesCleared === 4
    let points = LINE_CLEAR_POINTS[linesCleared] * level

    // Back-to-back bonus
    if (isTetris && backToBack) {
      points = Math.floor(points * B2B_MULTIPLIER)
    }
    backToBack = isTetris

    // Aged clear bonus — older cells in cleared rows earn more
    const ageTier = getAgeTier(avgAgeRatio)
    points = Math.floor(points * ageTier.multiplier)

    // Combo bonus
    if (combo > 0) {
      points += COMBO_BONUS * combo * level
    }

    score += points
    lines += linesCleared
    garbageSent = LINE_CLEAR_GARBAGE[linesCleared]

    // Level up check
    const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1
    if (newLevel > level) {
      level = newLevel
      events.push({ type: 'levelUp', player: playerIdx })
    }

    events.push({
      type: 'lineClear',
      player: playerIdx,
      linesCleared,
      ageTier: ageTier.name,
      ageMultiplier: ageTier.multiplier,
    })
  } else {
    combo = -1
  }

  // Spawn next piece
  const newState = spawnPiece(
    {
      ...state,
      board: clearedBoard,
      cellAges: clearedAges,
      currentPiece: null,
      score,
      combo,
      backToBack,
      lines,
      level,
      pendingGarbage: 0,
      garbageGapCol: state.garbageGapCol,
    },
    time,
  )

  if (newState.gameOver) {
    events.push({ type: 'gameOver', player: playerIdx })
  }

  return { state: newState, events, garbageSent } as { state: PlayerState; events: GameEvent[] } & { garbageSent?: number }
}

// ── Garbage Lines ───────────────────────────────────────────────

function addGarbageLines(board: CellValue[][], cellAges: number[][], count: number, gapCol: number, time: number): { board: CellValue[][]; cellAges: number[][] } {
  // In inverted Tetris, garbage lines are added at the TOP (row 0)
  // This pushes the existing stack downward
  const newBoard = board.map(row => [...row])
  const newAges = cellAges.map(row => [...row])

  for (let i = 0; i < count; i++) {
    // Remove bottom row (it falls off)
    newBoard.pop()
    newAges.pop()
    // Add garbage row at top (fresh timestamp — no free aged bonus)
    const garbageRow: CellValue[] = Array(COLS).fill('Z' as CellValue)
    garbageRow[gapCol] = null
    const garbageAgeRow: number[] = Array(COLS).fill(time)
    garbageAgeRow[gapCol] = 0
    newBoard.unshift(garbageRow)
    newAges.unshift(garbageAgeRow)
  }

  return { board: newBoard, cellAges: newAges }
}

// ── Hold Piece ──────────────────────────────────────────────────

function holdPiece(state: PlayerState, playerIdx: number, time: number): { state: PlayerState; events: GameEvent[] } {
  if (!state.currentPiece || state.holdUsed || state.gameOver) {
    return { state, events: [] }
  }

  const events: GameEvent[] = [{ type: 'hold', player: playerIdx }]
  const currentType = state.currentPiece.type
  const holdType = state.holdPiece

  if (holdType) {
    // Swap with hold
    const spawn = getSpawnPosition(holdType)
    const newPiece: Piece = {
      type: holdType,
      rotation: 0,
      row: spawn.row,
      col: spawn.col,
    }

    if (!isValidPosition(state.board, newPiece)) {
      return { state: { ...state, gameOver: true }, events: [...events, { type: 'gameOver', player: playerIdx }] }
    }

    return {
      state: {
        ...state,
        currentPiece: newPiece,
        holdPiece: currentType,
        holdUsed: true,
        lockTimer: null,
        lockResets: 0,
        lastGravityTime: time,
      },
      events,
    }
  }

  // No hold piece yet - put current in hold, spawn next
  const newState = spawnPiece(
    { ...state, currentPiece: null, holdPiece: currentType, holdUsed: true },
    time,
  )

  if (newState.gameOver) {
    events.push({ type: 'gameOver', player: playerIdx })
  }

  return { state: newState, events }
}

// ── Game State Creation ─────────────────────────────────────────

export function createGameState(mode: '1p' | '2p'): GameState {
  const time = performance.now()
  const players = [createPlayerState(time)]
  if (mode === '2p') {
    players.push(createPlayerState(time))
  }

  return {
    players,
    mode,
    paused: false,
    gameOverFlag: false,
    winner: null,
    startTime: time,
    muted: false,
  }
}

// ── Main Update Function ────────────────────────────────────────

export function updateGame(game: GameState, time: number): { game: GameState; events: GameEvent[] } {
  if (game.paused || game.gameOverFlag) return { game, events: [] }

  const allEvents: GameEvent[] = []
  const newPlayers = [...game.players]

  for (let i = 0; i < newPlayers.length; i++) {
    if (newPlayers[i].gameOver) continue

    // Ensure cellAges exists (handles HMR / legacy state migration)
    if (!newPlayers[i].cellAges) {
      newPlayers[i] = { ...newPlayers[i], cellAges: createCellAges() }
    }

    // ── Decay pass: remove cells whose lifespan has expired ──
    const vIndex = computeVolatilityIndex(newPlayers[i].board, newPlayers[i].cellAges, time, newPlayers[i].level)
    const lifespan = getDecayLifespan(newPlayers[i].level)
    const effectiveLifespan = vIndex > VOLATILITY_CONTAGION_THRESHOLD
      ? lifespan * VOLATILITY_CONTAGION_SPEEDUP
      : lifespan
    let decayed = false
    const board = newPlayers[i].board.map(row => [...row])
    const ages = newPlayers[i].cellAges.map(row => [...row])
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== null && ages[r][c] > 0) {
          if (time - ages[r][c] >= effectiveLifespan) {
            board[r][c] = null
            ages[r][c] = 0
            decayed = true
          }
        }
      }
    }
    if (decayed) {
      newPlayers[i] = { ...newPlayers[i], board, cellAges: ages }
      allEvents.push({ type: 'decay', player: i })
    }

    // Apply gravity
    const { state: afterGravity } = applyGravity(newPlayers[i], time)
    let playerState = afterGravity

    // Check lock timer
    if (playerState.lockTimer !== null && playerState.currentPiece) {
      if (time - playerState.lockTimer >= LOCK_DELAY) {
        const { state: locked, events } = lockAndSpawn(playerState, i, time, [])
        playerState = locked
        allEvents.push(...events)

        // Handle garbage sending in 2p
        const result = { state: locked, events } as { state: PlayerState; events: GameEvent[] } & { garbageSent?: number }
        if (game.mode === '2p' && result.garbageSent && result.garbageSent > 0) {
          const opponentIdx = 1 - i
          if (!newPlayers[opponentIdx].gameOver) {
            newPlayers[opponentIdx] = {
              ...newPlayers[opponentIdx],
              pendingGarbage: newPlayers[opponentIdx].pendingGarbage + result.garbageSent,
              garbageGapCol: Math.floor(Math.random() * COLS),
            }
          }
        }
      }
    }

    newPlayers[i] = playerState
  }

  // Check game over conditions
  let gameOverFlag: boolean = game.gameOverFlag
  let winner: number | null = game.winner

  if (game.mode === '1p') {
    if (newPlayers[0].gameOver) gameOverFlag = true
  } else {
    const p1Over = newPlayers[0].gameOver
    const p2Over = newPlayers[1].gameOver
    if (p1Over || p2Over) {
      gameOverFlag = true
      if (p1Over && !p2Over) winner = 1
      else if (!p1Over && p2Over) winner = 0
      else winner = null // draw
    }
  }

  return {
    game: { ...game, players: newPlayers, gameOverFlag, winner },
    events: allEvents,
  }
}

// ── Action Processing ───────────────────────────────────────────

export function processAction(
  game: GameState,
  action: { type: string; player: number; dx?: number; time?: number },
): { game: GameState; events: GameEvent[] } {
  if (game.paused && action.type !== 'restart') return { game, events: [] }
  if (game.gameOverFlag && action.type !== 'restart') return { game, events: [] }

  const playerIdx = action.player
  if (playerIdx < 0 || playerIdx >= game.players.length) return { game, events: [] }

  const player = game.players[playerIdx]
  if (player.gameOver) return { game, events: [] }

  const time = action.time ?? performance.now()
  let newPlayer: PlayerState
  let events: GameEvent[] = []

  switch (action.type) {
    case 'move': {
      newPlayer = movePiece(player, action.dx ?? 0, 0)
      if (newPlayer !== player) events.push({ type: 'move', player: playerIdx })
      break
    }
    case 'rotateCW': {
      newPlayer = rotatePiece(player, true)
      if (newPlayer !== player) events.push({ type: 'rotate', player: playerIdx })
      break
    }
    case 'rotateCCW': {
      newPlayer = rotatePiece(player, false)
      if (newPlayer !== player) events.push({ type: 'rotate', player: playerIdx })
      break
    }
    case 'softDrop': {
      const result = softDrop(player)
      newPlayer = result.state
      break
    }
    case 'hardDrop': {
      const result = hardDrop(player, playerIdx, time)
      newPlayer = result.state

      // Handle garbage in 2p
      const hdResult = result as { state: PlayerState; events: GameEvent[] } & { garbageSent?: number }
      events = hdResult.events
      if (game.mode === '2p' && hdResult.garbageSent && hdResult.garbageSent > 0) {
        const opponentIdx = 1 - playerIdx
        const newPlayers = [...game.players]
        newPlayers[playerIdx] = newPlayer
        if (!newPlayers[opponentIdx].gameOver) {
          newPlayers[opponentIdx] = {
            ...newPlayers[opponentIdx],
            pendingGarbage: newPlayers[opponentIdx].pendingGarbage + hdResult.garbageSent,
            garbageGapCol: Math.floor(Math.random() * COLS),
          }
        }

        let gameOverFlag = game.gameOverFlag
        let winner = game.winner
        if (newPlayer.gameOver) {
          if (game.mode === '2p') {
            gameOverFlag = true
            winner = 1 - playerIdx
          } else {
            gameOverFlag = true
          }
        }

        return {
          game: { ...game, players: newPlayers, gameOverFlag, winner },
          events,
        }
      }
      break
    }
    case 'hold': {
      const result = holdPiece(player, playerIdx, time)
      newPlayer = result.state
      events = result.events
      break
    }
    default:
      return { game, events: [] }
  }

  const newPlayers = [...game.players]
  newPlayers[playerIdx] = newPlayer

  let gameOverFlag = game.gameOverFlag
  let winner = game.winner
  if (newPlayer.gameOver) {
    if (game.mode === '2p') {
      gameOverFlag = true
      winner = 1 - playerIdx
    } else {
      gameOverFlag = true
    }
    events.push({ type: 'gameOver', player: playerIdx })
  }

  return {
    game: { ...game, players: newPlayers, gameOverFlag, winner },
    events,
  }
}

// ── Utility Exports ─────────────────────────────────────────────

export { getGravityInterval, VISIBLE_ROWS, HIDDEN_ROWS }
