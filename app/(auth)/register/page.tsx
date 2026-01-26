'use client'

import { useState } from 'react'
import Link from 'next/link'
import { register } from '../actions'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const result = await register(formData)

    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success)
    }

    setIsLoading(false)
  }

  return (
    <div className="font-mono">
      {/* ASCII Header */}
      <pre className="text-green-500 text-xs mb-6 leading-tight">
{`
 _   _ _   _ _        _    ____  ____
| | | | \\ | | |      / \\  | __ )/ ___|
| | | |  \\| | |     / _ \\ |  _ \\\\___ \\
| |_| | |\\  | |___ / ___ \\| |_) |___) |
 \\___/|_| \\_|_____/_/   \\_\\____/|____/
`}
      </pre>

      <div className="text-green-500 mb-6">
        <p className="text-sm opacity-70">&gt; NEW OPERATOR REGISTRATION</p>
        <p className="text-sm opacity-70">&gt; CLEARANCE LEVEL: INITIATE</p>
      </div>

      {success ? (
        <div className="space-y-4">
          <div className="text-green-400 text-sm border border-green-500/50 px-3 py-2 bg-green-500/10">
            &gt; SUCCESS: {success}
          </div>
          <Link
            href="/login"
            className="block w-full bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 font-mono text-sm hover:bg-green-500/30 transition-colors text-center"
          >
            &gt; RETURN TO LOGIN
          </Link>
        </div>
      ) : (
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-green-500 text-sm mb-1">
              OPERATOR_ID:
            </label>
            <input
              type="text"
              name="username"
              required
              disabled={isLoading}
              pattern="^[a-zA-Z0-9_-]{3,20}$"
              title="3-20 characters, letters, numbers, underscores, hyphens only"
              className="w-full bg-black border border-green-500/50 text-green-400 px-3 py-2 font-mono text-sm focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)] disabled:opacity-50"
              placeholder="operator_name"
            />
            <p className="text-green-500/50 text-xs mt-1">
              3-20 chars, alphanumeric + _ -
            </p>
          </div>

          <div>
            <label className="block text-green-500 text-sm mb-1">
              EMAIL_ADDRESS:
            </label>
            <input
              type="email"
              name="email"
              required
              disabled={isLoading}
              className="w-full bg-black border border-green-500/50 text-green-400 px-3 py-2 font-mono text-sm focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)] disabled:opacity-50"
              placeholder="operator@unlabs.io"
            />
          </div>

          <div>
            <label className="block text-green-500 text-sm mb-1">
              ACCESS_KEY:
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              disabled={isLoading}
              className="w-full bg-black border border-green-500/50 text-green-400 px-3 py-2 font-mono text-sm focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)] disabled:opacity-50"
              placeholder="••••••••"
            />
            <p className="text-green-500/50 text-xs mt-1">Minimum 8 characters</p>
          </div>

          {error && (
            <div className="text-red-500 text-sm border border-red-500/50 px-3 py-2 bg-red-500/10">
              &gt; ERROR: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 font-mono text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="animate-pulse">&gt; PROCESSING...</span>
            ) : (
              '&gt; REQUEST ACCESS'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 pt-4 border-t border-green-500/20">
        <p className="text-green-500/70 text-xs">
          &gt; EXISTING OPERATOR?{' '}
          <Link
            href="/login"
            className="text-green-400 hover:text-green-300 underline"
          >
            AUTHENTICATE
          </Link>
        </p>
      </div>

      {/* Blinking cursor */}
      <div className="mt-4 text-green-500">
        <span className="animate-pulse">_</span>
      </div>
    </div>
  )
}
