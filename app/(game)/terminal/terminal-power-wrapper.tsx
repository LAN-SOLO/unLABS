'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Terminal } from '@/components/terminal'
import { SystemPowerManagerProvider, useSystemPowerInternal } from '@/contexts/SystemPowerManager'
import { CRTShutdownEffect } from '@/components/panel/effects/CRTShutdownEffect'
import { BootSequence } from '@/components/panel/effects/BootSequence'

interface Props {
  userId: string
  username: string | null
  balance: number
}

export function TerminalPowerWrapper({ userId, username, balance }: Props) {
  const router = useRouter()

  const handleShutdownComplete = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <SystemPowerManagerProvider onShutdownComplete={handleShutdownComplete}>
      <TerminalWithEffects userId={userId} username={username} balance={balance} />
    </SystemPowerManagerProvider>
  )
}

function TerminalWithEffects({ userId, username, balance }: Props) {
  const { systemState, powerScope, finishBoot, onShutdownComplete } = useSystemPowerInternal()

  const isSystemReboot = powerScope === 'system' && (systemState === 'rebooting' || systemState === 'booting')
  const holdCRTBlack = isSystemReboot

  const handleCRTComplete = useCallback(() => {
    if (systemState === 'shutting-down') {
      if (powerScope === 'os') {
        onShutdownComplete?.()
      }
    }
    if (systemState === 'rebooting' && powerScope === 'os') {
      window.location.reload()
    }
  }, [systemState, powerScope, onShutdownComplete])

  const handleBootComplete = useCallback(() => {
    finishBoot()
  }, [finishBoot])

  const crtActive = systemState === 'shutting-down' || systemState === 'rebooting'

  const effectScope = powerScope === 'os' ? 'os' : 'system'

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Terminal userId={userId} username={username} balance={balance} />

      <CRTShutdownEffect
        active={crtActive}
        onComplete={handleCRTComplete}
        holdBlack={holdCRTBlack}
        scope={effectScope}
      />

      {powerScope === 'system' && (
        <BootSequence active={systemState === 'booting'} onComplete={handleBootComplete} />
      )}

      {systemState === 'off' && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
          <p className="text-green-500/50 text-sm animate-pulse">System offline — press power to restart</p>
        </div>
      )}
    </div>
  )
}
