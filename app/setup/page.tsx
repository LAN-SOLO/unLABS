"use client";

/**
 * Setup / Onboarding page — shown on first launch or when no active session.
 *
 * Three options:
 * 1. Continue as existing operator (if users exist)
 * 2. Create a new operator profile
 * 3. Import an existing save file (.json)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  createOperator,
  importSaveFile,
  listOperators,
  signInOperator,
  deleteOperator,
} from "./actions";

type Mode = "choose" | "create" | "import";

interface Operator {
  id: string;
  username: string;
  displayName: string;
  email: string;
  episode: string;
  lastTickAt: string | null;
}

export default function SetupPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(true);

  // Load existing operators on mount
  useEffect(() => {
    listOperators().then((result) => {
      if (result.operators) setOperators(result.operators);
      setLoadingOperators(false);
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c0e] font-mono text-white">
      {/* CRT scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          background: `repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          )`,
        }}
      />

      <div className="relative z-10 w-full max-w-lg p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-widest text-[var(--neon-green,#00ff66)]">
            UNSTABLE LABORATORIES
          </h1>
          <div className="mt-1 text-xs tracking-wider text-gray-500">
            _unOS DESKTOP v{process.env.NEXT_PUBLIC_APP_VERSION}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {mode === "choose" && (
          <ChooseMode
            operators={operators}
            loadingOperators={loadingOperators}
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            onCreateNew={() => {
              setMode("create");
              setError(null);
            }}
            onImport={() => {
              setMode("import");
              setError(null);
            }}
          />
        )}

        {mode === "create" && (
          <CreateOperator
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            onBack={() => setMode("choose")}
          />
        )}

        {mode === "import" && (
          <ImportSave
            loading={loading}
            setLoading={setLoading}
            setError={setError}
            onBack={() => setMode("choose")}
          />
        )}
      </div>
    </div>
  );
}

// ── Choose Mode ───────────────────────────────────────────────────────

function ChooseMode({
  operators,
  loadingOperators,
  loading,
  setLoading,
  setError,
  onCreateNew,
  onImport,
}: {
  operators: Operator[];
  loadingOperators: boolean;
  loading: boolean;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  onCreateNew: () => void;
  onImport: () => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [localOperators, setLocalOperators] = useState<Operator[]>(operators);

  // Sync when props change
  useEffect(() => {
    setLocalOperators(operators);
  }, [operators]);

  const handleContinue = useCallback(
    async (operator: Operator) => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.set("email", operator.email);
        const result = await signInOperator(formData);
        if (result?.error) setError(result.error);
      } catch {
        // redirect throws on success
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteConfirm.trim() !== deleteTarget.username.trim()) {
      setError(`Type "${deleteTarget.username}" exactly to confirm deletion.`);
      return;
    }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set("operatorId", deleteTarget.id);
    formData.set("confirmUsername", deleteConfirm);
    formData.set("expectedUsername", deleteTarget.username);
    const result = await deleteOperator(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setLocalOperators((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteConfirm("");
    }
    setLoading(false);
  }, [deleteTarget, deleteConfirm, setLoading, setError]);

  const ops = localOperators;

  return (
    <div className="space-y-4">
      <div className="mb-6 text-center text-sm text-gray-400">
        Welcome, Operator. Select an option to begin.
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="mb-4 space-y-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4">
          <div className="text-xs font-bold tracking-wider text-red-400 uppercase">
            Delete Operator &quot;{deleteTarget.displayName}&quot;?
          </div>
          <div className="text-[10px] text-gray-400">
            This will permanently delete all game progress, saves, and data for this operator. This
            action cannot be undone.
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-red-400/70">
              Type <span className="font-bold text-red-400">{deleteTarget.username}</span> to
              confirm
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.username}
              className="w-full rounded border border-red-500/30 bg-black/50 px-2 py-1.5 text-xs text-white placeholder-gray-700 transition-all focus:border-red-500/60 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={loading || deleteConfirm.trim() !== deleteTarget.username.trim()}
              className="flex-1 rounded border border-red-500/40 bg-red-500/10 py-1.5 text-xs font-bold text-red-400 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading ? "DELETING..." : "DELETE PERMANENTLY"}
            </button>
            <button
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirm("");
              }}
              className="rounded border border-gray-700 px-4 py-1.5 text-xs text-gray-400 transition-all hover:border-gray-500"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Existing operators */}
      {loadingOperators ? (
        <div className="animate-pulse py-4 text-center text-xs text-gray-600">
          Scanning for existing operators...
        </div>
      ) : (
        ops.length > 0 &&
        !deleteTarget && (
          <div className="mb-2 space-y-2">
            <div className="px-1 text-[10px] tracking-wider text-gray-500 uppercase">
              Existing Operators
            </div>
            {ops.map((op) => (
              <div key={op.id} className="flex gap-1">
                <button
                  onClick={() => handleContinue(op)}
                  disabled={loading}
                  className="group flex-1 rounded-lg border border-[var(--neon-cyan,#00ffff)]/40 bg-[var(--neon-cyan,#00ffff)]/5 p-4 transition-all hover:border-[var(--neon-cyan,#00ffff)]/60 hover:bg-[var(--neon-cyan,#00ffff)]/10 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-sm font-bold text-[var(--neon-cyan,#00ffff)]">
                        {op.displayName}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        @{op.username} &middot; {op.episode} &middot;{" "}
                        {op.lastTickAt
                          ? `Last seen ${new Date(op.lastTickAt).toLocaleDateString()}`
                          : "New operator"}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--neon-cyan,#00ffff)]/50 transition-colors group-hover:text-[var(--neon-cyan,#00ffff)]">
                      CONTINUE &rarr;
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setDeleteTarget(op);
                    setDeleteConfirm("");
                    setError(null);
                  }}
                  disabled={loading}
                  className="group rounded-lg border border-gray-800 px-2 transition-all hover:border-red-500/40 hover:bg-red-500/5"
                  title={`Delete ${op.username}`}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className="opacity-30 transition-opacity group-hover:opacity-70"
                  >
                    <path
                      d="M2 3h6v5.5a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5V3z"
                      stroke="currentColor"
                      strokeWidth="0.8"
                      className="text-red-400"
                    />
                    <path
                      d="M1 3h8M4 1h2"
                      stroke="currentColor"
                      strokeWidth="0.8"
                      className="text-red-400"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Divider if operators exist */}
      {ops.length > 0 && !deleteTarget && (
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-gray-800" />
          <span className="text-[10px] tracking-wider text-gray-600 uppercase">or</span>
          <div className="h-px flex-1 bg-gray-800" />
        </div>
      )}

      <button
        onClick={onCreateNew}
        className="group w-full rounded-lg border border-[var(--neon-green,#00ff66)]/40 bg-[var(--neon-green,#00ff66)]/5 p-4 transition-all hover:border-[var(--neon-green,#00ff66)]/60 hover:bg-[var(--neon-green,#00ff66)]/10"
      >
        <div className="text-left">
          <div className="text-sm font-bold text-[var(--neon-green,#00ff66)]">NEW OPERATOR</div>
          <div className="mt-1 text-xs text-gray-500">
            Create a new profile and start from Cold Boot (EP0)
          </div>
        </div>
      </button>

      <button
        onClick={onImport}
        className="group w-full rounded-lg border border-[var(--neon-amber,#ffb800)]/40 bg-[var(--neon-amber,#ffb800)]/5 p-4 transition-all hover:border-[var(--neon-amber,#ffb800)]/60 hover:bg-[var(--neon-amber,#ffb800)]/10"
      >
        <div className="text-left">
          <div className="text-sm font-bold text-[var(--neon-amber,#ffb800)]">IMPORT SAVE</div>
          <div className="mt-1 text-xs text-gray-500">
            Load an existing save file to resume your session
          </div>
        </div>
      </button>
    </div>
  );
}

// ── Create Operator ───────────────────────────────────────────────────

function CreateOperator({
  loading,
  setLoading,
  setError,
  onBack,
}: {
  loading: boolean;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  onBack: () => void;
}) {
  const handleSubmit = useCallback(
    async (formData: FormData) => {
      setLoading(true);
      setError(null);
      try {
        const result = await createOperator(formData);
        if (result?.error) setError(result.error);
      } catch {
        // redirect throws on success
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-xs text-gray-500 transition-colors hover:text-gray-300"
      >
        &larr; Back
      </button>

      <div className="mb-4 text-sm font-bold tracking-wider text-[var(--neon-green,#00ff66)]">
        CREATE NEW OPERATOR
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-400">OPERATOR NAME</label>
          <input
            name="username"
            type="text"
            required
            autoFocus
            placeholder="operator"
            maxLength={24}
            pattern="[-a-zA-Z0-9_]+"
            title="Letters, numbers, dashes, and underscores only"
            className="w-full rounded border border-gray-700 bg-black/50 px-3 py-2 text-sm text-white placeholder-gray-600 transition-all focus:border-[var(--neon-green,#00ff66)]/50 focus:ring-1 focus:ring-[var(--neon-green,#00ff66)]/30 focus:outline-none"
          />
          <div className="mt-1 text-[10px] text-gray-600">
            This is your in-game identity. Letters, numbers, dashes, underscores.
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">DISPLAY NAME (optional)</label>
          <input
            name="displayName"
            type="text"
            placeholder="Same as operator name"
            maxLength={32}
            className="w-full rounded border border-gray-700 bg-black/50 px-3 py-2 text-sm text-white placeholder-gray-600 transition-all focus:border-[var(--neon-green,#00ff66)]/50 focus:ring-1 focus:ring-[var(--neon-green,#00ff66)]/30 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded border border-[var(--neon-green,#00ff66)]/40 bg-[var(--neon-green,#00ff66)]/10 py-2.5 text-sm font-bold tracking-wider text-[var(--neon-green,#00ff66)] transition-all hover:bg-[var(--neon-green,#00ff66)]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "INITIALIZING..." : "INITIALIZE OPERATOR"}
        </button>
      </form>
    </div>
  );
}

// ── Import Save ───────────────────────────────────────────────────────

function ImportSave({
  loading,
  setLoading,
  setError,
  onBack,
}: {
  loading: boolean;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  onBack: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saveData, setSaveData] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        try {
          JSON.parse(text);
          setSaveData(text);
        } catch {
          setError("Invalid file: not valid JSON");
          setSaveData(null);
        }
      };
      reader.readAsText(file);
    },
    [setError],
  );

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      if (!saveData) {
        setError("Please select a save file first");
        return;
      }
      setLoading(true);
      setError(null);
      formData.append("saveData", saveData);
      try {
        const result = await importSaveFile(formData);
        if (result?.error) setError(result.error);
      } catch {
        // redirect throws on success
      } finally {
        setLoading(false);
      }
    },
    [saveData, setLoading, setError],
  );

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-xs text-gray-500 transition-colors hover:text-gray-300"
      >
        &larr; Back
      </button>

      <div className="mb-4 text-sm font-bold tracking-wider text-[var(--neon-amber,#ffb800)]">
        IMPORT SAVE FILE
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-400">OPERATOR NAME</label>
          <input
            name="username"
            type="text"
            required
            placeholder="operator"
            maxLength={24}
            pattern="[-a-zA-Z0-9_]+"
            className="w-full rounded border border-gray-700 bg-black/50 px-3 py-2 text-sm text-white placeholder-gray-600 transition-all focus:border-[var(--neon-amber,#ffb800)]/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-400">SAVE FILE</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.unsc"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded border border-dashed border-gray-600 px-3 py-3 text-xs text-gray-400 transition-all hover:border-[var(--neon-amber,#ffb800)]/40 hover:text-gray-300"
          >
            {fileName ? (
              <span className="text-[var(--neon-amber,#ffb800)]">{fileName}</span>
            ) : (
              "Click to select save file (.json)"
            )}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || !saveData}
          className="w-full rounded border border-[var(--neon-amber,#ffb800)]/40 bg-[var(--neon-amber,#ffb800)]/10 py-2.5 text-sm font-bold tracking-wider text-[var(--neon-amber,#ffb800)] transition-all hover:bg-[var(--neon-amber,#ffb800)]/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "IMPORTING..." : "IMPORT & LAUNCH"}
        </button>
      </form>
    </div>
  );
}
