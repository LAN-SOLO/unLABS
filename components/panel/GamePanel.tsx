"use client";

import { cn } from "@/lib/utils";

interface GamePanelProps {
  children: React.ReactNode;
  className?: string;
}

export function GamePanel({ children, className }: GamePanelProps) {
  return <div className={cn("game-panel", className)}>{children}</div>;
}

export function PanelToolbar({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-hidden bg-[var(--panel-surface)] px-2 py-1",
        "border-b border-[rgba(255,184,0,0.15)]",
        className,
      )}
      style={{ gridArea: "toolbar" }}
    >
      {children}
    </div>
  );
}

export function PanelLeft({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 overflow-x-hidden overflow-y-auto p-1",
        "bg-[var(--panel-void)]",
        "scrollbar-thin scrollbar-thumb-green-500/20 scrollbar-track-transparent",
        className,
      )}
      style={{ gridArea: "left" }}
    >
      {children}
    </div>
  );
}

export function PanelMain({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 overflow-x-hidden overflow-y-auto p-1",
        "bg-[var(--panel-void)]",
        "scrollbar-thin scrollbar-thumb-green-500/20 scrollbar-track-transparent",
        className,
      )}
      style={{ gridArea: "main" }}
    >
      {children}
    </div>
  );
}

export function PanelRight({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 overflow-x-hidden overflow-y-auto p-1",
        "bg-[var(--panel-void)]",
        "scrollbar-thin scrollbar-thumb-green-500/20 scrollbar-track-transparent",
        className,
      )}
      style={{ gridArea: "right" }}
    >
      {children}
    </div>
  );
}

export function PanelResources({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn("flex items-center gap-2 px-2 py-1", "bg-[var(--panel-surface)]", className)}
      style={{ gridArea: "resources" }}
    >
      {children}
    </div>
  );
}

export function PanelBottom({ children, className }: GamePanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 px-2 py-1",
        "border-t border-[rgba(255,184,0,0.15)] bg-[var(--panel-surface)]",
        className,
      )}
      style={{ gridArea: "bottom" }}
    >
      {children}
    </div>
  );
}
