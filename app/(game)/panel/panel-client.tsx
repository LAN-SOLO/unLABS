'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  MicrofusionReactor,
  AIAssistant,
  ExplorerDrone,
  AnomalyDetector,
  TeleportPad,
  LaserCutter,
  Printer3D,
  ExoticMatterContainment,
  SupercomputerArray,
  QuantumStateMonitor,
  NetworkMonitor,
  TemperatureMonitor,
  DimensionMonitor,
  CpuMonitor,
  LabClock,
  MemoryMonitor,
} from '@/components/panel/modules/EquipmentTile'
import { ResourceBar } from '@/components/panel/modules/ResourceBar'
import { PowerButton } from '@/components/panel/modules/PowerButton'
import { CRTShutdownEffect } from '@/components/panel/effects/CRTShutdownEffect'
import { BootSequence } from '@/components/panel/effects/BootSequence'
import { SystemPowerManagerProvider, useSystemPowerInternal } from '@/contexts/SystemPowerManager'
import { VentilationFan } from '@/components/panel/modules/VentilationFan'
import { NarrowSpeaker } from '@/components/panel/modules/NarrowSpeaker'
import { loadPanelState } from '@/lib/panel/panelState'
import type { PanelSaveData } from '@/lib/panel/panelState'
import { ThermalManagerProvider } from '@/contexts/ThermalManager'
import { PowerManagerProvider } from '@/contexts/PowerManager'
import { CDCManagerProvider } from '@/contexts/CDCManager'
import { UECManagerProvider } from '@/contexts/UECManager'
import { BATManagerProvider } from '@/contexts/BATManager'
import { HMSManagerProvider } from '@/contexts/HMSManager'
import { ECRManagerProvider } from '@/contexts/ECRManager'
import { IPLManagerProvider } from '@/contexts/IPLManager'
import { MFRManagerProvider } from '@/contexts/MFRManager'
import { AICManagerProvider } from '@/contexts/AICManager'
import { VNTManagerProvider } from '@/contexts/VNTManager'
import { SCAManagerProvider } from '@/contexts/SCAManager'
import { EXDManagerProvider } from '@/contexts/EXDManager'
import { QSMManagerProvider } from '@/contexts/QSMManager'
import { EMCManagerProvider } from '@/contexts/EMCManager'
import { QUAManagerProvider } from '@/contexts/QUAManager'
import { PWBManagerProvider } from '@/contexts/PWBManager'
import { BTKManagerProvider } from '@/contexts/BTKManager'
import { RMGManagerProvider } from '@/contexts/RMGManager'
import { MSCManagerProvider } from '@/contexts/MSCManager'
import { NETManagerProvider } from '@/contexts/NETManager'
import { TMPManagerProvider } from '@/contexts/TMPManager'
import { DIMManagerProvider } from '@/contexts/DIMManager'
import { CPUManagerProvider } from '@/contexts/CPUManager'
import { CLKManagerProvider, useCLKManagerOptional, type CLKMode } from '@/contexts/CLKManager'
import { MEMManagerProvider, type MEMMode } from '@/contexts/MEMManager'
import { ANDManagerProvider, type ANDMode } from '@/contexts/ANDManager'
import { QCPManagerProvider, type QCPMode } from '@/contexts/QCPManager'
import { TLPManagerProvider, type TLPMode } from '@/contexts/TLPManager'
import { LCTManagerProvider, type LCTMode } from '@/contexts/LCTManager'
import { P3DManagerProvider, type P3DMode } from '@/contexts/P3DManager'
import { SPKManagerProvider } from '@/contexts/SPKManager'
import { DGNManagerProvider } from '@/contexts/DGNManager'
import { ScrewButtonManagerProvider } from '@/contexts/ScrewButtonManager'
import { ResourceManagerProvider, useResourceManagerOptional } from '@/contexts/ResourceManager'
import { WalletProvider } from '@/contexts/WalletContext'
import { ResourceGrid } from '@/components/panel/modules/ResourceGrid'
import type { EquipmentData } from '../terminal/actions/equipment'

