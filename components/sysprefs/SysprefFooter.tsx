interface SysprefFooterProps {
  hasUnsavedChanges: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
  onQuit: () => void
}

export function SysprefFooter({ hasUnsavedChanges, saving, onSave, onReset, onQuit }: SysprefFooterProps) {
  return (
    <div className="px-3 py-1 border-t border-current flex justify-between items-center text-xs">
      <div className="flex gap-4">
        <span className="cursor-pointer hover:text-[var(--neon-amber,#FFAA00)]" onClick={onQuit}>[Q] Quit</span>
        <span className="cursor-pointer hover:text-[var(--neon-amber,#FFAA00)]" onClick={onSave}>[S] Save</span>
        <span className="cursor-pointer hover:text-[var(--neon-amber,#FFAA00)]" onClick={onReset}>[R] Reset</span>
        <span className="text-[var(--state-offline,#666)]">[↑↓] Navigate  [←→] Adjust  [Space] Toggle</span>
      </div>
      <div>
        {saving && <span className="text-[var(--neon-cyan,#00FFFF)]">⠋ Saving...</span>}
        {!saving && hasUnsavedChanges && (
          <span className="text-[var(--neon-amber,#FFAA00)] animate-pulse">● Unsaved changes</span>
        )}
        {!saving && !hasUnsavedChanges && (
          <span className="text-[var(--state-offline,#666)]">✓ Saved</span>
        )}
      </div>
    </div>
  )
}
