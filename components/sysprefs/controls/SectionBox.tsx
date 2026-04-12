interface SectionBoxProps {
  title: string;
  children: React.ReactNode;
}

export function SectionBox({ title, children }: SectionBoxProps) {
  return (
    <div className="mb-3 border border-current">
      <div className="bg-current px-2 py-0.5 text-xs font-bold tracking-wider text-[var(--bg-void,#0A0A0A)]">
        {title}
      </div>
      <div className="px-2 py-1">{children}</div>
    </div>
  );
}
