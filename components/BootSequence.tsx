'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface BootSequenceProps {
  onComplete: () => void
  variant?: 'landing' | 'login' | 'terminal'
  className?: string
}

const LANDING_BOOT_LINES = [
  { text: '', delay: 80 },
  { text: '╔════════════════════════════════════════════════════════════╗', delay: 50 },
  { text: '║           UNSTABLE LABORATORIES - SYSTEM BOOT              ║', delay: 50 },
  { text: '╚════════════════════════════════════════════════════════════╝', delay: 80 },
  { text: '', delay: 50 },
  { text: '[POWER] System power-on detected', delay: 100 },
  { text: '[BIOS] Unstable Labs BIOS v3.2.1', delay: 80 },
  { text: '[BIOS] Copyright (c) 2024 UnstableLabs Inc.', delay: 80 },
  { text: '', delay: 40 },
  { text: '┌──────────────────────────────────────────────────────────┐', delay: 50 },
  { text: '│                    POST DIAGNOSTICS                      │', delay: 50 },
  { text: '└──────────────────────────────────────────────────────────┘', delay: 80 },
  { text: '', delay: 40 },
  { text: '[POST] CPU: Quantum-Core X99 @ 4.7GHz.......... OK', delay: 100 },
  { text: '[POST] RAM: 16384 MB DDR5 @ 6400MHz........... OK', delay: 100 },
  { text: '[POST] GPU: NeuroVision RTX-Q................. OK', delay: 100 },
  { text: '[POST] Storage: 2TB NVMe Quantum SSD.......... OK', delay: 100 },
  { text: '[POST] Network: Quantum Fiber 10Gbps.......... OK', delay: 100 },
  { text: '', delay: 40 },
  { text: '[BOOT] Loading UnstableLabs OS v4.2.1...', delay: 150 },
  { text: '[BOOT] Mounting root filesystem...', delay: 120 },
  { text: '[BOOT] Starting system services...', delay: 120 },
  { text: '', delay: 40 },
  { text: '┌──────────────────────────────────────────────────────────┐', delay: 50 },
  { text: '│                    SYSTEM CHECK                          │', delay: 50 },
  { text: '└──────────────────────────────────────────────────────────┘', delay: 80 },
  { text: '', delay: 40 },
  { text: '[CHECK] CPU Temperature............... 38°C    [  OK  ]', delay: 80 },
  { text: '[CHECK] Memory Integrity.............. 100%    [  OK  ]', delay: 80 },
  { text: '[CHECK] Storage Health................ 99%     [  OK  ]', delay: 80 },
  { text: '[CHECK] Network Latency............... 8ms     [  OK  ]', delay: 80 },
  { text: '[CHECK] Quantum Coherence............. 99.8%   [  OK  ]', delay: 80 },
  { text: '[CHECK] Firewall Status............... Armed   [  OK  ]', delay: 80 },
  { text: '[CHECK] Encryption Layer.............. AES-512 [  OK  ]', delay: 80 },
  { text: '', delay: 40 },
  { text: '[INIT] Loading display driver................. OK', delay: 100 },
  { text: '[INIT] Starting network daemon................ OK', delay: 100 },
  { text: '[INIT] Initializing quantum subsystem......... OK', delay: 100 },
  { text: '[INIT] Loading security protocols............. OK', delay: 100 },
  { text: '', delay: 40 },
  { text: '┌──────────────────────────────────────────────────────────┐', delay: 50 },
  { text: '│                  NETWORK CONNECTION                      │', delay: 50 },
  { text: '└──────────────────────────────────────────────────────────┘', delay: 80 },
  { text: '', delay: 40 },
  { text: '[NET] Establishing secure connection to SOLANA DEVNET...', delay: 200 },
  { text: '[NET] TLS 1.3 handshake complete.............. OK', delay: 100 },
  { text: '[NET] Certificate verified.................... OK', delay: 100 },
  { text: '[NET] Blockchain sync: 100%', delay: 100 },
  { text: '', delay: 40 },
  { text: '╔════════════════════════════════════════════════════════════╗', delay: 50 },
  { text: '║  STATUS: ALL SYSTEMS OPERATIONAL                          ║', delay: 50 },
  { text: '║  SECURITY: MAXIMUM | NETWORK: CONNECTED                   ║', delay: 50 },
  { text: '╚════════════════════════════════════════════════════════════╝', delay: 80 },
  { text: '', delay: 40 },
  { text: '[READY] Loading user interface...', delay: 200 },
  { text: '', delay: 150 },
]

