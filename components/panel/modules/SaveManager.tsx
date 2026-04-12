"use client";

/**
 * SaveManager
 * ===========
 *
 * Bottom bar buttons for manual save, export, and import.
 * Triggers a save to both localStorage and Supabase, or
 * downloads/loads a .json save file.
 */

import { useState, useCallback, useRef } from "react";
import {
  exportSaveFile,
  parseImportedSaveFile,
  savePanelState,
  loadPanelState,
} from "@/lib/panel/panelState";
import { flushSave } from "@/lib/game/saveSync";

export function SaveManager() {
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  }, []);

  // Manual save — flush to Supabase immediately
  const handleSave = useCallback(async () => {
    try {
      await flushSave();
      showStatus("SAVED");
    } catch {
      showStatus("SAVE FAILED");
    }
  }, [showStatus]);

  // Export — download .json file
  const handleExport = useCallback(() => {
    try {
      exportSaveFile();
      showStatus("EXPORTED");
    } catch {
      showStatus("EXPORT FAILED");
    }
  }, [showStatus]);

  // Import — load .json file
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseImportedSaveFile(text);
        if (!parsed) {
          showStatus("INVALID FILE");
          return;
        }
        if (parsed.panelState) {
          savePanelState(parsed.panelState);
          showStatus("IMPORTED — RELOAD");
          // Reload to apply the imported state
          setTimeout(() => window.location.reload(), 1500);
        } else {
          showStatus("NO SAVE DATA");
        }
      };
      reader.readAsText(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [showStatus],
  );

  return (
    <div className="flex items-center gap-1">
      {/* Status indicator */}
      {status && (
        <span className="animate-pulse px-1 font-mono text-[8px] text-[var(--neon-green)]">
          {status}
        </span>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        className="flex h-6 cursor-pointer items-center gap-1 rounded border border-[var(--neon-green)]/20 bg-[var(--panel-surface-light)] px-2 transition-all hover:border-[var(--neon-green)]/50 hover:bg-[var(--neon-green)]/5"
        title="Save game (flush to database)"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-60">
          <path d="M1 1h4.5L7 2.5V7H1V1z" stroke="var(--neon-green)" strokeWidth="0.8" />
          <rect x="2.5" y="4" width="3" height="2.5" stroke="var(--neon-green)" strokeWidth="0.6" />
          <rect x="2" y="1" width="2.5" height="1.5" fill="var(--neon-green)" opacity="0.3" />
        </svg>
        <span className="font-mono text-[7px] text-[var(--neon-green)]/70">SAVE</span>
      </button>

      {/* Export button */}
      <button
        onClick={handleExport}
        className="flex h-6 cursor-pointer items-center gap-1 rounded border border-[var(--neon-amber)]/20 bg-[var(--panel-surface-light)] px-2 transition-all hover:border-[var(--neon-amber)]/50 hover:bg-[var(--neon-amber)]/5"
        title="Export save file (.json)"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-60">
          <path d="M4 1v4M2 3.5L4 5.5 6 3.5" stroke="var(--neon-amber)" strokeWidth="0.8" />
          <path d="M1 6h6" stroke="var(--neon-amber)" strokeWidth="0.8" />
        </svg>
        <span className="font-mono text-[7px] text-[var(--neon-amber)]/70">EXPORT</span>
      </button>

      {/* Import button */}
      <button
        onClick={handleImportClick}
        className="flex h-6 cursor-pointer items-center gap-1 rounded border border-[var(--neon-cyan)]/20 bg-[var(--panel-surface-light)] px-2 transition-all hover:border-[var(--neon-cyan)]/50 hover:bg-[var(--neon-cyan)]/5"
        title="Import save file (.json)"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="opacity-60">
          <path d="M4 5V1M2 2.5L4 0.5 6 2.5" stroke="var(--neon-cyan)" strokeWidth="0.8" />
          <path d="M1 6h6" stroke="var(--neon-cyan)" strokeWidth="0.8" />
        </svg>
        <span className="font-mono text-[7px] text-[var(--neon-cyan)]/70">IMPORT</span>
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.unsc"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
