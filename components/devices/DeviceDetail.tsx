'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDeviceDetail } from './hooks/useDeviceDetail'
import { DeviceInfoSection } from './sections/DeviceInfoSection'
import { DependencyTreeView } from './dependencies/DependencyTreeView'
import { TweakPanel } from './tweaks/TweakPanel'
import { CombinationsView } from './combinations/CombinationsView'
import type { PlayerDeviceState } from '@/types/devices'

type Tab = 'info' | 'deps' | 'influence' | 'tweaks' | 'combos'

interface DeviceDetailProps {
  deviceId: string
  playerState?: PlayerDeviceState | null
  onBack: () => void
  onNavigate?: (view: string) => void
}

const TABS: { key: Tab; label: string; shortcut: string }[] = [
  { key: 'info', label: 'INFO', shortcut: 'I' },
  { key: 'deps', label: 'DEPS', shortcut: 'D' },
  { key: 'influence', label: 'INFLUENCE', shortcut: 'N' },
  { key: 'tweaks', label: 'TWEAKS', shortcut: 'T' },
  { key: 'combos', label: 'COMBOS', shortcut: 'C' },
]

const STATE_COLORS: Record<string, string> = {
  online: 'text-green-400',
  standby: 'text-amber-400',
  offline: 'text-green-500/30',
  error: 'text-red-500',
  upgrading: 'text-cyan-400',
}

function InfluencePlaceholder({ deviceId }: { deviceId: string }) {
  return (
    <div className="font-mono text-[10px] text-green-500/40 py-4 px-2">
      INFLUENCE MAP FOR {deviceId} — NOT YET IMPLEMENTED
    </div>
  )
}


export function DeviceDetail({ deviceId, playerState, onBack, onNavigate }: DeviceDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('info')

  const { device, state, dependencies, combinations, tweaks, loading, error } = useDeviceDetail({
    deviceId,
    playerState,
  })

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
    const key = e.key.toUpperCase()
    if (key === 'ESCAPE' || key === 'B') { onBack(); return }
    const tab = TABS.find((t) => t.shortcut === key)
    if (tab) setActiveTab(tab.key)
  }, [onBack])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const currentState = playerState?.current_state ?? state?.state ?? 'offline'
  const stateColor = STATE_COLORS[currentState] ?? 'text-green-500/30'

  if (loading) {
    return (
      <div className="font-mono text-[10px] text-green-500/40 py-4">
        <span className="animate-pulse">LOADING DEVICE {deviceId}...</span>
      </div>
    )
  }

  if (error || !device) {
    return (
      <div className="font-mono text-[10px] text-red-500 py-4">
        ERR: {error ?? `DEVICE ${deviceId} NOT FOUND`}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Device header */}
      <div className="font-mono text-[10px] whitespace-pre">
        <div className="text-green-500/30">╔{'═'.repeat(76)}╗</div>
        <div className="flex">
          <span className="text-green-500/30">║ </span>
          <span className="text-green-500/60">DEVICE: </span>
          <span className="text-green-400 text-glow-green">{device.name}</span>
          <span className="flex-1" />
          <span className={stateColor}>{currentState.toUpperCase()}</span>
          <span className="text-green-500/30"> ║</span>
        </div>
        <div className="flex">
          <span className="text-green-500/30">║ </span>
          <span className="text-green-500/60">ID: </span>
          <span className="text-green-400">{device.device_id}</span>
          <span className="text-green-500/30 ml-4">│</span>
          <span className="text-green-500/60 ml-2">{device.version}</span>
          <span className="text-green-500/30 ml-4">│</span>
          <span className="text-cyan-400 ml-2">{device.tech_tree}</span>
          <span className="flex-1" />
          <span className="text-green-500/30">║</span>
        </div>
        <div className="text-green-500/30">╠{'═'.repeat(76)}╣</div>
      </div>

      {/* Tab bar */}
      <div className="font-mono text-[10px] flex items-center gap-0 whitespace-pre">
        <span className="text-green-500/30">║ </span>
        {TABS.map((tab, i) => (
          <span key={tab.key}>
            {i > 0 && <span className="text-green-500/20"> │ </span>}
            <button
              onClick={() => setActiveTab(tab.key)}
              className={`cursor-pointer px-1 ${
                activeTab === tab.key
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-green-500/50 hover:text-green-400'
              }`}
            >
              [{tab.shortcut}] {tab.label}
            </button>
          </span>
        ))}
        <span className="flex-1" />
        <button
          onClick={onBack}
          className="text-green-500/50 hover:text-green-400 cursor-pointer"
        >
          [B] BACK
        </button>
        <span className="text-green-500/30"> ║</span>
      </div>
      <div className="font-mono text-[10px] text-green-500/30 whitespace-pre">
        {'╠' + '═'.repeat(76) + '╣'}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === 'info' && (
          <DeviceInfoSection
            device={device}
            state={state}
            playerState={playerState ?? null}
          />
        )}
        {activeTab === 'deps' && <DependencyTreeView deviceId={deviceId} onBack={onBack} />}
        {activeTab === 'influence' && <InfluencePlaceholder deviceId={deviceId} />}
        {activeTab === 'tweaks' && playerState && (
          <TweakPanel deviceId={deviceId} playerId={playerState.player_id} onBack={onBack} />
        )}
        {activeTab === 'tweaks' && !playerState && (
          <div className="font-mono text-[10px] text-green-500/40 py-4 px-2">TWEAKS REQUIRE PLAYER SESSION</div>
        )}
        {activeTab === 'combos' && playerState && (
          <CombinationsView
            deviceId={deviceId}
            playerId={playerState.player_id}
            onLink={() => {}}
            onUnlink={() => {}}
            onBack={onBack}
          />
        )}
        {activeTab === 'combos' && !playerState && (
          <div className="font-mono text-[10px] text-green-500/40 py-4 px-2">COMBOS REQUIRE PLAYER SESSION</div>
        )}
      </div>

      {/* Footer */}
      <div className="font-mono text-[10px] text-green-500/30 whitespace-pre">
        {'╚' + '═'.repeat(76) + '╝'}
      </div>
      <div className="font-mono text-[9px] text-green-500/30 flex justify-between">
        <span>ESC/B:BACK  I:INFO  D:DEPS  N:INFLUENCE  T:TWEAKS  C:COMBOS</span>
        <span>{device.device_id}</span>
      </div>
    </div>
  )
}
