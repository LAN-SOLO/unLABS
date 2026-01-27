'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  PanelToolbar,
  PanelLeft,
  PanelMain,
  PanelRight,
  PanelBottom,
} from '@/components/panel/GamePanel'
import { WindowManagerProvider } from '@/components/panel/WindowManager'
import { PanelFrame } from '@/components/panel/PanelFrame'
import { TerminalModule } from '@/components/panel/TerminalModule'
import { Oscilloscope } from '@/components/panel/displays/Oscilloscope'
import { QuantumAnalyzer } from '@/components/panel/displays/QuantumAnalyzer'
import { DiagnosticsConsole } from '@/components/panel/displays/DiagnosticsConsole'
import { Knob, PushButton, LED, LEDBar } from '@/components/panel/controls'
import {
  CrystalDataCache,
  EnergyCore,
  BatteryPack,
  HandmadeSynthesizer,
  EchoRecorder,
  Interpolator,
  BasicToolkit,
  MaterialScanner,
  ResourceMagnet,
  QuantumCompass,
  PortableWorkbench,
  AbstractumContainer,
  EnergyTank,
  AlloyForge,
  NanoSynthesizer,
  MicrofusionReactor,
  AIAssistant,
  ExplorerDrone,
  AnomalyDetector,
  TeleportPad,
  LaserCutter,
  Printer3D,
  ExoticMatterContainment,
  SupercomputerArray,
} from '@/components/panel/modules/EquipmentTile'
import { ResourceBar } from '@/components/panel/modules/ResourceBar'
import type { EquipmentData } from '../terminal/actions/equipment'

interface PanelClientProps {
  userId: string
  username: string | null
  balance: number
  equipmentData?: EquipmentData
}

