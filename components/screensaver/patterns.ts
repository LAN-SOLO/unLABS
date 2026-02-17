import type { MoireParams, LissajousParams, PlasmaParams, TunnelParams, SpirographParams, MatrixParams, WarpParams } from './types'

// ─── Moire Interference ──────────────────────────────────────────────
export function renderMoire(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
  params: MoireParams, color: string
) {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const maxR = Math.max(w, h) * 0.7
  const dist = (params.centerDistance / 100) * Math.min(w, h) * 0.3
  const speed = (params.rotationSpeed / 100) * 2

  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = color
  ctx.lineWidth = params.lineWidth

  for (let set = 0; set < 2; set++) {
    const angle = time * speed + set * Math.PI
    const ox = cx + Math.cos(angle) * dist
    const oy = cy + Math.sin(angle) * dist

    const ringSpacing = maxR / params.ringCount
    for (let i = 1; i <= params.ringCount; i++) {
      ctx.beginPath()
      ctx.arc(ox, oy, i * ringSpacing, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  ctx.globalCompositeOperation = 'source-over'
}

// ─── Lissajous Curves ────────────────────────────────────────────────
export function renderLissajous(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
  params: LissajousParams, color: string
) {
  ctx.fillStyle = 'rgba(0,0,0,0.02)'
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const ampX = w * 0.42
  const ampY = h * 0.42
  const a = params.freqA
  const b = params.freqB
  const phaseSpeed = (params.phaseSpeed / 100) * 0.5
  const delta = time * phaseSpeed
  const trailPts = params.trailLength

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()

  for (let i = 0; i <= trailPts; i++) {
    const t = (i / trailPts) * Math.PI * 2 + time * 0.3
    const x = cx + ampX * Math.sin(a * t + delta)
    const y = cy + ampY * Math.sin(b * t)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Bright leading dot
  const tHead = time * 0.3 + Math.PI * 2
  const hx = cx + ampX * Math.sin(a * tHead + delta)
  const hy = cy + ampY * Math.sin(b * tHead)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(hx, hy, 3, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Plasma Field ────────────────────────────────────────────────────
const PALETTES: Record<string, (v: number) => [number, number, number]> = {
  neon: (v) => [
    Math.floor(128 + 127 * Math.sin(v)),
    Math.floor(128 + 127 * Math.sin(v + 2.094)),
    Math.floor(128 + 127 * Math.sin(v + 4.189)),
  ],
  fire: (v) => [
    Math.min(255, Math.floor(200 + 55 * Math.sin(v))),
    Math.floor(Math.max(0, 128 * Math.sin(v * 0.8))),
    Math.floor(Math.max(0, 40 * Math.sin(v * 0.5))),
  ],
  ocean: (v) => [
    Math.floor(Math.max(0, 40 * Math.sin(v * 0.7))),
    Math.floor(128 + 80 * Math.sin(v + 1.0)),
    Math.min(255, Math.floor(180 + 75 * Math.sin(v + 0.5))),
  ],
  acid: (v) => [
    Math.floor(Math.max(0, 100 * Math.sin(v * 1.3))),
    Math.min(255, Math.floor(180 + 75 * Math.sin(v))),
    Math.floor(Math.max(0, 80 * Math.sin(v * 0.9))),
  ],
  mono: (v) => {
    const g = Math.floor(128 + 127 * Math.sin(v))
    return [g, g, g]
  },
}

// Reusable plasma buffers — avoids allocating ImageData + OffscreenCanvas every frame
let plasmaImageData: ImageData | null = null
let plasmaOffscreen: OffscreenCanvas | null = null
let plasmaBufW = 0
let plasmaBufH = 0

export function renderPlasma(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
  params: PlasmaParams, color: string
) {
  // Use lower resolution for performance, then scale
  const scale = Math.max(2, Math.round(6 - params.complexity))
  const pw = Math.ceil(w / scale)
  const ph = Math.ceil(h / scale)

  // Reuse buffers if size matches, otherwise reallocate
  if (!plasmaImageData || plasmaBufW !== pw || plasmaBufH !== ph) {
    plasmaImageData = ctx.createImageData(pw, ph)
    plasmaOffscreen = new OffscreenCanvas(pw, ph)
    plasmaBufW = pw
    plasmaBufH = ph
  }

  const data = plasmaImageData.data
  const sFreq = (params.scale / 100) * 0.05
  const tSpeed = (params.speed / 100) * 2
  const t = time * tSpeed

  const palette = PALETTES[params.palette] ?? PALETTES.neon

  void color

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const sx = x * scale
      const sy = y * scale

      let v = Math.sin(sx * sFreq + t)
      v += Math.sin(sy * sFreq * 1.1 + t * 0.7)
      v += Math.sin((sx * sFreq + sy * sFreq * 0.8 + t) * 0.7)
      if (params.complexity >= 3) v += Math.sin(Math.sqrt(sx * sx * sFreq * sFreq + sy * sy * sFreq * sFreq * 0.6) + t * 0.5)
      if (params.complexity >= 4) v += Math.sin(sx * sFreq * 1.5 - sy * sFreq * 0.5 + t * 1.2) * 0.5
      if (params.complexity >= 5) v += Math.cos(sx * sFreq * 0.7 + sy * sFreq * 1.3 + t * 0.9) * 0.3

      const [r, g, b] = palette(v)
      const idx = (y * pw + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
    }
  }

  const offCtx = plasmaOffscreen!.getContext('2d')!
  offCtx.putImageData(plasmaImageData, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(plasmaOffscreen!, 0, 0, w, h)
}

// ─── Infinity Tunnel ─────────────────────────────────────────────────
function drawTunnelShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, shape: string, rotation: number) {
  if (shape === 'hex') {
    ctx.beginPath()
    for (let s = 0; s < 6; s++) {
      const a = rotation + (s * Math.PI * 2) / 6
      const x = cx + r * Math.cos(a)
      const y = cy + r * Math.sin(a)
      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  } else if (shape === 'square') {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    const half = r * 0.707
    ctx.strokeRect(-half, -half, half * 2, half * 2)
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

export function renderTunnel(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
  params: TunnelParams, color: string
) {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const maxR = Math.max(w, h) * 0.8
  const speed = (params.speed / 100) * 3
  const rotSpeed = (params.rotationSpeed / 100) * 1.5
  const perspective = maxR * 0.3

  const frac = (time * speed) % 1
  const rings = params.ringCount

  for (let i = rings; i >= 0; i--) {
    const depth = i - frac
    if (depth <= 0) continue
    const radius = perspective / depth * 4
    if (radius > maxR) continue

    const alpha = Math.max(0.1, 1 - depth / rings)
    ctx.strokeStyle = color
    ctx.globalAlpha = alpha
    ctx.lineWidth = Math.max(1, 3 - depth * 0.15)

    const rotation = time * rotSpeed + depth * 0.3
    drawTunnelShape(ctx, cx, cy, radius, params.shape, rotation)
  }

  ctx.globalAlpha = 1
}

// ─── Spirograph ──────────────────────────────────────────────────────
export function renderSpirograph(
  ctx: CanvasRenderingContext2D, w: number, h: number, time: number,
  params: SpirographParams, color: string
) {
  // Partial fade for trails
  const fadeAlpha = Math.max(0.005, (params.fadeRate / 100) * 0.05)
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(w, h) / 250

  const R = (params.outerRadius / 100) * 100 * scale
  const r = (params.innerRadius / 100) * 100 * scale
  const d = (params.penOffset / 100) * 80 * scale
  const speed = (params.speed / 100) * 4

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const steps = 300
  const tBase = time * speed
  for (let i = 0; i <= steps; i++) {
    const t = tBase + (i / steps) * Math.PI * 2
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// ─── Matrix Rain ─────────────────────────────────────────────────────
interface MatrixState {
  columns: number[]
  chars: string[][]
  inited: boolean
  lastW: number
  lastH: number
  lastStepTime: number
}

const CHARSETS: Record<string, () => string> = {
  katakana: () => String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)),
  latin: () => String.fromCharCode(33 + Math.floor(Math.random() * 94)),
  binary: () => Math.random() > 0.5 ? '1' : '0',
  hex: () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)],
  mixed: () => {
    const r = Math.random()
    if (r < 0.5) return String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))
    if (r < 0.8) return String.fromCharCode(33 + Math.floor(Math.random() * 94))
    return '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
  },
}

export function renderMatrix(
  ctx: CanvasRenderingContext2D, w: number, h: number, _time: number,
  params: MatrixParams, color: string,
  stateRef?: React.MutableRefObject<unknown>
) {
  if (!stateRef) return

  const fontSize = params.fontSize
  const numCols = Math.ceil(w / fontSize)
  const numRows = Math.ceil(h / fontSize)
  const state = stateRef.current as MatrixState | null

  // Initialize or resize
  if (!state || !state.inited || state.lastW !== numCols || state.lastH !== numRows) {
    const columns = new Array(numCols).fill(0).map(() =>
      Math.random() > (1 - params.density / 100) ? Math.floor(Math.random() * numRows) : -Math.floor(Math.random() * numRows)
    )
    const chars: string[][] = Array.from({ length: numCols }, () =>
      Array.from({ length: numRows }, () => '')
    )
    stateRef.current = { columns, chars, inited: true, lastW: numCols, lastH: numRows, lastStepTime: _time }
  }

  const st = stateRef.current as MatrixState
  const charFn = CHARSETS[params.charset] ?? CHARSETS.katakana

  // Speed maps to step interval: speed=1 → 500ms between steps, speed=100 → 30ms
  const stepInterval = 0.5 - (params.speed / 100) * 0.47 // 0.50s … 0.03s
  const elapsed = _time - st.lastStepTime
  const steps = Math.floor(elapsed / stepInterval)

  // Fade background every frame for smooth trails
  ctx.fillStyle = 'rgba(0,0,0,0.05)'
  ctx.fillRect(0, 0, w, h)

  if (steps > 0) {
    st.lastStepTime += steps * stepInterval

    ctx.font = `${fontSize}px monospace`

    for (let i = 0; i < numCols; i++) {
      for (let s = 0; s < steps; s++) {
        const row = st.columns[i]
        if (row >= 0 && row < numRows) {
          const ch = charFn()
          st.chars[i][row] = ch

          // Head character is white/bright
          ctx.fillStyle = '#fff'
          ctx.fillText(ch, i * fontSize, (row + 1) * fontSize)

          // Previous character in stream color
          if (row > 0 && st.chars[i][row - 1]) {
            ctx.fillStyle = color
            ctx.fillText(st.chars[i][row - 1], i * fontSize, row * fontSize)
          }
        }

        st.columns[i]++

        // Reset column
        if (st.columns[i] > numRows + Math.floor(Math.random() * numRows)) {
          if (Math.random() < params.density / 100) {
            st.columns[i] = 0
          } else {
            st.columns[i] = -Math.floor(Math.random() * numRows)
          }
        }
      }
    }
  }
}

// ─── Star Warp ───────────────────────────────────────────────────────
interface Star {
  x: number
  y: number
  z: number
  pz: number
}

interface WarpState {
  stars: Star[]
  inited: boolean
  count: number
}

export function renderWarp(
  ctx: CanvasRenderingContext2D, w: number, h: number, _time: number,
  params: WarpParams, color: string,
  stateRef?: React.MutableRefObject<unknown>
) {
  if (!stateRef) return

  const state = stateRef.current as WarpState | null
  const count = params.starCount

  if (!state || !state.inited || state.count !== count) {
    const stars: Star[] = Array.from({ length: count }, () => {
      const x = (Math.random() - 0.5) * w * 2
      const y = (Math.random() - 0.5) * h * 2
      const z = Math.random() * w
      return { x, y, z, pz: z }
    })
    stateRef.current = { stars, inited: true, count }
  }

  const st = stateRef.current as WarpState
  const speed = (params.speed / 100) * 20
  const trailAlpha = params.trailLength / 100
  const fov = params.fov
  const cx = w / 2
  const cy = h / 2

  // Fade
  ctx.fillStyle = `rgba(0,0,0,${0.15 - trailAlpha * 0.12})`
  ctx.fillRect(0, 0, w, h)

  // Batch streaks by brightness bucket to minimize state changes
  // Use 3 buckets: dim (0.2-0.45), mid (0.45-0.7), bright (0.7-1.0)
  const buckets: { px: number; py: number; sx: number; sy: number; r: number }[][] = [[], [], []]

  for (const star of st.stars) {
    star.pz = star.z
    star.z -= speed

    if (star.z <= 1) {
      star.x = (Math.random() - 0.5) * w * 2
      star.y = (Math.random() - 0.5) * h * 2
      star.z = w
      star.pz = w
      continue
    }

    const sx = cx + (star.x / star.z) * fov
    const sy = cy + (star.y / star.z) * fov
    const px = cx + (star.x / star.pz) * fov
    const py = cy + (star.y / star.pz) * fov
    const r = Math.max(0.5, (1 - star.z / w) * 3)
    const alpha = Math.max(0.2, 1 - star.z / w)
    const bucket = alpha < 0.45 ? 0 : alpha < 0.7 ? 1 : 2
    buckets[bucket].push({ px, py, sx, sy, r })
  }

  // Draw streaks — 3 batched paths instead of N individual ones
  const alphas = [0.3, 0.55, 0.85]
  ctx.strokeStyle = color
  for (let b = 0; b < 3; b++) {
    if (buckets[b].length === 0) continue
    ctx.globalAlpha = alphas[b]
    ctx.lineWidth = b === 0 ? 0.5 : b === 1 ? 1.5 : 2.5
    ctx.beginPath()
    for (const s of buckets[b]) {
      ctx.moveTo(s.px, s.py)
      ctx.lineTo(s.sx, s.sy)
    }
    ctx.stroke()
  }

  // Draw bright heads — single batched path
  ctx.fillStyle = '#fff'
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  for (let b = 0; b < 3; b++) {
    for (const s of buckets[b]) {
      ctx.moveTo(s.sx + s.r * 0.6, s.sy)
      ctx.arc(s.sx, s.sy, s.r * 0.6, 0, Math.PI * 2)
    }
  }
  ctx.fill()

  ctx.globalAlpha = 1
}
