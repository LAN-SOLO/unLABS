'use client'

import { useState, useCallback, useEffect } from 'react'
import { SysprefHeader } from './SysprefHeader'
import { SysprefSidebar } from './SysprefSidebar'
import { SysprefFooter } from './SysprefFooter'
import { AboutPanel } from './panels/AboutPanel'
import { DisplayPanel } from './panels/DisplayPanel'
import { SoundPanel } from './panels/SoundPanel'
import { NetworkPanel } from './panels/NetworkPanel'
import { UserPanel } from './panels/UserPanel'
import type { SysprefArea } from './SysprefSidebar'

interface SysprefAppProps {
  userId: string
  username?: string | null
  onExit: () => void
}

export function SysprefApp({ userId, username, onExit }: SysprefAppProps) {
  const [currentArea, setCurrentArea] = useState<SysprefArea>('about')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSignal, setSaveSignal] = useState(0)
  const [resetSignal, setResetSignal] = useState(0)

  const handleSave = useCallback(() => {
    setSaving(true)
    setSaveSignal(s => s + 1)
    // Panels react to saveSignal and persist. We just show a brief saving state.
    setTimeout(() => {
      setSaving(false)
      setHasUnsavedChanges(false)
    }, 500)
  }, [])

  const handleReset = useCallback(() => {
    setResetSignal(s => s + 1)
    setHasUnsavedChanges(false)
  }, [])

  const handleQuit = useCallback(() => {
    onExit()
  }, [onExit])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault()
        handleQuit()
      } else if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handleReset()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleQuit()
      } else if (e.key >= '1' && e.key <= '6') {
        const areas: SysprefArea[] = ['about', 'display', 'sound', 'network', 'user', 'datetime']
        const idx = parseInt(e.key) - 1
        if (idx < areas.length) {
          setCurrentArea(areas[idx])
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleQuit, handleSave, handleReset])

  const renderPanel = () => {
    switch (currentArea) {
      case 'about':
        return <AboutPanel />
      case 'display':
        return (
          <DisplayPanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
      case 'sound':
        return (
          <SoundPanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
      case 'network':
        return (
          <NetworkPanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
      case 'user':
        return <UserPanel userId={userId} username={username ?? null} />
      case 'datetime':
        return <PlaceholderPanel name="Date & Time" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void,#0A0A0A)] text-[var(--crt-green,#00FF41)] font-mono text-sm">
      <SysprefHeader hasUnsavedChanges={hasUnsavedChanges} />
      <div className="flex flex-1 overflow-hidden">
        <SysprefSidebar currentArea={currentArea} onAreaChange={setCurrentArea} />
        <main className="flex-1 p-2 overflow-y-auto" role="main" aria-label={`${currentArea} settings`}>
          {renderPanel()}
        </main>
      </div>
      <SysprefFooter
        hasUnsavedChanges={hasUnsavedChanges}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        onQuit={handleQuit}
      />
    </div>
  )
}

function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div className="p-4 text-[var(--state-offline,#666)]">
      <div className="border border-current p-4 text-center">
        <div className="text-lg mb-2">{name} Preferences</div>
        <div>Coming in a future phase...</div>
      </div>
    </div>
  )
}
