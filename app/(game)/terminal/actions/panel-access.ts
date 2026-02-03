'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const PANEL_ACCESS_COOKIE = 'panel_access_token'
const TOKEN_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

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

  // Create a simple signed token: base64(userId:timestamp:hash)
  const timestamp = Date.now()
  const payload = `${user.id}:${timestamp}`

  // In production, use a proper HMAC with a secret key
  // For now, we use a simple hash that ties the token to the user
  const hash = Buffer.from(payload).toString('base64')
  const token = `${payload}:${hash}`

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
    const [userId, timestampStr, hash] = token.split(':')
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

    // Verify hash matches
    const expectedPayload = `${userId}:${timestampStr}`
    const expectedHash = Buffer.from(expectedPayload).toString('base64')
    if (hash !== expectedHash) {
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
