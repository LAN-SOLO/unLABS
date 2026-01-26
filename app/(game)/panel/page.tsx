import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PanelClient } from './panel-client'

interface ProfileData {
  username: string | null
  display_name: string | null
}

interface BalanceData {
  available: number
  staked: number
}

export default async function PanelPage() {
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

  const username =
    profile?.username || profile?.display_name || user.email?.split('@')[0] || null
  const availableBalance = balance?.available || 0

  return (
    <PanelClient
      userId={user.id}
      username={username}
      balance={availableBalance}
    />
  )
}