export function PanelClient({ userId, username, balance, equipmentData }: PanelClientProps) {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState(false)
  const [isSystemOn, setIsSystemOn] = useState(false)
  const [isLaserOn, setIsLaserOn] = useState(false)
  const [isActivated, setIsActivated] = useState(false)
  const [isRunning, setIsRunning] = useState(true)

  // Check for panel access from terminal
  useEffect(() => {
    const access = sessionStorage.getItem('panel_access')
    if (access !== 'unlocked') {
      router.replace('/terminal')
    } else {
      setHasAccess(true)
    }
  }, [router])

  // Show nothing while checking access
  if (!hasAccess) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-[var(--neon-amber)] font-mono text-sm">
          Access denied. Use terminal command: RUN panel dev -un
        </div>
      </div>
    )
  }

  // Extract equipment data with defaults
  const crystals = equipmentData?.crystals ?? { count: 0, totalSlices: 0, totalPower: 0 }
  const balanceData = equipmentData?.balance ?? { available: balance, staked: 0, locked: 0 }
  const techTrees = equipmentData?.techTrees
  const volatility = equipmentData?.volatility ?? { currentTier: 1, tps: 1000, network: 'unknown' }

  return (
    <WindowManagerProvider className="text-white">
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
            <button
              onClick={() => setIsRunning(true)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-all ${
                isRunning
                  ? 'bg-[var(--neon-cyan)] text-black shadow-[0_0_8px_var(--neon-cyan)]'
                  : 'bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)]'
              }`}
            >
              RUN
            </button>
            <button
              onClick={() => setIsRunning(false)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono transition-all ${
                !isRunning
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
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
            <LED on={isLaserOn} color="red" size="sm" />
            <LED on={isRunning} color="amber" size="sm" />
            <LED on={isSystemOn && isActivated} color="green" size="sm" />
          </div>

          {/* Laser button */}
          <button
            onClick={() => setIsLaserOn(!isLaserOn)}
            className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
              isLaserOn
                ? 'bg-[var(--neon-red)] text-black shadow-[0_0_10px_var(--neon-red)]'
                : 'bg-[var(--neon-red)]/20 border border-[var(--neon-red)]/30 text-[var(--neon-red)] hover:bg-[var(--neon-red)]/30'
            }`}
          >
            LASER
          </button>

          {/* Activate */}
          <button
            onClick={() => setIsActivated(!isActivated)}
            className={`px-3 py-1 rounded font-mono text-[10px] transition-all ${
              isActivated
                ? 'bg-[var(--neon-green)] text-black shadow-[0_0_10px_var(--neon-green)]'
                : 'bg-[var(--neon-green)]/70 text-black hover:bg-[var(--neon-green)]'
            }`}
          >
            {isActivated ? 'ACTIVE' : 'ACTIVATE'}
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
        {/* Crystal Data Cache - shows real inventory data */}
        <CrystalDataCache
          crystalCount={crystals.count}
          sliceCount={crystals.totalSlices}
          totalPower={crystals.totalPower}
        />

        {/* Energy Core - linked to network volatility */}
        <EnergyCore
          volatilityTier={volatility.currentTier}
          tps={volatility.tps}
        />

        {/* Battery Pack - shows user balance */}
        <BatteryPack
          available={balanceData.available}
          staked={balanceData.staked}
          locked={balanceData.locked}
        />

        {/* Synthesizer - linked to synthesizers tech tree */}
        <HandmadeSynthesizer progress={techTrees?.synthesizers} />

        {/* Echo Recorder - linked to adapters tech tree */}
        <EchoRecorder progress={techTrees?.adapters} />

        {/* Interpolator - linked to optics tech tree */}
        <Interpolator progress={techTrees?.optics} />
      </PanelLeft>

      {/* Main Area - Terminal + Organized Modules */}
      <PanelMain>
        {/* Top resource bars */}
        <div className="grid grid-cols-4 gap-1 mb-1">
          {[
            { name: 'Abstractum', label: 'RES-1', value: 0.48, color: 'var(--neon-green)' },
            { name: 'Energy', label: 'RES-2', value: 0.68, color: 'var(--neon-cyan)' },
            { name: 'Alloys', label: 'RES-3', value: 0.25, color: 'var(--neon-amber)' },
            { name: 'Nano', label: 'RES-4', value: 0.15, color: 'var(--neon-purple)' },
          ].map((res) => (
            <PanelFrame key={res.label} variant="default" className="p-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-white/80">{res.name}</span>
                <span className="font-mono text-[8px] text-white/40">{res.label}</span>
              </div>
              <div className="h-1.5 bg-black/50 rounded overflow-hidden mt-1">
                <div className="h-full transition-all" style={{ width: `${res.value * 100}%`, background: res.color }} />
              </div>
            </PanelFrame>
          ))}
        </div>

        {/* Main content - Terminal centered with side columns */}
        <div className="flex gap-1 flex-1">
          {/* LEFT COLUMN: Tech & Processing */}
          <div className="flex flex-col gap-1 w-[140px]">
            {/* Section: POWER */}
            <div className="border-l-2 border-[var(--neon-cyan)]/40 pl-1">
              <div className="font-mono text-[7px] text-[var(--neon-cyan)]/60 mb-1">POWER</div>
              <MicrofusionReactor powerOutput={847} stability={94} isOnline={true} />
            </div>
            {/* Section: COMPUTE */}
            <div className="border-l-2 border-[var(--neon-green)]/40 pl-1">
              <div className="font-mono text-[7px] text-[var(--neon-green)]/60 mb-1">COMPUTE</div>
              <AIAssistant taskQueue={7} efficiency={156} isLearning={true} />
              <div className="mt-1">
                <SupercomputerArray flops={2.4} utilization={87} isOnline={true} />
              </div>
            </div>
            {/* Section: FIELD OPS */}
            <div className="border-l-2 border-[var(--neon-lime,#bfff00)]/40 pl-1">
              <div className="font-mono text-[7px] text-[var(--neon-lime,#bfff00)]/60 mb-1">FIELD OPS</div>
              <ExplorerDrone range={2.4} battery={78} isDeployed={true} />
              <div className="mt-1">
                <ResourceMagnet magnetStrength={45} isActive={true} />
              </div>
            </div>
          </div>

          {/* CENTER: Terminal + Quantum Analyzer + Resource Storage + Tech Tree Preview */}
          <div className="flex flex-col gap-1 flex-1">
            {/* Terminal, Quantum Analyzer, and Diagnostics Console */}
            <div className="flex gap-1" style={{ minHeight: '320px' }}>
              <div className="flex-1">
                <TerminalModule userId={userId} username={username} balance={balance} />
              </div>
              <div className="w-[280px]">
                <QuantumAnalyzer className="h-full" />
              </div>
              <div className="w-[300px]">
                <DiagnosticsConsole className="h-full" />
              </div>
            </div>

            {/* Resource Storage Row */}
            <div className="border-t border-[var(--neon-green)]/20 pt-1">
              <div className="font-mono text-[7px] text-white/40 mb-1 px-1">RESOURCE STORAGE</div>
              <div className="grid grid-cols-4 gap-1">
                <AbstractumContainer amount={127} capacity={500} purity={94} />
                <EnergyTank amount={340} capacity={1000} flowRate={12.5} />
                <AlloyForge temperature={1450} output={3.2} isActive={true} />
                <NanoSynthesizer particles={1247000} density={89} isProcessing={true} />
              </div>
            </div>

            {/* System Status Row */}
            <div className="border-t border-[var(--neon-cyan)]/20 pt-1">
              <div className="font-mono text-[7px] text-white/40 mb-1 px-1">SYSTEM STATUS</div>
              <div className="grid grid-cols-5 gap-1">
                <ExoticMatterContainment units={12} stability={76} isContained={true} />
                <PanelFrame variant="teal" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-cyan)] mb-0.5">QUANTUM</div>
                  <div className="h-5 bg-black/40 rounded flex items-center justify-center">
                    <span className="font-mono text-[10px] text-[var(--neon-cyan)]">|ψ⟩</span>
                  </div>
                  <div className="font-mono text-[6px] text-white/40 mt-0.5">COHERENT</div>
                </PanelFrame>
                <PanelFrame variant="military" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-lime,#bfff00)] mb-0.5">NETWORK</div>
                  <div className="h-5 bg-black/40 rounded p-0.5 flex items-end gap-px">
                    {[60, 80, 45, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 bg-[var(--neon-lime,#bfff00)]/60" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="font-mono text-[6px] text-white/40 mt-0.5">2.4 Gbps</div>
                </PanelFrame>
                <PanelFrame variant="default" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-amber)] mb-0.5">TEMP</div>
                  <div className="h-5 bg-black/40 rounded flex items-center px-1">
                    <div className="flex-1 h-1.5 bg-gradient-to-r from-[var(--neon-cyan)] via-[var(--neon-green)] to-[var(--neon-red)] rounded" />
                  </div>
                  <div className="font-mono text-[6px] text-white/40 mt-0.5">28.4°C</div>
                </PanelFrame>
                <PanelFrame variant="teal" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-purple,#9d00ff)] mb-0.5">DIM</div>
                  <div className="h-5 bg-black/40 rounded flex items-center justify-center">
                    <span className="font-mono text-[9px] text-white/60">D-3.14</span>
                  </div>
                  <div className="font-mono text-[6px] text-white/40 mt-0.5">STABLE</div>
                </PanelFrame>
              </div>
            </div>

            {/* Tools Row */}
            <div className="border-t border-[var(--neon-amber)]/20 pt-1">
              <div className="font-mono text-[7px] text-white/40 mb-1 px-1">TOOLS & MONITORS</div>
              <div className="grid grid-cols-6 gap-1">
                <PortableWorkbench queuedItems={2} craftingProgress={45} />
                <BasicToolkit />
                <MaterialScanner scanProgress={78} detectedMaterials={5} />
                <PanelFrame variant="default" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-green)] mb-0.5">CLOCK</div>
                  <div className="h-5 bg-black/40 rounded flex items-center justify-center">
                    <span className="font-mono text-[11px] text-[var(--neon-green)] text-glow-green">
                      {new Date().toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                  </div>
                </PanelFrame>
                <PanelFrame variant="teal" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-cyan)] mb-0.5">CPU</div>
                  <div className="h-5 bg-black/40 rounded flex items-end p-0.5 gap-px">
                    {[40, 65, 80, 55, 70, 90].map((h, i) => (
                      <div key={i} className="flex-1 bg-[var(--neon-cyan)]" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="font-mono text-[6px] text-white/40">67%</div>
                </PanelFrame>
                <PanelFrame variant="military" className="p-1.5">
                  <div className="font-mono text-[8px] text-[var(--neon-amber)] mb-0.5">MEM</div>
                  <div className="h-5 bg-black/40 rounded p-0.5">
                    <div className="h-full bg-[var(--neon-amber)]/60 rounded" style={{ width: '72%' }} />
                  </div>
                  <div className="font-mono text-[6px] text-white/40">4.2G</div>
                </PanelFrame>
              </div>
            </div>

            {/* Tech Tree Preview - Enhanced with displays, LEDs, switches */}
            <div className="border-t border-white/10 pt-1 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[7px] text-white/40">TECH TREE · TIER 3-5 PREVIEW</span>
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-amber)]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]/30" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[5px] text-white/30">SCAN</span>
                  <div className="w-8 h-1.5 bg-[#0a1a0a] rounded overflow-hidden">
                    <div className="h-full bg-[var(--neon-cyan)] animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 flex-1">
                {/* TOOLS Column */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between border-b border-[var(--neon-amber)]/20 pb-0.5">
                    <span className="font-mono text-[6px] text-[var(--neon-amber)]/60">TOOLS</span>
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 rounded-full bg-[var(--neon-amber)]" />
                      <div className="w-1 h-1 rounded-full bg-[var(--neon-amber)]/30" />
                    </div>
                  </div>
                  {[
                    { name: 'Drone Swarm', tier: 3, color: 'lime', icon: '◈', progress: 45, status: 'QUEUE', power: 120 },
                    { name: 'Nano Assembler', tier: 3, color: 'purple', icon: '◉', progress: 12, status: 'LOCK', power: 80 },
                    { name: 'Resonance Forge', tier: 3, color: 'orange', icon: '◎', progress: 0, status: 'LOCK', power: 200 },
                    { name: 'World Forge', tier: 5, color: 'blue', icon: '◐', progress: 0, status: 'T5-REQ', power: 999 },
                  ].map((item, idx) => (
                    <PanelFrame key={item.name} variant="default" className="p-1.5 relative overflow-hidden flex-1 flex flex-col justify-center">
                      {/* Mini display background */}
                      <div className="absolute top-0 right-0 w-10 h-full bg-gradient-to-l from-black/40 to-transparent" />
                      <div className="flex items-center gap-1.5">
                        {/* Status LED */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${item.progress > 0 ? 'bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]' : 'bg-white/20'}`} />
                          <span className={`text-[14px] ${item.progress > 0 ? `text-[var(--neon-${item.color})]` : 'text-white/30'}`}>{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-[8px] text-white/80 truncate">{item.name}</div>
                            {/* Mini 7-segment display */}
                            <div className="bg-[#0a0a0a] px-1 py-0.5 rounded border border-[var(--neon-green)]/20">
                              <span className="font-mono text-[7px] text-[var(--neon-green)]">{item.power}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="font-mono text-[6px] text-white/30">T{item.tier}</span>
                            {/* Progress bar */}
                            <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded overflow-hidden">
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${item.progress}%`,
                                  background: item.progress > 0 ? `var(--neon-${item.color})` : 'transparent'
                                }}
                              />
                            </div>
                            {/* Status badge */}
                            <span className={`font-mono text-[6px] px-1 rounded ${
                              item.status === 'QUEUE' ? 'bg-[var(--neon-amber)]/20 text-[var(--neon-amber)]' :
                              item.status === 'LOCK' ? 'bg-white/10 text-white/40' :
                              'bg-[var(--neon-red)]/20 text-[var(--neon-red)]'
                            }`}>{item.status}</span>
                          </div>
                        </div>
                      </div>
                    </PanelFrame>
                  ))}
                </div>
                {/* TECH Column */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between border-b border-[var(--neon-cyan)]/20 pb-0.5">
                    <span className="font-mono text-[6px] text-[var(--neon-cyan)]/60">TECH</span>
                    <div className="font-mono text-[6px] text-[var(--neon-cyan)]/40">4/12</div>
                  </div>
                  {[
                    { name: 'Holo Sim-Deck', tier: 3, color: 'cyan', icon: '▣', cpu: 67, mem: 45, online: true },
                    { name: 'Crypto Co-Proc', tier: 3, color: 'green', icon: '▤', cpu: 89, mem: 72, online: true },
                    { name: 'Sentient AI', tier: 4, color: 'green', icon: '▥', cpu: 0, mem: 0, online: false },
                    { name: 'Singularity', tier: 5, color: 'pink', icon: '●', cpu: 0, mem: 0, online: false },
                  ].map((item) => (
                    <PanelFrame key={item.name} variant="teal" className="p-1.5 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        {/* Connection indicator */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2 h-2 rounded-sm ${item.online ? 'bg-[var(--neon-cyan)] shadow-[0_0_6px_var(--neon-cyan)]' : 'bg-white/10'}`} />
                          <span className={`text-[14px] ${item.online ? `text-[var(--neon-${item.color})]` : 'text-white/20'}`}>{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-[8px] text-white/80 truncate">{item.name}</div>
                            {/* Online/Offline switch visual */}
                            <div className={`w-5 h-2.5 rounded-full relative ${item.online ? 'bg-[var(--neon-green)]/30' : 'bg-white/10'}`}>
                              <div className={`absolute top-0.5 w-1.5 h-1.5 rounded-full bg-white transition-all ${item.online ? 'left-3' : 'left-0.5'}`} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="font-mono text-[6px] text-white/30">T{item.tier}</span>
                            {/* CPU/MEM mini meters */}
                            {item.online && (
                              <>
                                <div className="flex items-center gap-0.5">
                                  <span className="font-mono text-[5px] text-[var(--neon-cyan)]/60">CPU</span>
                                  <div className="w-8 h-1.5 bg-[#0a1a1a] rounded overflow-hidden">
                                    <div className="h-full bg-[var(--neon-cyan)]" style={{ width: `${item.cpu}%` }} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <span className="font-mono text-[5px] text-[var(--neon-green)]/60">MEM</span>
                                  <div className="w-8 h-1.5 bg-[#0a1a1a] rounded overflow-hidden">
                                    <div className="h-full bg-[var(--neon-green)]" style={{ width: `${item.mem}%` }} />
                                  </div>
                                </div>
                              </>
                            )}
                            {!item.online && <span className="font-mono text-[6px] text-white/20">OFFLINE</span>}
                          </div>
                        </div>
                      </div>
                    </PanelFrame>
                  ))}
                </div>
                {/* GADGETS Column */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between border-b border-[var(--neon-purple,#9d00ff)]/20 pb-0.5">
                    <span className="font-mono text-[6px] text-[var(--neon-purple,#9d00ff)]/60">GADGETS</span>
                    <div className="flex gap-px">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`w-1.5 h-2.5 ${i <= 2 ? 'bg-[var(--neon-purple,#9d00ff)]' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  {[
                    { name: 'Containment', tier: 3, color: 'green', icon: '◻', charge: 87, temp: 23, stable: true },
                    { name: 'Phase Shifter', tier: 3, color: 'cyan', icon: '◇', charge: 45, temp: 67, stable: true },
                    { name: 'Gravity Inv', tier: 4, color: 'blue', icon: '◆', charge: 0, temp: 0, stable: false },
                    { name: 'Temporal Watch', tier: 5, color: 'amber', icon: '◈', charge: 0, temp: 0, stable: false },
                  ].map((item) => (
                    <PanelFrame key={item.name} variant="default" className="p-1.5 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        {/* Multi-LED status */}
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex gap-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.stable ? 'bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]' : 'bg-white/10'}`} />
                            <div className={`w-1.5 h-1.5 rounded-full ${item.charge > 50 ? 'bg-[var(--neon-amber)] shadow-[0_0_4px_var(--neon-amber)]' : 'bg-white/10'}`} />
                          </div>
                          <span className={`text-[14px] ${item.stable ? `text-[var(--neon-${item.color})]` : 'text-white/20'}`}>{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-[8px] text-white/80 truncate">{item.name}</div>
                            {/* Charge display */}
                            {item.stable && (
                              <div className="bg-[#0a0a0a] px-1 py-0.5 rounded border border-white/10">
                                <span className="font-mono text-[7px] text-[var(--neon-green)]">{item.charge}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="font-mono text-[6px] text-white/30">T{item.tier}</span>
                            {item.stable ? (
                              <>
                                {/* Battery indicator */}
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(i => (
                                    <div key={i} className={`w-1.5 h-2 ${i <= Math.ceil(item.charge/20) ? 'bg-[var(--neon-green)]' : 'bg-white/10'}`} />
                                  ))}
                                </div>
                                {/* Temp */}
                                <span className="font-mono text-[6px] text-[var(--neon-amber)]">{item.temp}°C</span>
                              </>
                            ) : (
                              <span className="font-mono text-[6px] text-[var(--neon-red)]/50">⚠ LOCKED</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </PanelFrame>
                  ))}
                </div>
                {/* ADVANCED Column */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between border-b border-[var(--neon-red)]/20 pb-0.5">
                    <span className="font-mono text-[6px] text-[var(--neon-red)]/60">ADVANCED</span>
                    <span className="font-mono text-[6px] text-[var(--neon-red)]/30 animate-pulse">◉ T4+</span>
                  </div>
                  {[
                    { name: 'Transmutation', tier: 4, color: 'orange', icon: '⟳', flux: 234, eta: '2:45', active: true },
                    { name: 'Dim Excavator', tier: 4, color: 'purple', icon: '⬡', flux: 0, eta: '--:--', active: false },
                    { name: 'Omni-Fab', tier: 5, color: 'amber', icon: '✦', flux: 0, eta: '--:--', active: false },
                    { name: 'Genesis Dev', tier: 5, color: 'green', icon: '✧', flux: 0, eta: '--:--', active: false },
                  ].map((item) => (
                    <PanelFrame key={item.name} variant="military" className="p-1.5 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        {/* Rotating/static icon */}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-2 h-2 ${item.active ? 'bg-[var(--neon-orange)] shadow-[0_0_6px_var(--neon-orange)] animate-pulse' : 'bg-white/10'}`} style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
                          <span className={`text-[14px] ${item.active ? `text-[var(--neon-${item.color})]` : 'text-white/20'} ${item.active && item.icon === '⟳' ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-[8px] text-white/80 truncate">{item.name}</div>
                            {/* ETA display */}
                            <div className={`bg-[#0a0a0a] px-1 py-0.5 rounded ${item.active ? 'border border-[var(--neon-amber)]/30' : ''}`}>
                              <span className={`font-mono text-[7px] ${item.active ? 'text-[var(--neon-amber)]' : 'text-white/20'}`}>{item.eta}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="font-mono text-[6px] text-white/30">T{item.tier}</span>
                            {item.active ? (
                              <>
                                {/* Flux meter */}
                                <div className="flex items-center gap-0.5">
                                  <span className="font-mono text-[5px] text-[var(--neon-orange)]">FLUX</span>
                                  <span className="font-mono text-[6px] text-[var(--neon-orange)]">{item.flux}</span>
                                </div>
                                {/* Activity dots */}
                                <div className="flex gap-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" style={{ animationDelay: '0ms' }} />
                                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" style={{ animationDelay: '200ms' }} />
                                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" style={{ animationDelay: '400ms' }} />
                                </div>
                              </>
                            ) : (
                              <span className="font-mono text-[6px] text-[var(--neon-red)]/40">⚡ REQ: {item.tier >= 5 ? 'EXOTIC' : 'NANO'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </PanelFrame>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Gadgets & Fabrication */}
          <div className="flex flex-col gap-1 w-[140px]">
            {/* Section: SCANNING */}
            <div className="border-r-2 border-[var(--neon-magenta,#e91e8c)]/40 pr-1">
              <div className="font-mono text-[7px] text-[var(--neon-magenta,#e91e8c)]/60 mb-1 text-right">SCANNING</div>
              <AnomalyDetector signalStrength={67} anomaliesFound={3} isScanning={true} />
              <div className="mt-1">
                <QuantumCompass anomalyDirection={127} anomalyDistance={42} />
              </div>
            </div>
            {/* Section: TRANSPORT */}
            <div className="border-r-2 border-[var(--neon-blue)]/40 pr-1">
              <div className="font-mono text-[7px] text-[var(--neon-blue)]/60 mb-1 text-right">TRANSPORT</div>
              <TeleportPad chargeLevel={85} lastDestination="LAB-α" isReady={true} />
            </div>
            {/* Section: FABRICATION */}
            <div className="border-r-2 border-[var(--neon-red)]/40 pr-1">
              <div className="font-mono text-[7px] text-[var(--neon-red)]/60 mb-1 text-right">FABRICATION</div>
              <LaserCutter power={450} precision={0.01} isActive={true} />
              <div className="mt-1">
                <Printer3D progress={67} layerCount={234} isPrinting={true} />
              </div>
            </div>
          </div>
        </div>
      </PanelMain>

      {/* Right Panel - Oscilloscope (full height with all controls) */}
      <PanelRight>
        <Oscilloscope
          walletAddress={`${userId.slice(0, 4)}....${userId.slice(-4)}`}
          balance={balance}
          frequency1={2.91}
          frequency2={2.501}
          className="flex-1"
        />
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
    </WindowManagerProvider>
  )
}
