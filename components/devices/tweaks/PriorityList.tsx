"use client";

import type { TweakValue } from "../hooks/useTweakPanel";

interface PriorityListProps {
  tweak: TweakValue;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function PriorityList({ tweak, onReorder }: PriorityListProps) {
  const items = String(tweak.current_value).split(",").filter(Boolean);

  const moveUp = (index: number) => {
    if (index > 0) onReorder(index, index - 1);
  };

  const moveDown = (index: number) => {
    if (index < items.length - 1) onReorder(index, index + 1);
  };

  return (
    <div className="space-y-0.5 font-mono text-[10px]">
      <div className="mb-1 text-green-500/60">
        {tweak.setting_name}
        <span className="ml-2 text-green-500/30">[↑/↓ to reorder]</span>
      </div>
      {items.map((item, i) => (
        <div
          key={`${item}-${i}`}
          className="flex items-center gap-1 px-1 py-0.5 hover:bg-green-500/5"
        >
          <span className="w-[16px] text-right text-green-500/40">{i + 1}.</span>
          <span className={i === 0 ? "text-green-400" : "text-green-500/60"}>
            {i === 0 ? "▶" : " "} {item}
          </span>
          <span className="flex-1" />
          <button
            onClick={() => moveUp(i)}
            disabled={i === 0}
            className={`cursor-pointer px-0.5 ${i === 0 ? "text-green-500/15" : "text-green-500/50 hover:text-green-400"}`}
          >
            ↑
          </button>
          <button
            onClick={() => moveDown(i)}
            disabled={i === items.length - 1}
            className={`cursor-pointer px-0.5 ${i === items.length - 1 ? "text-green-500/15" : "text-green-500/50 hover:text-green-400"}`}
          >
            ↓
          </button>
        </div>
      ))}
      {tweak.description && (
        <div className="pt-0.5 pl-5 text-[9px] text-green-500/30">{tweak.description}</div>
      )}
    </div>
  );
}
