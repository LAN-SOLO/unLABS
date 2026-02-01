'use client'

interface RequirementBadgeProps {
  tree: string | null
  item: string | null
  isUnlocked: boolean
}

export function RequirementBadge({ tree, item, isUnlocked }: RequirementBadgeProps) {
  if (!tree && !item) return null

  return (
    <span className="font-mono text-[9px] inline-flex items-center gap-1">
      <span className={isUnlocked ? 'text-green-400' : 'text-green-500/30'}>
        {isUnlocked ? '✓' : '●'}
      </span>
      <span className="text-green-500/60">Requires:</span>
      {tree && <span className="text-cyan-400/60">{tree}</span>}
      {item && (
        <>
          <span className="text-green-500/20">/</span>
          <span className="text-green-500/60">{item}</span>
        </>
      )}
    </span>
  )
}
