'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { SysprefHeader } from './SysprefHeader'
import { SysprefSidebar } from './SysprefSidebar'
import { SysprefFooter } from './SysprefFooter'
import { AboutPanel } from './panels/AboutPanel'
import { DisplayPanel } from './panels/DisplayPanel'
import { SoundPanel } from './panels/SoundPanel'
import { NetworkPanel } from './panels/NetworkPanel'
import { UserPanel } from './panels/UserPanel'
import { DatetimePanel } from './panels/DatetimePanel'
import type { SysprefArea } from './SysprefSidebar'

const AREAS: SysprefArea[] = ['about', 'display', 'sound', 'network', 'user', 'datetime']

interface SysprefAppProps {
  userId: string
  username?: string | null
  initialArea?: SysprefArea
  onExit: () => void
}

export function SysprefApp({ userId, username, initialArea, onExit }: SysprefAppProps) {
  const [currentArea, setCurrentArea] = useState<SysprefArea>(initialArea ?? 'about')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSignal, setSaveSignal] = useState(0)
  const [resetSignal, setResetSignal] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [previewColors, setPreviewColors] = useState<{ primary: string; secondary: string; bg: string } | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  const handleSave = useCallback(() => {
    setSaving(true)
    setSaveError(null)
    setSaveSignal(s => s + 1)
    setTimeout(() => {
      setSaving(false)
      setHasUnsavedChanges(false)
    }, 500)
  }, [])

  const handleReset = useCallback(() => {
    setResetSignal(s => s + 1)
    setHasUnsavedChanges(false)
    setSaveError(null)
  }, [])

  const handleQuit = useCallback(() => {
    if (hasUnsavedChanges && !confirmQuit) {
      setConfirmQuit(true)
      return
    }
    onExit()
  }, [onExit, hasUnsavedChanges, confirmQuit])

  // Reset confirm quit when changes are saved or area changes
  useEffect(() => {
    setConfirmQuit(false)
  }, [hasUnsavedChanges, currentArea])

  // Clear save error after 3s
  useEffect(() => {
    if (!saveError) return
    const t = setTimeout(() => setSaveError(null), 3000)
    return () => clearTimeout(t)
  }, [saveError])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
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
        if (confirmQuit) {
          setConfirmQuit(false)
        } else {
          handleQuit()
        }
      } else if (e.key === 'y' && confirmQuit) {
        e.preventDefault()
        onExit()
      } else if (e.key === 'n' && confirmQuit) {
        e.preventDefault()
        setConfirmQuit(false)
      } else if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key) - 1
        if (idx < AREAS.length) {
          setCurrentArea(AREAS[idx])
        }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        // Tab into panel content
        e.preventDefault()
        const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
          '[tabindex="0"], [role="switch"], [role="slider"], [role="combobox"], [role="radio"], input'
        )
        firstFocusable?.focus()
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleQuit, handleSave, handleReset, confirmQuit, onExit])

  const onSaveError = useCallback((msg: string) => {
    setSaveError(msg)
    setSaving(false)
  }, [])

  const renderPanel = () => {
    switch (currentArea) {
      case 'about':
        return <AboutPanel />
      case 'display':
        return (
          <DisplayPanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            onSaveError={onSaveError}
            onPreviewColors={setPreviewColors}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
      case 'sound':
        return (
          <SoundPanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            onSaveError={onSaveError}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
      case 'network':
        return (
          <NetworkPanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            onSaveError={onSaveError}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
      case 'user':
        return <UserPanel userId={userId} username={username ?? null} />
      case 'datetime':
        return (
          <DatetimePanel
            userId={userId}
            onDirty={setHasUnsavedChanges}
            onSaveError={onSaveError}
            saveSignal={saveSignal}
            resetSignal={resetSignal}
          />
        )
    }
  }

  // Apply preview colors as inline CSS variable overrides
  const rootStyle = useMemo(() => {
    if (!previewColors) return undefined
    return {
      '--crt-green': previewColors.primary,
      '--crt-phosphor': previewColors.secondary,
      '--bg-void': previewColors.bg,
      color: previewColors.primary,
      backgroundColor: previewColors.bg,
    } as React.CSSProperties
  }, [previewColors])

  // Clear preview when leaving display panel
  useEffect(() => {
    if (currentArea !== 'display') setPreviewColors(null)
  }, [currentArea])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void,#0A0A0A)] text-[var(--crt-green,#00FF41)] font-mono text-sm" style={rootStyle}>
      <SysprefHeader hasUnsavedChanges={hasUnsavedChanges} />

      {confirmQuit && (
        <div className="px-3 py-1 bg-[rgba(255,51,0,0.1)] border-b border-[var(--state-error,#FF3300)] text-[var(--state-error,#FF3300)] text-center">
          Unsaved changes will be lost. Quit anyway? [Y]es / [N]o
        </div>
      )}

      {saveError && (
        <div className="px-3 py-1 bg-[rgba(255,51,0,0.1)] border-b border-[var(--state-error,#FF3300)] text-[var(--state-error,#FF3300)] text-center">
          Save failed: {saveError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <SysprefSidebar currentArea={currentArea} onAreaChange={setCurrentArea} />
        <main ref={panelRef} className="flex-1 p-2 overflow-y-auto" role="main" aria-label={`${currentArea} settings`}>
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
