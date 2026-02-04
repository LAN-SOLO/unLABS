import type { PublicKey } from '@solana/web3.js'

export interface PhantomProvider {
  isPhantom?: boolean
  isConnected?: boolean
  publicKey?: PublicKey
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>
  disconnect(): Promise<void>
  on(event: string, callback: (...args: unknown[]) => void): void
  off(event: string, callback: (...args: unknown[]) => void): void
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider
    }
  }
}
