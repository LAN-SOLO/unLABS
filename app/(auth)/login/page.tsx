"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "../actions";
import { BootSequence } from "@/components/BootSequence";

export default function LoginPage() {
  const [showBoot, setShowBoot] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleBootComplete = () => {
    setShowBoot(false);
    setShowContent(true);
  };

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    const result = await login(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
  }

  return (
    <div className="font-mono">
      {/* Boot Sequence */}
      {showBoot && <BootSequence variant="login" onComplete={handleBootComplete} />}

      <div
        className={`transition-opacity duration-500 ${showContent ? "opacity-100" : "opacity-0"}`}
      >
        {/* ASCII Header */}
        <pre className="mb-6 text-xs leading-tight text-green-500">
          {`
 _   _ _   _ _        _    ____  ____
| | | | \\ | | |      / \\  | __ )/ ___|
| | | |  \\| | |     / _ \\ |  _ \\\\___ \\
| |_| | |\\  | |___ / ___ \\| |_) |___) |
 \\___/|_| \\_|_____/_/   \\_\\____/|____/
`}
        </pre>

        <div className="mb-6 text-green-500">
          <p className="text-sm opacity-70">&gt; SYSTEM ACCESS TERMINAL</p>
          <p className="text-sm opacity-70">&gt; AUTHENTICATION REQUIRED</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-green-500">EMAIL_ADDRESS:</label>
            <input
              type="email"
              name="email"
              required
              disabled={isLoading}
              className="w-full border border-green-500/50 bg-black px-3 py-2 font-mono text-sm text-green-400 focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)] focus:outline-none disabled:opacity-50"
              placeholder="operator@unlabs.io"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-green-500">ACCESS_KEY:</label>
            <input
              type="password"
              name="password"
              required
              disabled={isLoading}
              className="w-full border border-green-500/50 bg-black px-3 py-2 font-mono text-sm text-green-400 focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)] focus:outline-none disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              &gt; ERROR: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full border border-green-500 bg-green-500/20 px-4 py-2 font-mono text-sm text-green-400 transition-colors hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-pulse">&gt; AUTHENTICATING...</span>
            ) : (
              "&gt; INITIALIZE CONNECTION"
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-green-500/20 pt-4">
          <p className="text-xs text-green-500/70">
            &gt; NEW OPERATOR?{" "}
            <Link href="/register" className="text-green-400 underline hover:text-green-300">
              REQUEST ACCESS
            </Link>
          </p>
        </div>

        {/* Blinking cursor */}
        <div className="mt-4 text-green-500">
          <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}
