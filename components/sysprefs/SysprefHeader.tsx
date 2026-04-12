interface SysprefHeaderProps {
  hasUnsavedChanges: boolean;
}

export function SysprefHeader({ hasUnsavedChanges }: SysprefHeaderProps) {
  return (
    <div className="border-b border-current px-3 py-1 text-center tracking-[0.15em] uppercase">
      ║ _unOS SYSTEM PREFERENCES ║
      {hasUnsavedChanges && (
        <span className="ml-3 animate-pulse text-[var(--neon-amber,#FFAA00)]">● UNSAVED</span>
      )}
    </div>
  );
}
