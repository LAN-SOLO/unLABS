'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createHmac, timingSafeEqual } from 'crypto'

const PANEL_ACCESS_COOKIE = 'panel_access_token'
const TOKEN_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// SECURITY: Use environment variable for HMAC secret
// Falls back to a derived key from Supabase anon key (not ideal, but better than nothing)
function getHmacSecret(): string {
  const secret = process.env.PANEL_TOKEN_SECRET
  if (secret) return secret

  // Fallback: derive from existing env var (still better than hardcoded)
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!fallback) {
    throw new Error('No secret available for token signing')
  }
  return `panel_token_${fallback.slice(0, 32)}`
}

/**
 * Generate HMAC-SHA256 signature for panel token.
 */
function signToken(payload: string): string {
  const hmac = createHmac('sha256', getHmacSecret())
  hmac.update(payload)
  return hmac.digest('hex')
}

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison.
 */
function verifySignature(payload: string, signature: string): boolean {
  const expected = signToken(payload)
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

/**
 * Generate a secure panel access token.
 * This is called when user runs the panel unlock command in terminal.
 * Token is stored in an HTTP-only cookie that can't be manipulated via JS.
 */
export async function grantPanelAccess(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Create HMAC-signed token: userId:timestamp:signature
  const timestamp = Date.now()
  const payload = `${user.id}:${timestamp}`
  const signature = signToken(payload)
  const token = `${payload}:${signature}`

  const cookieStore = await cookies()
  cookieStore.set(PANEL_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY_MS / 1000, // seconds
    path: '/',
  })

  return { success: true }
}

/**
 * Verify panel access token.
 * Called by panel page to check if user has valid access.
 */
export async function verifyPanelAccess(): Promise<{ valid: boolean; userId?: string }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { valid: false }
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(PANEL_ACCESS_COOKIE)?.value

  if (!token) {
    return { valid: false }
  }

  try {
    const parts = token.split(':')
    if (parts.length !== 3) {
      return { valid: false }
    }

    const [userId, timestampStr, signature] = parts
    const timestamp = parseInt(timestampStr, 10)

    // Verify token belongs to current user
    if (userId !== user.id) {
      return { valid: false }
    }

    // Verify token hasn't expired
    if (Date.now() - timestamp > TOKEN_EXPIRY_MS) {
      // Clean up expired token
      cookieStore.delete(PANEL_ACCESS_COOKIE)
      return { valid: false }
    }

    // Verify HMAC signature using timing-safe comparison
    const payload = `${userId}:${timestampStr}`
    if (!verifySignature(payload, signature)) {
      return { valid: false }
    }

    return { valid: true, userId: user.id }
  } catch {
    return { valid: false }
  }
}

/**
 * Revoke panel access (called on logout/shutdown).
 */
export async function revokePanelAccess(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PANEL_ACCESS_COOKIE)
}
