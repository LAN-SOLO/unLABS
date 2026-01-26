'use client'

import { useState } from 'react'
import {
  GamePanel,
  PanelToolbar,
  PanelLeft,
  PanelMain,
  PanelRight,
  PanelBottom,
} from '@/components/panel/GamePanel'
import { PanelFrame } from '@/components/panel/PanelFrame'
import { TerminalModule } from '@/components/panel/TerminalModule'
import { Oscilloscope } from '@/components/panel/displays/Oscilloscope'
import { Knob, PushButton, LED, LEDBar } from '@/components/panel/controls'
import {
  CrystalDataCache,
  EnergyCore,
  BatteryPack,
  HandmadeSynthesizer,
} from '@/components/panel/modules/EquipmentTile'
import { ResourceBar } from '@/components/panel/modules/ResourceBar'

interface PanelClientProps {
  userId: string
  username: string | null
  balance: number
}

export function PanelClient({ userId, username, balance }: PanelClientProps) {
  const [isSystemOn, setIsSystemOn] = useState(false)

  return (
    <GamePanel className="text-white">
      {/* Top Toolbar */}
      <PanelToolbar>
        <div className="flex items-center gap-3 flex-1">
          {/* Dev Controller button */}
          <button className="px-2 py-1 bg-[var(--panel-surface-light)] border border-[var(--neon-amber)]/30 rounded text-[10px] font-mono text-[var(--neon-amber)]">
            DEV Controller
          </button>

          {/* Control modules */}
          <div className="flex items-center gap-2 bg-[var(--panel-surface-light)] px-2 py-1 rounded border border-white/10">
            <LED on={isSystemOn} color="green" size="sm" />
            <span className="font-mono text-[10px] text-white/60">OUTPUT</span>
            <span className="font-mono text-sm text-[var(--neon-amber)]">i2.5</span>
          </div>

          <div className="flex items-center gap-2 bg-[var(--panel-surface-light)] px-2 py-1 rounded border border-white/10">
            <span className="font-mono text-[10px] text-white/60">FREQUENCY</span>
            <span className="font-mono text-sm text-[var(--neon-cyan)]">42.3</span>
          </div>

          {/* Execute button */}
          <button
            onClick={() => setIsSystemOn(!isSystemOn)}
            className={`px-3 py-1 rounded font-mono text-[10px] transition-all ${
              isSystemOn
                ? 'bg-[var(--neon-green)] text-black'
                : 'bg-[var(--neon-amber)] text-black'
            }`}
          >
            EXECUTE
          </button>

          {/* Input controls */}
          <div className="flex items-center gap-2 bg-[var(--panel-surface-light)] px-2 py-1 rounded border border-white/10">
            <span className="font-mono text-[9px] text-white/40">INPUT</span>
            <LED on={true} color="cyan" size="sm" />
            <span className="font-mono text-[9px] text-white/40">CH2</span>
            <LED on={false} color="cyan" size="sm" />
          </div>

          {/* Run/Reset buttons */}
          <div className="flex gap-1">
            <button className="px-2 py-0.5 bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/30 rounded text-[9px] font-mono text-[var(--neon-cyan)]">
              RUN
            </button>
            <button className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-white/50">
              RESET
            </button>
          </div>

          {/* Voltage display */}
          <div className="flex items-center gap-2 bg-black px-3 py-1 rounded border border-[var(--neon-amber)]/30">
            <span className="font-mono text-[10px] text-white/40">VOLT</span>
            <span className="font-mono text-lg text-[var(--neon-amber)] text-glow-amber">i28.0</span>
          </div>

          {/* Mode indicators */}
          <div className="flex gap-1">
            <LED on={true} color="red" size="sm" />
            <LED on={true} color="amber" size="sm" />
            <LED on={isSystemOn} color="green" size="sm" />
          </div>

          {/* Laser button */}
          <button className="px-2 py-1 bg-[var(--neon-red)]/20 border border-[var(--neon-red)]/30 rounded text-[10px] font-mono text-[var(--neon-red)]">
            LASER
          </button>

          {/* Activate */}
          <button className="px-3 py-1 bg-[var(--neon-green)] text-black rounded font-mono text-[10px]">
            ACTIVATE
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <Knob value={50} onChange={() => {}} size="sm" />
          <div className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-white/40">BOOST</span>
            <LED on={true} color="amber" size="sm" />
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-white/40">SHIELD</span>
            <LED on={false} color="cyan" size="sm" />
          </div>
          <Knob value={30} onChange={() => {}} size="sm" />
          <div className="flex gap-0.5">
            <span className="font-mono text-[9px] text-white/40">MODE</span>
            <span className="font-mono text-[9px] text-white/40">SPD</span>
          </div>
        </div>

        {/* Tiles */}
        <div className="flex gap-1 ml-4">
          {['TILE 20', 'TILE 21', 'TILE 22', 'Wallet'].map((label) => (
            <div
              key={label}
              className="w-16 h-8 bg-[var(--panel-surface-light)] border border-white/10 rounded flex items-center justify-center"
            >
              <span className="font-mono text-[8px] text-white/40">{label}</span>
            </div>
          ))}
        </div>
      </PanelToolbar>

      {/* Left Panel - Equipment Modules */}
      <PanelLeft>
        <CrystalDataCache />
        <EnergyCore />
        <BatteryPack />
        <HandmadeSynthesizer />

        {/* Additional placeholder modules */}
        <PanelFrame variant="default" className="p-2">
          <div className="font-mono text-[9px] text-[var(--neon-amber)] mb-1">
            ECHO RECORDER
          </div>
          <div className="flex items-center gap-2">
            <Knob value={40} onChange={() => {}} size="sm" label="PULSE" />
            <Knob value={60} onChange={() => {}} size="sm" label="BLOOM" />
          </div>
        </PanelFrame>

        <PanelFrame variant="military" className="p-2">
          <div className="font-mono text-[9px] text-[var(--neon-lime)] mb-1">
            INTERPOLATOR
          </div>
          <div className="h-8 bg-black/30 rounded flex items-center justify-center">
            <span className="font-mono text-[10px] text-[var(--neon-lime)]">
              ≈≈≈
            </span>
          </div>
        </PanelFrame>
      </PanelLeft>

      {/* Main Area - Terminal */}
      <PanelMain>
        <TerminalModule
          userId={userId}
          username={username}
          balance={balance}
          className="flex-1"
        />

        {/* Resource displays below terminal */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {[
            { name: 'Abstractum', label: 'RES-1', value: 0.48 },
            { name: 'Energy (EU)', label: 'RES-2', value: 0.48 },
            { name: 'Alloys', label: 'RES-3', value: 0.25 },
            { name: 'Nanomaterial', label: 'RES-4', value: 0.48 },
          ].map((res) => (
            <PanelFrame key={res.label} variant="default" className="p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-white">{res.name}</span>
                <span className="font-mono text-[8px] text-white/40">{res.label}</span>
              </div>
              <div className="h-1.5 bg-black/50 rounded overflow-hidden mb-2">
                <div
                  className="h-full bg-[var(--neon-green)]"
                  style={{ width: `${res.value * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-2 text-[8px] font-mono text-white/50">
                <div>Uptime: 0:48</div>
                <div>Last tick: 0:00 ago</div>
                <div>Stock: {Math.floor(res.value * 20)}</div>
                <div>Base Rate: {res.value > 0.3 ? '1000/24h' : '500/24h'}</div>
              </div>
            </PanelFrame>
          ))}
        </div>
      </PanelMain>

      {/* Right Panel - Oscilloscope and Controls */}
      <PanelRight>
        {/* Mini waveform display at top */}
        <PanelFrame variant="default" className="p-2">
          <div className="font-mono text-[9px] text-[var(--neon-green)] mb-1">
            OSCILLOSCOPE
          </div>
          <div className="h-16 bg-[#0a1a0a] rounded border border-[var(--neon-green)]/20 flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 100 40" className="w-full h-full">
              <path
                d="M0,20 Q10,5 20,20 T40,20 T60,20 T80,20 T100,20"
                fill="none"
                stroke="var(--neon-green)"
                strokeWidth="1.5"
                className="glow-pulse"
              />
            </svg>
          </div>
        </PanelFrame>

        {/* Main Oscilloscope */}
        <Oscilloscope
          walletAddress={`${userId.slice(0, 4)}....${userId.slice(-4)}`}
          balance={balance}
          frequency1={2.91}
          frequency2={2.501}
        />

        {/* Settings Hub */}
        <PanelFrame variant="default" className="p-2">
          <div className="font-mono text-[9px] text-[var(--neon-amber)] mb-2">
            SETTINGS HUB
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] text-white/50">Waveform</span>
              <select className="bg-black/50 border border-white/10 rounded px-1 py-0.5 text-[9px] font-mono text-white">
                <option>Sine</option>
                <option>Square</option>
                <option>Sawtooth</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[8px] font-mono">
              <div>
                <span className="text-white/40">Freq1</span>
                <div className="text-[var(--neon-cyan)]">2.0 Hz</div>
              </div>
              <div>
                <span className="text-white/40">Freq2</span>
                <div className="text-[var(--neon-cyan)]">3.0 Hz</div>
              </div>
            </div>
          </div>
        </PanelFrame>

        {/* Dev Controller */}
        <PanelFrame variant="default" className="p-2">
          <div className="font-mono text-[9px] text-[var(--neon-amber)] mb-2">
            DEV CONTROLLER
          </div>
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Enter PIN to unlock"
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-white"
            />
            <button className="w-full py-1 bg-[var(--neon-green)] text-black rounded font-mono text-[10px]">
              Unlock
            </button>
          </div>
        </PanelFrame>
      </PanelRight>

      {/* Bottom Resource Bar */}
      <PanelBottom>
        <ResourceBar />
      </PanelBottom>

      {/* Global scanline effect */}
      <div
        className="pointer-events-none fixed inset-0 z-[100]"
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 3px)',
        }}
      />
    </GamePanel>
  )
}
