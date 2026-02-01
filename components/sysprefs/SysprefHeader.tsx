interface SysprefHeaderProps {
  hasUnsavedChanges: boolean
}

export function SysprefHeader({ hasUnsavedChanges }: SysprefHeaderProps) {
  return (
    <div className="px-3 py-1 border-b border-current text-center tracking-[0.15em] uppercase">
      ║ _unOS SYSTEM PREFERENCES ║
      {hasUnsavedChanges && (
        <span className="ml-3 text-[var(--neon-amber,#FFAA00)] animate-pulse">● UNSAVED</span>
      )}
    </div>
  )
}
