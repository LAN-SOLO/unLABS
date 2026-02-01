import type { ParsedTime } from './types'

const MIN_SECONDS = 10
const MAX_SECONDS = 359999 // 99h59m59s

/**
 * Parse a time string in format: -4h11m18s, -2h30m, -45m, -90s, -now
 * Leading dash is optional.
 */
export function parseTimeArg(input: string): ParsedTime {
  const original = input
  let str = input.trim()

  // Handle -now
  if (str === '-now' || str === 'now') {
    return { seconds: 0, wasAdjusted: false, original }
  }

  // Handle -cancel
  if (str === '-cancel' || str === 'cancel') {
    return { seconds: -1, wasAdjusted: false, original }
  }

  // Strip leading dash
  if (str.startsWith('-')) str = str.slice(1)

  // Match time components
  const pattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/
  const match = str.match(pattern)

  if (!match || str === '') {
    return {
      seconds: 0,
      wasAdjusted: false,
      original,
      error: `invalid time format: ${original}\nexpected: -XhYmZs, -Xm, -Xs, or -now`,
      errorCode: 'PWR-001',
    }
  }

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const secs = parseInt(match[3] || '0', 10)

  let totalSeconds = hours * 3600 + minutes * 60 + secs

  if (totalSeconds > MAX_SECONDS) {
    return {
      seconds: 0,
      wasAdjusted: false,
      original,
      error: `time exceeds maximum (99h59m59s): ${original}`,
      errorCode: 'PWR-003',
    }
  }

  let wasAdjusted = false
  if (totalSeconds > 0 && totalSeconds < MIN_SECONDS) {
    totalSeconds = MIN_SECONDS
    wasAdjusted = true
  }

  return { seconds: totalSeconds, wasAdjusted, original }
}

/** Format seconds as Xh Ym Zs string */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0 || parts.length === 0) parts.push(`${s}s`)
  return parts.join(' ')
}