interface PanelClientProps {
  userId: string
  username: string | null
  balance: number
  equipmentData?: EquipmentData
}

export function PanelClient({ userId, username, balance, equipmentData }: PanelClientProps) {
  const router = useRouter()
  const savedStateRef = useRef<PanelSaveData | null>(null)
  if (savedStateRef.current === null && typeof window !== 'undefined') {
    savedStateRef.current = loadPanelState()
  }
  const saved = savedStateRef.current?.devices
  const [hasAccess, setHasAccess] = useState(false)

  // Simulated system loads for ventilation fans
  const [cpuLoad, setCpuLoad] = useState(45)
  const [gpuLoad, setGpuLoad] = useState(62)

  // Simulate varying system loads
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(prev => {
        const delta = (Math.random() - 0.5) * 20
        return Math.min(95, Math.max(15, prev + delta))
      })
      setGpuLoad(prev => {
        const delta = (Math.random() - 0.5) * 25
        return Math.min(98, Math.max(20, prev + delta))
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Check for panel access from terminal (server-side verification)
  useEffect(() => {
    import('@/app/(game)/terminal/actions/panel-access').then(
      ({ verifyPanelAccess }) => {
        verifyPanelAccess().then(({ valid }) => {
          if (!valid) {
            router.replace('/terminal')
          } else {
            setHasAccess(true)
          }
        })
      }
    )
  }, [router])

  const handleShutdownComplete = useCallback(() => {
    import('@/app/(game)/terminal/actions/panel-access').then(
      ({ revokePanelAccess }) => revokePanelAccess()
    )
    router.replace('/terminal')
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
    <WalletProvider>
    <SystemPowerManagerProvider
      onShutdownComplete={handleShutdownComplete}
      saveDeviceState={() => {
        // saveAllDeviceState is wired via the terminal — trigger from context
      }}
    >
    <PowerManagerProvider>
    <ThermalManagerProvider>
    <CDCManagerProvider initialState={saved?.cdc}>
    <UECManagerProvider initialState={saved?.uec}>
    <BATManagerProvider initialState={saved?.bat}>
    <HMSManagerProvider initialState={saved?.hms}>
    <ECRManagerProvider initialState={saved?.ecr}>
    <IPLManagerProvider initialState={saved?.ipl}>
    <MFRManagerProvider initialState={saved?.mfr}>
    <AICManagerProvider initialState={saved?.aic}>
    <VNTManagerProvider initialState={saved?.vnt}>
    <SCAManagerProvider initialState={saved?.sca}>
    <EXDManagerProvider initialState={saved?.exd}>
    <QSMManagerProvider initialState={saved?.qsm}>
    <EMCManagerProvider initialState={saved?.emc}>
    <QUAManagerProvider initialState={saved?.qua}>
    <PWBManagerProvider initialState={saved?.pwb}>
    <BTKManagerProvider initialState={saved?.btk}>
    <RMGManagerProvider initialState={saved?.rmg}>
    <MSCManagerProvider initialState={saved?.msc}>
    <NETManagerProvider initialState={saved?.net}>
    <TMPManagerProvider initialState={saved?.tmp}>
    <DIMManagerProvider initialState={saved?.dim}>
    <CPUManagerProvider initialState={saved?.cpu}>
    <CLKManagerProvider initialState={saved?.clk ? { isPowered: saved.clk.isPowered, displayMode: saved.clk.displayMode as CLKMode | undefined } : undefined}>
    <MEMManagerProvider initialState={saved?.mem ? { isPowered: saved.mem.isPowered, totalMemory: saved.mem.totalMemory, usedMemory: saved.mem.usedMemory, displayMode: saved.mem.displayMode as MEMMode | undefined } : undefined}>
    <ANDManagerProvider initialState={saved?.and ? { isPowered: saved.and.isPowered, signalStrength: saved.and.signalStrength, anomaliesFound: saved.and.anomaliesFound, displayMode: saved.and.displayMode as ANDMode | undefined } : undefined}>
    <QCPManagerProvider initialState={saved?.qcp ? { isPowered: saved.qcp.isPowered, anomalyDirection: saved.qcp.anomalyDirection, anomalyDistance: saved.qcp.anomalyDistance, displayMode: saved.qcp.displayMode as QCPMode | undefined } : undefined}>
    <TLPManagerProvider initialState={saved?.tlp ? { isPowered: saved.tlp.isPowered, chargeLevel: saved.tlp.chargeLevel, lastDestination: saved.tlp.lastDestination, displayMode: saved.tlp.displayMode as TLPMode | undefined } : undefined}>
    <LCTManagerProvider initialState={saved?.lct ? { isPowered: saved.lct.isPowered, laserPower: saved.lct.laserPower, precision: saved.lct.precision, displayMode: saved.lct.displayMode as LCTMode | undefined } : undefined}>
    <P3DManagerProvider initialState={saved?.p3d ? { isPowered: saved.p3d.isPowered, progress: saved.p3d.progress, layerCount: saved.p3d.layerCount, bedTemp: saved.p3d.bedTemp, displayMode: saved.p3d.displayMode as P3DMode | undefined } : undefined}>
    <SPKManagerProvider initialState={saved?.spk ? { isPowered: saved.spk.isPowered, volume: saved.spk.volume, isMuted: saved.spk.isMuted, filters: saved.spk.filters } : undefined}>
    <DGNManagerProvider initialState={saved?.dgn ? { isPowered: saved.dgn.isPowered, category: saved.dgn.category, scanDepth: saved.dgn.scanDepth } : undefined}>
    <ScrewButtonManagerProvider initialState={saved?.screwButtons}>
    <ResourceManagerProvider initialState={savedStateRef.current?.resources}>
    <WindowManagerProvider className="text-white">
      {/* Top Toolbar */}
      <PanelToolbar>
        {/* Tools */}
        <div className="flex items-center gap-1">
          {['TOOL 1', 'TOOL 2', 'TOOL 3', 'TOOL 4', 'TOOL 5', 'TOOL 6'].map((label) => (
            <div
              key={label}
              className="h-7 px-2 bg-[var(--panel-surface-light)] border border-white/10 rounded flex items-center justify-center"
            >
              <span className="font-mono text-[8px] text-white/30">{label}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1">
          {['BTN 1', 'BTN 2', 'BTN 3', 'BTN 4'].map((label) => (
            <div
              key={label}
              className="h-7 px-2 bg-[var(--panel-surface-light)] border border-white/10 rounded flex items-center justify-center"
            >
              <span className="font-mono text-[8px] text-white/30">{label}</span>
            </div>
          ))}
        </div>

        {/* Applications */}
        <div className="flex items-center gap-1">
          {['APP 1', 'APP 2', 'APP 3', 'APP 4'].map((label) => (
            <div
              key={label}
              className="h-7 px-2 bg-[var(--panel-surface-light)] border border-white/10 rounded flex items-center justify-center"
            >
              <span className="font-mono text-[8px] text-white/30">{label}</span>
            </div>
          ))}
        </div>
      </PanelToolbar>

      {/* Left Panel - Power, Resources & Field Ops */}
      <PanelLeft>
        <CrystalDataCache
          crystalCount={crystals.count}
          sliceCount={crystals.totalSlices}
          totalPower={crystals.totalPower}
        />
        <EnergyCore
          volatilityTier={volatility.currentTier}
          tps={volatility.tps}
        />
        <BatteryPack
          available={balanceData.available}
          staked={balanceData.staked}
          locked={balanceData.locked}
        />
        <MicrofusionReactor />
        <ResourceGrid />
        <HandmadeSynthesizer progress={techTrees?.synthesizers} />
        <EchoRecorder progress={techTrees?.adapters} />
        <Interpolator progress={techTrees?.optics} />
        <div className="flex gap-1 flex-1 min-h-0">
          <VentilationFan label="CPU" fanId="cpu" systemLoad={cpuLoad} targetTemp={35} className="flex-1" />
          <VentilationFan label="GPU" fanId="gpu" systemLoad={gpuLoad} targetTemp={40} className="flex-1" />
        </div>
      </PanelLeft>

      {/* Main Area - Terminal + Organized Modules */}
      <PanelMain>
        {/* Top resource bars */}
        <TopResourceBars />

        {/* Main content - Terminal-first layout */}
        <div className="flex flex-col gap-1 flex-1">
          {/* Displays row: Terminal + Quantum Analyzer + Diagnostics */}
          <div className="flex gap-1" style={{ minHeight: '280px' }}>
            <div className="flex-1 min-w-[400px]">
              <TerminalModule userId={userId} username={username} balance={balance} />
            </div>
            <div className="w-[280px]">
              <QuantumAnalyzer className="h-full" />
            </div>
            <div className="w-[320px]">
              <DiagnosticsConsole className="h-full" />
            </div>
          </div>

          {/* Core Operations Row */}
          <div className="border-t border-[var(--neon-green)]/20 pt-1">
            <div className="font-mono text-[7px] text-white/40 mb-1 px-1">CORE OPERATIONS</div>
            <div className="grid grid-cols-5 gap-1">
              <AIAssistant />
              <SupercomputerArray flops={2.4} utilization={87} isOnline={true} />
              <ExplorerDrone range={2.4} battery={78} isDeployed={true} />
              <ResourceMagnet magnetStrength={45} isActive={true} />
              <AnomalyDetector />
            </div>
          </div>

          {/* System Status Row */}
            <div className="border-t border-[var(--neon-cyan)]/20 pt-1">
              <div className="font-mono text-[7px] text-white/40 mb-1 px-1">SYSTEM STATUS</div>
              <div className="grid grid-cols-5 gap-1">
                <ExoticMatterContainment units={42} stability={76} isContained={true} />
                <QuantumStateMonitor coherence={94} qubits={127} isEntangled={true} />
                <NetworkMonitor bandwidth={2.4} latency={12} isConnected={true} />
                <TemperatureMonitor temperature={28.4} minTemp={15} maxTemp={85} />
                <DimensionMonitor dimension={3.14} stability={98} riftActivity={0.02} />
              </div>
            </div>

            {/* Tools Row */}
            <div className="border-t border-[var(--neon-amber)]/20 pt-1">
              <div className="font-mono text-[7px] text-white/40 mb-1 px-1">TOOLS & MONITORS</div>
              <div className="grid grid-cols-6 gap-1">
                <PortableWorkbench queuedItems={2} craftingProgress={45} />
                <BasicToolkit />
                <MaterialScanner scanProgress={78} detectedMaterials={5} />
                <LabClock />
                <CpuMonitor />
                <MemoryMonitor />
              </div>
            </div>

            {/* Tech Tree Preview - All 12 Trees */}
            <div className="border-t border-white/10 pt-1 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-0.5 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[6px] text-white/40 tracking-wider">RESEARCH TREES</span>
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-[var(--neon-green)] animate-pulse" />
                    <div className="w-1 h-1 rounded-full bg-[var(--neon-amber)]" />
                    <div className="w-1 h-1 rounded-full bg-white/15" />
                  </div>
                </div>
                <span className="font-mono text-[5px] text-white/25">3/12 ACTIVE</span>
              </div>

              {/* Gameplay Trees - 2 rows x 4 cols */}
              <div className="grid grid-cols-4 gap-[3px] mb-[3px]">
                {([
                  { name: 'Tech',    icon: '⚡', tier: 2, progress: 78, color: '#00e5ff', status: 'active' },
                  { name: 'Tools',   icon: '⚒',  tier: 1, progress: 45, color: '#ffb300', status: 'active' },
                  { name: 'Gadgets', icon: '◈', tier: 1, progress: 22, color: '#b388ff', status: 'active' },
                  { name: 'Science', icon: '◎', tier: 2, progress: 91, color: '#69f0ae', status: 'active' },
                  { name: 'Refine',  icon: '⬡', tier: 1, progress: 10, color: '#ff6e40', status: 'idle' },
                  { name: 'Combo',   icon: '⊕', tier: 0, progress: 0,  color: '#ffd740', status: 'locked' },
                  { name: 'Music',   icon: '♫', tier: 1, progress: 33, color: '#ea80fc', status: 'idle' },
                  { name: 'Art',     icon: '✦', tier: 0, progress: 0,  color: '#ff80ab', status: 'locked' },
                ] as const).map(t => {
                  const isLocked = t.status === 'locked'
                  const isActive = t.status === 'active'
                  return (
                    <div key={t.name} className="relative overflow-hidden rounded-[2px]" style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
                      border: `0.5px solid ${isLocked ? 'rgba(255,255,255,0.06)' : isActive ? t.color + '30' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      <div className="flex items-center gap-1 px-1 py-[3px]">
                        <span className="text-[9px] leading-none" style={{ color: isLocked ? 'rgba(255,255,255,0.15)' : t.color, filter: isActive ? `drop-shadow(0 0 3px ${t.color})` : 'none' }}>{t.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[7px] text-white/70 truncate">{t.name}</span>
                            <span className="font-mono text-[6px] shrink-0" style={{ color: isLocked ? 'rgba(255,255,255,0.2)' : t.color + 'aa' }}>
                              {isLocked ? '—' : `T${t.tier}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-[2px]">
                            <div className="flex-1 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${t.progress}%`,
                                background: isLocked ? 'transparent' : t.color,
                                boxShadow: isActive ? `0 0 4px ${t.color}` : 'none',
                              }} />
                            </div>
                            {isLocked && <span className="font-mono text-[5px] text-white/20">LOCK</span>}
                            {!isLocked && <span className="font-mono text-[5px]" style={{ color: t.color + '80' }}>{t.progress}%</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Trait Trees - 1 row x 4 cols, highlighted */}
              <div className="grid grid-cols-4 gap-[3px]">
                {([
                  { name: 'Devices',      icon: '⚙', tier: 1, maxV: 1, cap: 'Vol ≤1',  color: '#4fc3f7', progress: 60 },
                  { name: 'Optics',       icon: '◉', tier: 1, maxV: 0, cap: '≤Orange', color: '#ce93d8', progress: 40 },
                  { name: 'Adapters',     icon: '⇌', tier: 0, maxV: 0, cap: 'View',    color: '#81c784', progress: 0 },
                  { name: 'Synthesizers', icon: '⬢', tier: 1, maxV: 0, cap: 'Basic',   color: '#ffab91', progress: 25 },
                ] as const).map(t => {
                  const isLocked = t.tier === 0
                  return (
                    <div key={t.name} className="relative overflow-hidden rounded-[2px]" style={{
                      background: `linear-gradient(180deg, ${t.color}08 0%, rgba(0,0,0,0.25) 100%)`,
                      border: `0.5px solid ${isLocked ? 'rgba(255,255,255,0.06)' : t.color + '35'}`,
                    }}>
                      <div className="flex items-center gap-1 px-1 py-[3px]">
                        <span className="text-[9px] leading-none" style={{ color: isLocked ? 'rgba(255,255,255,0.15)' : t.color, filter: !isLocked ? `drop-shadow(0 0 2px ${t.color})` : 'none' }}>{t.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[7px] text-white/70 truncate">{t.name}</span>
                            <span className="font-mono text-[5px] px-[3px] rounded-[1px] shrink-0" style={{
                              color: isLocked ? 'rgba(255,255,255,0.25)' : t.color,
                              background: isLocked ? 'transparent' : t.color + '15',
                              border: isLocked ? 'none' : `0.5px solid ${t.color}25`,
                            }}>{isLocked ? '—' : t.cap}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-[2px]">
                            {/* 5-segment tier meter */}
                            <div className="flex gap-[1px]">
                              {[1,2,3,4,5].map(i => (
                                <div key={i} className="h-[3px] rounded-[0.5px]" style={{
                                  width: '4px',
                                  background: i <= t.tier ? t.color : 'rgba(255,255,255,0.06)',
                                  boxShadow: i <= t.tier ? `0 0 3px ${t.color}` : 'none',
                                }} />
                              ))}
                            </div>
                            <div className="flex-1" />
                            <span className="font-mono text-[5px]" style={{ color: isLocked ? 'rgba(255,255,255,0.2)' : t.color + '80' }}>
                              {isLocked ? 'LOCK' : `T${t.tier}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
      </PanelMain>

      {/* Right Panel - Displays & Scanning */}
      <PanelRight>
        <div className="flex flex-col gap-1 h-full">
          {/* Top: Oscilloscope + Speaker */}
          <div className="flex gap-1" style={{ flex: '55 1 0%' }}>
            <Oscilloscope
              walletAddress={`${userId.slice(0, 4)}....${userId.slice(-4)}`}
              balance={balance}
              frequency1={2.91}
              frequency2={2.501}
              className="flex-1"
            />
            <NarrowSpeaker className="h-full" />
          </div>
          {/* Bottom: Scanning & Transport */}
          <div className="flex flex-col gap-1" style={{ flex: '45 1 0%' }}>
            <div className="font-mono text-[7px] text-white/40 px-1">SCANNING & TRANSPORT</div>
            <QuantumCompass />
            <TeleportPad />
            <LaserCutter />
            <Printer3D />
          </div>
        </div>
      </PanelRight>

      {/* Bottom Resource Bar + Power Button */}
      <PanelBottom>
        <BottomResourceBar />
        <PowerButton />
      </PanelBottom>

      {/* System Power Effects */}
      <SystemPowerEffects />

    </WindowManagerProvider>
    </ResourceManagerProvider>
    </ScrewButtonManagerProvider>
    </DGNManagerProvider>
    </SPKManagerProvider>
    </P3DManagerProvider>
    </LCTManagerProvider>
    </TLPManagerProvider>
    </QCPManagerProvider>
    </ANDManagerProvider>
    </MEMManagerProvider>
    </CLKManagerProvider>
    </CPUManagerProvider>
    </DIMManagerProvider>
    </TMPManagerProvider>
    </NETManagerProvider>
    </MSCManagerProvider>
    </RMGManagerProvider>
    </BTKManagerProvider>
    </PWBManagerProvider>
    </QUAManagerProvider>
    </EMCManagerProvider>
    </QSMManagerProvider>
    </EXDManagerProvider>
    </SCAManagerProvider>
    </VNTManagerProvider>
    </AICManagerProvider>
    </MFRManagerProvider>
    </IPLManagerProvider>
    </ECRManagerProvider>
    </HMSManagerProvider>
    </BATManagerProvider>
    </UECManagerProvider>
    </CDCManagerProvider>
    </ThermalManagerProvider>
    </PowerManagerProvider>
    </SystemPowerManagerProvider>
    </WalletProvider>
  )
}

/** Top resource summary bars - reads live data from ResourceManager */
function TopResourceBars() {
  const rm = useResourceManagerOptional()
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(interval)
  }, [])

  const bars = [
    { name: 'Abstractum', label: 'RES-1', color: 'var(--neon-green)', type: 'Abstractum' },
    { name: 'Energy', label: 'RES-2', color: 'var(--neon-cyan)', type: 'Energy' },
    { name: 'Alloys', label: 'RES-3', color: 'var(--neon-amber)', type: 'Base Alloy' },
    { name: 'Nano', label: 'RES-4', color: '#b388ff', type: 'Nanomaterial' },
  ]

  return (
    <div className="grid grid-cols-4 gap-1 mb-1">
      {bars.map((res) => {
        const agg = rm?.getAggregated(res.type) ?? { amount: 0, capacity: 1 }
        const pct = agg.capacity > 0 ? (agg.amount / agg.capacity) : 0
        return (
          <PanelFrame key={res.label} variant="default" className="p-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-white/80">{res.name}</span>
              <span className="font-mono text-[8px] text-white/40">{Math.floor(agg.amount)}/{agg.capacity}</span>
            </div>
            <div className="h-1.5 bg-black/50 rounded overflow-hidden mt-1">
              <div className="h-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: res.color }} />
            </div>
          </PanelFrame>
        )
      })}
    </div>
  )
}

/** Bottom resource bar - shows first 12 unlocked containers */
function BottomResourceBar() {
  const rm = useResourceManagerOptional()
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 3000)
    return () => clearInterval(interval)
  }, [])

  if (!rm) return <ResourceBar />

  const unlocked = rm.getUnlockedContainers().slice(0, 12)
  const resources = unlocked.map(([id, cs]) => ({
    id,
    label: id,
    value: cs.amount,
    max: cs.capacity,
  }))

  return <ResourceBar resources={resources.length > 0 ? resources : undefined} />
}

/** Inner component that reads SystemPower context for CRT/boot effects + CLK-001 sync */
function SystemPowerEffects() {
  const { systemState, countdownSeconds, countdownAction, onShutdownComplete, finishBoot } = useSystemPowerInternal()
  const clk = useCLKManagerOptional()

  // Sync system power countdown → CLK-001: power on, unfold, set countdown mode
  const clkSyncedRef = useRef(false)
  const clkBootDoneRef = useRef(false)

  // Step 1: Power on CLK-001 when countdown starts
  useEffect(() => {
    if (!clk) return
    if (systemState === 'countdown' && countdownSeconds !== null && !clkSyncedRef.current) {
      clkSyncedRef.current = true
      clkBootDoneRef.current = false
      if (!clk.isPowered) {
        clk.powerOn()
      }
      clk.setExpanded(true)
    }
    if (systemState !== 'countdown' && clkSyncedRef.current) {
      clkSyncedRef.current = false
      clkBootDoneRef.current = false
      clk.setCountdownRunning(false)
      // Return CLK-001 to standby after countdown action executes
      if (clk.isPowered && clk.deviceState === 'online') {
        clk.powerOff()
      }
    }
  // Only react to systemState transitions, not every tick
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemState])

  // Step 2: Once CLK-001 is online, set mode and sync time every second
  useEffect(() => {
    if (!clk || !clkSyncedRef.current) return
    if (systemState !== 'countdown' || countdownSeconds === null) return

    // Wait for CLK to be online before setting mode
    if (clk.deviceState !== 'online') return

    if (!clkBootDoneRef.current) {
      clkBootDoneRef.current = true
      clk.setMode('countdown')
    }

    // Sync the countdown value from SystemPowerManager (it drives the countdown)
    clk.setCountdownTime(countdownSeconds)
    // Don't start CLK's own countdown — we set the value externally each tick
    // But set running=true so the display shows "RUNNING"
    if (!clk.countdownRunning) {
      clk.setCountdownRunning(true)
    }
  }, [systemState, countdownSeconds, clk])

  const { powerScope } = useSystemPowerInternal()

  // Only handle 'system' scope effects here — 'os' scope is handled inside TerminalModule
  const isSystemScope = powerScope === 'system'
  const holdCRTBlack = isSystemScope && (systemState === 'rebooting' || systemState === 'booting')

  const handleCRTComplete = useCallback(() => {
    // 'system' scope: shutdown → off is handled by SystemPowerManager timeout
    // 'system' scope: reboot → holdBlack keeps screen black until boot
  }, [])

  const handleBootComplete = useCallback(() => {
    finishBoot()
  }, [finishBoot])

  const crtActive = isSystemScope && (systemState === 'shutting-down' || systemState === 'rebooting')
  const isOff = systemState === 'off'

  // For 'system' scope shutdown: navigate away after CRT
  useEffect(() => {
    if (powerScope === 'system' && systemState === 'off') {
      onShutdownComplete?.()
    }
  }, [powerScope, systemState, onShutdownComplete])

  return (
    <>
      {isSystemScope && (
        <CRTShutdownEffect
          active={crtActive}
          onComplete={handleCRTComplete}
          holdBlack={holdCRTBlack}
        />
      )}
      {isSystemScope && (
        <BootSequence
          active={systemState === 'booting'}
          onComplete={handleBootComplete}
        />
      )}
      {isOff && isSystemScope && (
        <div className="fixed inset-0 z-[9999] bg-black" />
      )}
    </>
  )
}
