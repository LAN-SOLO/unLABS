import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/actions'
import { Terminal } from '@/components/terminal'
import { TerminalPowerWrapper } from './terminal-power-wrapper'

interface ProfileData {
  username: string | null
  display_name: string | null
}

interface BalanceData {
  available: number
  staked: number
}

export default async function TerminalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  let profile: ProfileData | null = null
  let balance: BalanceData | null = null

  try {
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', user.id)
      .single()
    profile = data as ProfileData | null
  } catch {
    // Table may not exist yet
  }

  try {
    const { data } = await supabase
      .from('balances')
      .select('available, staked')
      .eq('user_id', user.id)
      .single()
    balance = data as BalanceData | null
  } catch {
    // Table may not exist yet
  }

  const username = profile?.username || profile?.display_name || user.email?.split('@')[0] || null
  const availableBalance = balance?.available || 0

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        }}
      />

      {/* CRT glow effect */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          boxShadow: 'inset 0 0 100px rgba(34, 197, 94, 0.1)',
        }}
      />

      <div className="h-screen flex items-center justify-center p-4">
        {/* Terminal window - Fixed 4:3 aspect ratio (800x600) */}
        <div
          className="flex flex-col border border-green-500/30 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.15)]"
          style={{
            width: '800px',
            height: '600px',
            minWidth: '800px',
            minHeight: '600px',
            maxWidth: '800px',
            maxHeight: '600px',
            flexShrink: 0,
            flexGrow: 0,
          }}
        >
          {/* Title bar */}
          <div className="bg-green-900/20 border-b border-green-500/30 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70 hover:bg-red-500 transition-colors" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70 hover:bg-yellow-500 transition-colors" />
                <div className="w-3 h-3 rounded-full bg-green-500/70 hover:bg-green-500 transition-colors" />
              </div>
              <span className="text-green-500/70 text-xs ml-2">
                unLABS://terminal — {username || 'UNKNOWN'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-green-500/50 text-xs">
                {availableBalance.toFixed(2)} _unSC
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-red-500/70 text-xs hover:text-red-400 transition-colors"
                >
                  [DISCONNECT]
                </button>
              </form>
            </div>
          </div>

          {/* Terminal content */}
          <div className="flex-1 bg-black/95 p-4 overflow-hidden">
            <TerminalPowerWrapper
              userId={user.id}
              username={username}
              balance={availableBalance}
            />
          </div>
        </div>

        {/* Status bar */}
        <div className="shrink-0 mt-2 px-2 flex justify-between text-xs text-green-500/40">
          <span>SOLANA DEVNET</span>
          <span>v0.1.0-alpha</span>
          <span>↑↓ HISTORY | ESC CLEAR | ENTER EXECUTE</span>
        </div>
      </div>
    </div>
  )
}
