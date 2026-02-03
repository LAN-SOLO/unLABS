import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const LAMPORTS_PER_SOL = 1_000_000_000

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
]

// Validate base58 Solana address (32-44 chars, base58 alphabet)
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // requests per window
const RATE_WINDOW = 60_000 // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT) {
    return false
  }

  entry.count++
  return true
}

export async function GET(request: NextRequest) {
  // SECURITY: Require authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Rate limiting per user
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429 }
    )
  }

  const address = request.nextUrl.searchParams.get('address')
  if (!address || !BASE58_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  // SECURITY: Optional - verify address belongs to user
  // Uncomment to restrict to user's own wallet only:
  // const { data: profile } = await supabase
  //   .from('profiles')
  //   .select('solana_address')
  //   .eq('id', user.id)
  //   .single()
  //
  // if (profile?.solana_address !== address) {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // }

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      })

      if (!res.ok) continue

      const data = await res.json()
      if (data.error) continue

      const lamports = data.result?.value ?? 0
      return NextResponse.json({ balance: lamports / LAMPORTS_PER_SOL })
    } catch {
      // try next endpoint
    }
  }

  return NextResponse.json({ error: 'RPC unavailable' }, { status: 502 })
}
