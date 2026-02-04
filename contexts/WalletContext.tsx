'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { PhantomProvider } from '@/types/phantom'

interface WalletContextValue {
  connected: boolean
  publicKey: string | null
  balance: number | null
  phantomInstalled: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextValue>({
  connected: false,
  publicKey: null,
  balance: null,
  phantomInstalled: false,
  connect: async () => {},
  disconnect: async () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

/**
 * Wait for Phantom to be fully ready. Phantom injects `window.phantom.solana`
 * early but its internal service worker may not be connected yet. We listen for
 * the standard `phantom#initialized` event and also poll as a fallback.
 */
function waitForPhantom(timeout = 3000): Promise<PhantomProvider | null> {
  return new Promise((resolve) => {
    // Already available and connected?
    const existing = window.phantom?.solana
    if (existing?.isPhantom) {
      resolve(existing)
      return
    }

    let settled = false
    const done = (p: PhantomProvider | null) => {
      if (settled) return
      settled = true
      window.removeEventListener('phantom#initialized', onInit)
      resolve(p)
    }

    // Phantom dispatches this event when its provider is fully ready
    const onInit = () => {
      const p = window.phantom?.solana ?? null
      if (p?.isPhantom) done(p)
    }
    window.addEventListener('phantom#initialized', onInit)

    // Fallback: poll every 200ms
    const interval = setInterval(() => {
      const p = window.phantom?.solana
      if (p?.isPhantom) {
        clearInterval(interval)
        done(p)
      }
    }, 200)

    // Give up after timeout
    setTimeout(() => {
      clearInterval(interval)
      done(null)
    }, timeout)
  })
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [phantomInstalled, setPhantomInstalled] = useState(false)
  const providerRef = useRef<PhantomProvider | null>(null)
  const readyRef = useRef<Promise<PhantomProvider | null> | null>(null)

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const res = await fetch(`/api/solana-balance?address=${encodeURIComponent(address)}`)
      if (res.ok) {
        const data = await res.json()
        setBalance(data.balance ?? null)
      } else {
        setBalance(null)
      }
    } catch {
      setBalance(null)
    }
  }, [])

  // Get a ready provider, waiting for initialization if needed
  const getReady = useCallback(async (): Promise<PhantomProvider | null> => {
    if (providerRef.current) return providerRef.current
    if (!readyRef.current) {
      readyRef.current = waitForPhantom()
    }
    const p = await readyRef.current
    if (p) providerRef.current = p
    return p
  }, [])

  const handleConnect = useCallback(async () => {
    const provider = await getReady()
    if (!provider) {
      window.open('https://phantom.app/', '_blank')
      return
    }
    try {
      const resp = await provider.connect()
      const addr = resp.publicKey.toBase58()
      setPublicKey(addr)
      setConnected(true)
      fetchBalance(addr)
    } catch {
      // user rejected or error
    }
  }, [getReady, fetchBalance])

  const handleDisconnect = useCallback(async () => {
    setConnected(false)
    setPublicKey(null)
    setBalance(null)
    // Fire-and-forget — don't await. Phantom's MV3 service worker
    // frequently throws "disconnected port" which we can't prevent.
    const provider = providerRef.current
    if (provider) {
      provider.disconnect().catch(() => {})
    }
  }, [])

  // Detect Phantom and auto-reconnect
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const provider = await getReady()
      if (cancelled || !provider) return

      setPhantomInstalled(true)

      // Auto-reconnect if previously approved
      try {
        const resp = await provider.connect({ onlyIfTrusted: true })
        if (cancelled) return
        const addr = resp.publicKey.toBase58()
        setPublicKey(addr)
        setConnected(true)
        fetchBalance(addr)
      } catch {
        // not previously approved
      }
    }
    init()

    return () => { cancelled = true }
  }, [getReady, fetchBalance])

  // Listen to Phantom events
  useEffect(() => {
    const provider = providerRef.current
    if (!provider) return

    const onDisconnect = () => {
      setConnected(false)
      setPublicKey(null)
      setBalance(null)
    }

    const onAccountChanged = (newPk: unknown) => {
      if (newPk && typeof newPk === 'object' && 'toBase58' in newPk) {
        const addr = (newPk as { toBase58(): string }).toBase58()
        setPublicKey(addr)
        setConnected(true)
        fetchBalance(addr)
      } else {
        setConnected(false)
        setPublicKey(null)
        setBalance(null)
      }
    }

    provider.on('disconnect', onDisconnect)
    provider.on('accountChanged', onAccountChanged)

    return () => {
      provider.off('disconnect', onDisconnect)
      provider.off('accountChanged', onAccountChanged)
    }
  }, [connected, fetchBalance])

  return (
    <WalletContext.Provider value={{ connected, publicKey, balance, phantomInstalled, connect: handleConnect, disconnect: handleDisconnect }}>
      {children}
    </WalletContext.Provider>
  )
}
