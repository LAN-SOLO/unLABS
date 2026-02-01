'use client'

import type { Device } from '@/types/devices'

interface SpecialApplicationsProps {
  device: Device
}

// Map capabilities to human-readable special applications
function getSpecialApps(device: Device): { name: string; description: string; system: string }[] {
  const apps: { name: string; description: string; system: string }[] = []
  const caps = new Set(device.capabilities)

  if (caps.has('research_boost') || caps.has('simulation')) {
    apps.push({ name: 'Research Accelerator', description: 'Boosts tech tree research speed', system: 'Research' })
  }
  if (caps.has('exploration') || caps.has('aerial_survey')) {
    apps.push({ name: 'Field Discovery', description: 'Find anomalies and resource nodes', system: 'Exploration' })
  }
  if (caps.has('resource_attraction') || caps.has('material_collection')) {
    apps.push({ name: 'Passive Collection', description: 'Gather resources while idle', system: 'Economy' })
  }
  if (caps.has('sound_synthesis') || caps.has('multi_oscillator')) {
    apps.push({ name: 'Resonance Experiments', description: 'Crystal frequency manipulation', system: 'Audio' })
  }
  if (caps.has('containment_field') || caps.has('exotic_storage')) {
    apps.push({ name: 'Exotic Containment', description: 'Store volatile materials safely', system: 'Safety' })
  }
  if (caps.has('trait_identification') || caps.has('state_mapping')) {
    apps.push({ name: 'Crystal Analysis', description: 'Identify crystal traits with high accuracy', system: 'Quantum' })
  }
  if (caps.has('automation') || caps.has('resource_optimization')) {
    apps.push({ name: 'Lab Automation', description: 'AI-managed task scheduling', system: 'Management' })
  }
  if (caps.has('teleportation')) {
    apps.push({ name: 'Matter Transport', description: 'Short-range teleportation of materials', system: 'Transport' })
  }
  if (caps.has('fabrication') || caps.has('prototyping')) {
    apps.push({ name: 'Component Fabrication', description: 'Manufacture parts and prototypes', system: 'Production' })
  }
  if (caps.has('cooling') || caps.has('reactor_efficiency_boost')) {
    apps.push({ name: 'Thermal Regulation', description: 'Manage heat for reactor efficiency', system: 'Infrastructure' })
  }

  return apps
}

export function SpecialApplications({ device }: SpecialApplicationsProps) {
  const apps = getSpecialApps(device)

  if (apps.length === 0) {
    return (
      <div className="font-mono text-[10px] text-green-500/30 py-2">
        NO SPECIAL APPLICATIONS REGISTERED
      </div>
    )
  }

  return (
    <div className="font-mono text-[10px] space-y-0.5">
      {apps.map((app) => (
        <div key={app.name} className="flex items-start gap-2 py-0.5">
          <span className="text-cyan-400/60">▸</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-green-400">{app.name}</span>
              <span className="text-green-500/20">│</span>
              <span className="text-violet-400/50 text-[9px]">{app.system}</span>
            </div>
            <div className="text-green-500/50">{app.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
