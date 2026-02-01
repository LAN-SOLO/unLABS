interface SectionBoxProps {
  title: string
  children: React.ReactNode
}

export function SectionBox({ title, children }: SectionBoxProps) {
  return (
    <div className="border border-current mb-3">
      <div className="bg-current text-[var(--bg-void,#0A0A0A)] px-2 py-0.5 font-bold text-xs tracking-wider">
        {title}
      </div>
      <div className="px-2 py-1">
        {children}
      </div>
    </div>
  )
}
