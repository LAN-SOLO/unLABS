'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Knob } from '../controls/Knob'
import { PushButton } from '../controls/PushButton'
import { LED } from '../controls/LED'
import { CRTScreen } from './CRTScreen'
import { Waveform } from './Waveform'

interface OscilloscopeProps {
  walletAddress?: string
  balance?: number
  frequency1?: number
  frequency2?: number
  onConnect?: () => void
  className?: string
}

export function Oscilloscope({
  walletAddress = 'EfiL....B82M',
  balance = 0,
  frequency1 = 2.0,
  frequency2 = 3.0,
  onConnect,
  className,
}: OscilloscopeProps) {
  const [intensity, setIntensity] = useState(70)
  const [focus, setFocus] = useState(50)
  const [hPos, setHPos] = useState(50)
  const [vInput, setVInput] = useState(50)
  const [sweepSelector, setSweepSelector] = useState(50)
  const [horGain, setHorGain] = useState(50)
  const [waveType, setWaveType] = useState<'sine' | 'square' | 'sawtooth'>('sine')
  const [isConnected, setIsConnected] = useState(false)

  const formattedBalance = balance.toLocaleString()

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-lg',
        'bg-gradient-to-b from-[#4a5a4a] to-[#3a4a3a]',
        'border border-[#2a3a2a]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {/* Header with INTENSITY knob and status LEDs */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/80">
            Intensity
          </span>
          <Knob
            value={intensity}
            onChange={setIntensity}
            size="sm"
            accentColor="#ffffff"
          />
        </div>

        {/* Status LEDs */}
        <div className="flex items-center gap-1">
          <LED on={true} color="red" size="sm" />
          <LED on={true} color="red" size="sm" />
          <LED on={true} color="amber" size="sm" />
          <LED on={true} color="amber" size="sm" />
          <LED on={isConnected} color="green" size="sm" />
          <LED on={isConnected} color="green" size="sm" />
        </div>

        {/* Waveform selector button */}
        <button
          className="px-3 py-1 bg-[#1a2a1a] border border-[#3a4a3a] rounded text-[var(--neon-green)] font-mono text-xs"
          onClick={() => {
            const types: ('sine' | 'square' | 'sawtooth')[] = ['sine', 'square', 'sawtooth']
            const current = types.indexOf(waveType)
            setWaveType(types[(current + 1) % types.length])
          }}
        >
          <span className="text-glow-green">~</span>
        </button>

        {/* MAIK / WALLET buttons */}
        <div className="flex gap-1">
          <button className="px-2 py-1 bg-[#1a2a1a] border border-[var(--neon-green)] rounded font-mono text-[10px] text-[var(--neon-green)]">
            MAIK
          </button>
          <button
            className={cn(
              'px-2 py-1 border rounded font-mono text-[10px]',
              isConnected
                ? 'bg-[#1a2a1a] border-[var(--neon-cyan)] text-[var(--neon-cyan)]'
                : 'bg-[#2a1a1a] border-[var(--neon-amber)] text-[var(--neon-amber)]'
            )}
            onClick={() => {
              setIsConnected(!isConnected)
              onConnect?.()
            }}
          >
            WALLET
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/80">
            Focus
          </span>
          <Knob
            value={focus}
            onChange={setFocus}
            size="sm"
            accentColor="#ffffff"
          />
        </div>
      </div>

      {/* Main CRT Display */}
      <CRTScreen className="h-48">
        <div className="relative w-full h-full p-2">
          <Waveform
            type={waveType}
            frequency={frequency1}
            amplitude={0.7 * (intensity / 100)}
            width={280}
            height={160}
            animated={isConnected}
          />

          {/* Readouts overlay */}
          <div className="absolute top-2 right-2 font-mono text-[10px] text-[var(--crt-green)] text-glow-green">
            <div>Fr1: {frequency1.toFixed(1)}Hz</div>
            <div>Fr2: {frequency2.toFixed(1)}Hz</div>
            <div>Peak: {(intensity / 100 * 1.5).toFixed(2)}V</div>
            <div>I/T: {(1000 / frequency1).toFixed(1)}ms</div>
          </div>

          {/* Scale markers */}
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-2 font-mono text-[8px] text-[var(--crt-green)]/60">
            <span>.5V</span>
            <span>32M</span>
            <span>16M</span>
            <span>24M</span>
            <span>28M</span>
            <span>30M</span>
            <span>36M</span>
            <span>46M</span>
          </div>
        </div>
      </CRTScreen>

      {/* Wallet Display */}
      <div className="flex items-center justify-center">
        <div className="bg-[#1a1a4a] border-2 border-[#3a3a6a] rounded px-4 py-2 min-w-[200px]">
          <div className="font-mono text-[10px] text-center text-[var(--neon-cyan)] mb-1">
            WALLET
          </div>
          <div className="font-mono text-[9px] text-center text-[var(--neon-cyan)]/70 mb-1">
            {walletAddress}
          </div>
          <div className="font-mono text-lg text-center text-[var(--neon-cyan)] text-glow-cyan tracking-wider">
            {formattedBalance}
          </div>
        </div>
      </div>

      {/* Model Label */}
      <div className="text-center font-mono text-[10px] text-white/60 tracking-wider">
        OSCILLOSCOPE<br />
        <span className="text-[9px]">DE-WIDE BAND</span><br />
        <span className="text-white/80">MODEL 460</span>
      </div>

      {/* Control Knobs Row 1 */}
      <div className="flex items-end justify-between px-2">
        <div className="flex flex-col items-center">
          <Knob
            value={vInput}
            onChange={setVInput}
            label="Z-RSIS"
            size="md"
            accentColor="var(--neon-green)"
          />
        </div>

        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-white/60 mb-1">PHASING</span>
          <Knob
            value={sweepSelector}
            onChange={setSweepSelector}
            size="md"
            accentColor="var(--neon-amber)"
          />
          <span className="font-mono text-[8px] text-white/60 mt-1">SWEEP SELECTOR</span>
        </div>

        <div className="flex flex-col items-center">
          <Knob
            value={horGain}
            onChange={setHorGain}
            label="SWEEP VERNIER"
            size="md"
            accentColor="var(--neon-green)"
          />
        </div>

        <div className="flex flex-col items-center">
          <Knob
            value={hPos}
            onChange={setHPos}
            label="H-POS."
            size="md"
            accentColor="var(--neon-green)"
          />
        </div>
      </div>

      {/* Control Knobs Row 2 */}
      <div className="flex items-end justify-between px-2 mt-2">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-white/60 mb-1">Z:AXIS</span>
          <Knob
            value={50}
            onChange={() => {}}
            size="sm"
            accentColor="var(--neon-green)"
          />
        </div>

        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-white/60 mb-1">V-INPUT</span>
          <Knob
            value={50}
            onChange={() => {}}
            size="md"
            accentColor="var(--neon-green)"
          />
        </div>

        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-white/60 mb-1">VERT. ATTENUATOR</span>
          <Knob
            value={50}
            onChange={() => {}}
            size="md"
            accentColor="var(--neon-green)"
          />
        </div>

        <div className="text-center">
          <div className="font-mono text-sm text-[var(--neon-green)] italic tracking-wider">
            EICO
          </div>
          <div className="font-mono text-[8px] text-white/60">
            NO. 22712
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-white/60 mb-1">HOR. GAIN</span>
          <Knob
            value={50}
            onChange={() => {}}
            size="md"
            accentColor="var(--neon-green)"
          />
        </div>

        <div className="flex flex-col items-center">
          <span className="font-mono text-[8px] text-white/60 mb-1">EXT.CAP.</span>
          <Knob
            value={50}
            onChange={() => {}}
            size="sm"
            accentColor="var(--neon-green)"
          />
        </div>
      </div>

      {/* Bottom Info */}
      <div className="flex items-center justify-between px-2 mt-2 text-[7px] font-mono text-white/50">
        <span>FOR BALANCED INPUT REMOVE JUMPER ON</span>
        <span>ELECTRONIC INSTRUMENT CO. INC. L.I.CITY</span>
      </div>

      {/* Color Bar (RGB/CMYK values) */}
      <div className="flex gap-0.5 mt-1">
        <ColorChip label="R" value={209} color="#ff0000" />
        <ColorChip label="G" value={7} color="#00ff00" />
        <ColorChip label="B" value={121} color="#0066ff" />
        <ColorChip label="C" value={0} color="#00ffff" />
        <ColorChip label="M" value={97} color="#ff00ff" />
        <ColorChip label="Y" value={42} color="#ffff00" />
        <ColorChip label="K" value={18} color="#ffffff" />
        <ColorChip label="oR" value={1} color="#ff6600" />
        <ColorChip label="oG" value={7} color="#66ff00" />
        <ColorChip label="oB" value={79} color="#0066ff" />
      </div>
    </div>
  )
}

function ColorChip({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div
      className="flex-1 py-1 text-center font-mono text-[8px] border border-black/50"
      style={{ backgroundColor: color, color: value > 128 ? '#000' : '#fff' }}
    >
      <div>{label}:</div>
      <div>{value}</div>
    </div>
  )
}
