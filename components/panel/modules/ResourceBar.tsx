'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Resource {
  id: string
  label: string
  value: number
  max: number
  color?: string
}

interface ResourceBarProps {
  resources?: Resource[]
  className?: string
}

// Static initial values to avoid hydration mismatch
const initialResources: Resource[] = Array.from({ length: 12 }, (_, i) => ({
  id: `res-${i + 1}`,
  label: `RES-${i + 1}`,
  value: 50,
  max: 100,
}))

export function ResourceBar({
  resources: propResources,
  className,
}: ResourceBarProps) {
  const [resources, setResources] = useState<Resource[]>(
    propResources || initialResources
  )

  useEffect(() => {
    // Only randomize if using default resources
    if (!propResources) {
      setResources(
        initialResources.map((r) => ({
          ...r,
          value: Math.random() * 100,
        }))
      )

      // Simulate resource fluctuation
      const interval = setInterval(() => {
        setResources((prev) =>
          prev.map((r) => ({
            ...r,
            value: Math.max(0, Math.min(100, r.value + (Math.random() - 0.5) * 10)),
          }))
        )
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [propResources])

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {resources.map((resource) => (
        <ResourceSlot key={resource.id} resource={resource} />
      ))}
    </div>
  )
}

function ResourceSlot({ resource }: { resource: Resource }) {
  const percent = (resource.value / resource.max) * 100
  const color = resource.color || getColorForValue(percent)

  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 min-w-[60px]">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-black/50 rounded-sm overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
          }}
        />
      </div>

      {/* Label */}
      <span className="font-mono text-[8px] text-white/40">{resource.label}</span>
    </div>
  )
}

function getColorForValue(percent: number): string {
  if (percent < 30) return 'var(--neon-red)'
  if (percent < 60) return 'var(--neon-amber)'
  return 'var(--neon-green)'
}
