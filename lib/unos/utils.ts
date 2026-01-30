// _unOS v2.0 — Utility functions

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export function generateMAC(prefix: string = 'UN:OS'): string {
  const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  return `${prefix}:${hex()}:${hex()}:${hex()}`
}

export function octalToString(mode: number): string {
  return '0o' + mode.toString(8)
}

export function parseOctal(str: string): number | null {
  const cleaned = str.replace(/^0o/, '')
  const val = parseInt(cleaned, 8)
  return isNaN(val) ? null : val
}

export function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}
