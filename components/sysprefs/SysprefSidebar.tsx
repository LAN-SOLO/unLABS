'use client'

export type SysprefArea = 'about' | 'display' | 'sound' | 'network' | 'user' | 'datetime'

const areas: { id: SysprefArea; label: string; key: string }[] = [
  { id: 'about', label: 'About _unOS', key: '1' },
  { id: 'display', label: 'unDisplay', key: '2' },
  { id: 'sound', label: 'unSound', key: '3' },
  { id: 'network', label: 'unNetwork', key: '4' },
  { id: 'user', label: 'unUser', key: '5' },
  { id: 'datetime', label: 'unDate&Time', key: '6' },
]

interface SysprefSidebarProps {
  currentArea: SysprefArea
  onAreaChange: (area: SysprefArea) => void
}

export function SysprefSidebar({ currentArea, onAreaChange }: SysprefSidebarProps) {
  return (
    <nav className="w-[16ch] border-r border-current py-1 shrink-0" role="navigation" aria-label="Preference areas">
      <ul role="menubar">
        {areas.map((area) => {
          const selected = currentArea === area.id
          return (
            <li
              key={area.id}
              role="menuitem"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`px-1 py-0.5 cursor-pointer select-none ${
                selected
                  ? 'text-[var(--neon-amber,#FFAA00)] bg-[rgba(255,170,0,0.1)]'
                  : 'hover:bg-[rgba(0,255,65,0.05)]'
              }`}
              onClick={() => onAreaChange(area.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onAreaChange(area.id)
                }
              }}
            >
              <span className="inline-block w-[2ch]">{selected ? '▸' : ' '}</span>
              <span className="text-[var(--state-offline,#666)] mr-1">[{area.key}]</span>
              {area.label}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