const LOGIN_BOOT_LINES = [
  { text: '', delay: 80 },
  { text: '╔════════════════════════════════════════════════════════════╗', delay: 50 },
  { text: '║          AUTHENTICATION SUBSYSTEM INITIALIZATION          ║', delay: 50 },
  { text: '╚════════════════════════════════════════════════════════════╝', delay: 80 },
  { text: '', delay: 40 },
  { text: '[AUTH] Security subsystem initializing...', delay: 120 },
  { text: '[AUTH] Loading encryption modules............. OK', delay: 100 },
  { text: '[AUTH] Initializing biometric scanner......... OK', delay: 100 },
  { text: '[AUTH] Loading identity verification.......... OK', delay: 100 },
  { text: '[AUTH] Connecting to auth server.............. OK', delay: 120 },
  { text: '', delay: 40 },
  { text: '┌──────────────────────────────────────────────────────────┐', delay: 50 },
  { text: '│                    SECURITY CHECK                        │', delay: 50 },
  { text: '└──────────────────────────────────────────────────────────┘', delay: 80 },
  { text: '', delay: 40 },
  { text: '[CHECK] SSL Certificate............... Valid   [  OK  ]', delay: 80 },
  { text: '[CHECK] CORS Policy................... Strict  [  OK  ]', delay: 80 },
  { text: '[CHECK] XSS Protection................ Active  [  OK  ]', delay: 80 },
  { text: '[CHECK] CSRF Token.................... Set     [  OK  ]', delay: 80 },
  { text: '[CHECK] Rate Limiting................. Active  [  OK  ]', delay: 80 },
  { text: '[CHECK] Session Encryption............ AES-256 [  OK  ]', delay: 80 },
  { text: '', delay: 40 },
  { text: '┌──────────────────────────────────────────────────────────┐', delay: 50 },
  { text: '│                   WALLET INTERFACES                      │', delay: 50 },
  { text: '└──────────────────────────────────────────────────────────┘', delay: 80 },
  { text: '', delay: 40 },
  { text: '[CRYPTO] Solana Adapter............... v2.1.0  [READY]', delay: 100 },
  { text: '[CRYPTO] Phantom Connector............ v1.8.2  [READY]', delay: 100 },
  { text: '[CRYPTO] Solflare Support............. v1.4.0  [READY]', delay: 100 },
  { text: '[CRYPTO] Ledger Hardware.............. v3.0.1  [READY]', delay: 100 },
  { text: '', delay: 40 },
  { text: '[SECURE] Establishing TLS 1.3 tunnel........... OK', delay: 120 },
  { text: '[SECURE] Certificate chain verified............ OK', delay: 100 },
  { text: '[SECURE] Perfect forward secrecy enabled....... OK', delay: 100 },
  { text: '', delay: 40 },
  { text: '╔════════════════════════════════════════════════════════════╗', delay: 50 },
  { text: '║  STATUS: AUTHENTICATION PORTAL READY                      ║', delay: 50 },
  { text: '║  SECURITY: MAXIMUM | ENCRYPTION: ACTIVE                   ║', delay: 50 },
  { text: '╚════════════════════════════════════════════════════════════╝', delay: 80 },
  { text: '', delay: 40 },
  { text: '[READY] Awaiting operator credentials...', delay: 150 },
  { text: '', delay: 100 },
]

export function BootSequence({ onComplete, variant = 'landing', className }: BootSequenceProps) {
  const [lines, setLines] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)

  const bootLines = variant === 'login' ? LOGIN_BOOT_LINES : LANDING_BOOT_LINES

  useEffect(() => {
    let currentIndex = 0
    let timeoutId: NodeJS.Timeout

    const addNextLine = () => {
      if (currentIndex < bootLines.length) {
        const line = bootLines[currentIndex]
        setLines(prev => [...prev, line.text])
        currentIndex++
        timeoutId = setTimeout(addNextLine, line.delay)
      } else {
        setIsComplete(true)
        setTimeout(onComplete, 500)
      }
    }

    timeoutId = setTimeout(addNextLine, 300)

    return () => clearTimeout(timeoutId)
  }, [onComplete, bootLines])

  return (
    <div
      className={cn(
        'fixed inset-0 bg-black z-50 flex items-start justify-center pt-20 overflow-hidden',
        isComplete && 'animate-fade-out',
        className
      )}
    >
      <div className="w-full max-w-3xl px-8 font-mono text-sm">
        <div className="text-[var(--neon-green)] leading-relaxed">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                'whitespace-pre',
                line.includes('OK') && 'text-[var(--neon-green)]',
                line.includes('READY') && 'text-[var(--neon-cyan)]',
                line.includes('ERROR') && 'text-[var(--neon-red)]',
              )}
            >
              {line}
            </div>
          ))}
          {!isComplete && (
            <span className="inline-block w-2 h-4 bg-[var(--neon-green)] animate-pulse ml-1" />
          )}
        </div>
      </div>

      {/* CRT scanline effect */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 3px)',
        }}
      />
    </div>
  )
}
