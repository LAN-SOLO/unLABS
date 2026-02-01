'use client'

import { useEffect, useState } from 'react'
import { SectionBox } from '../controls/SectionBox'
import { getSystemConfig } from '@/lib/api/sysprefs'
import type { DbSystemConfigCache } from '@/types/database'

export function AboutPanel() {
  const [config, setConfig] = useState<DbSystemConfigCache | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSystemConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-2">Loading system information...</div>
  if (!config) return <div className="p-2 text-red-400">Failed to load system information</div>

  return (
    <div className="overflow-y-auto">
      <SectionBox title="SYSTEM">
        <div className="space-y-0.5">
          <Row label="OS Version" value={`_unOS ${config.os_version} "${config.os_codename}"`} />
          <Row label="Build" value={config.os_build} />
          <Row label="Kernel" value={config.kernel_version} />
          <Row label="Hostname" value={config.hostname} />
        </div>
      </SectionBox>

      <SectionBox title="HARDWARE">
        <div className="space-y-0.5">
          <Row label="CPU" value={config.cpu_model} />
          <Row label="Cores" value={String(config.cpu_cores)} />
          <Row label="Memory" value={`${config.memory_total_gb} GB`} />
          <Row label="Storage Slots" value={String(config.storage_slots_total)} />
        </div>
      </SectionBox>

      <SectionBox title="NETWORK">
        <div className="space-y-0.5">
          <Row label="Game Server" value={config.game_server_url} />
          <Row label="Blockchain" value={config.blockchain_proxy_url} />
          <Row label="Oracle Feed" value={config.oracle_feed_url} />
          <Row label="DNS" value={config.dns_servers.join(', ')} />
          <Row label="Firewall" value={config.firewall_enabled ? 'ENABLED' : 'DISABLED'} />
        </div>
      </SectionBox>

      <SectionBox title="NTP">
        <div className="space-y-0.5">
          <Row label="NTP" value={config.ntp_enabled ? 'ENABLED' : 'DISABLED'} />
          <Row label="Servers" value={config.ntp_servers.join(', ')} />
          <Row label="Interval" value={`${config.ntp_interval_seconds}s`} />
          <Row label="Last Sync" value={config.last_ntp_sync ?? 'Never'} />
        </div>
      </SectionBox>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="min-w-[16ch] text-[var(--state-offline,#666)]">{label}:</span>
      <span>{value}</span>
    </div>
  )
}
