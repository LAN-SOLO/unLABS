'use client'

import { useEffect, useState, useCallback } from 'react'
import { SectionBox } from '../controls/SectionBox'
import { Toggle } from '../controls/Toggle'
import { Slider } from '../controls/Slider'
import { Dropdown } from '../controls/Dropdown'
import { getNetworkPrefs, updateNetworkPrefs, getSystemConfig, getSecurityPolicies } from '@/lib/api/sysprefs'
import type { DbPlayerNetworkPrefs, DbSystemConfigCache, DbUserSecurityPolicies } from '@/types/database'

interface NetworkPanelProps {
  userId: string
  onDirty: (dirty: boolean) => void
  saveSignal: number
  resetSignal: number
}

export function NetworkPanel({ userId, onDirty, saveSignal, resetSignal }: NetworkPanelProps) {
  const [prefs, setPrefs] = useState<DbPlayerNetworkPrefs | null>(null)
  const [original, setOriginal] = useState<DbPlayerNetworkPrefs | null>(null)
  const [sysConfig, setSysConfig] = useState<DbSystemConfigCache | null>(null)
  const [secPolicy, setSecPolicy] = useState<DbUserSecurityPolicies | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getNetworkPrefs(userId),
      getSystemConfig(),
      getSecurityPolicies(),
    ]).then(([p, sc, sp]) => {
      setPrefs(p)
      setOriginal(p)
      setSysConfig(sc)
      setSecPolicy(sp)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!prefs || !original) return
    onDirty(JSON.stringify(prefs) !== JSON.stringify(original))
  }, [prefs, original, onDirty])

  useEffect(() => {
    if (saveSignal === 0 || !prefs) return
    const { id, player_id, created_at, updated_at, ...updates } = prefs
    updateNetworkPrefs(userId, updates)
      .then((saved) => { setPrefs(saved); setOriginal(saved) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal])

  useEffect(() => {
    if (resetSignal === 0 || !original) return
    setPrefs(original)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  const update = useCallback(<K extends keyof DbPlayerNetworkPrefs>(key: K, value: DbPlayerNetworkPrefs[K]) => {
    setPrefs(prev => prev ? { ...prev, [key]: value } : prev)
  }, [])

  if (loading) return <div className="p-2">Loading network preferences...</div>
  if (!prefs) return <div className="p-2 text-red-400">Failed to load network preferences</div>

  const regionOptions = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'us-east', label: 'US East' },
    { value: 'us-west', label: 'US West' },
    { value: 'eu-west', label: 'EU West' },
    { value: 'eu-central', label: 'EU Central' },
    { value: 'asia-east', label: 'Asia East' },
  ]

  const qualityOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'low', label: 'Low Bandwidth' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High Quality' },
  ]

  return (
    <div className="overflow-y-auto space-y-1">
      <SectionBox title="CONNECTION">
        <Toggle label="Auto-Reconnect" value={prefs.auto_reconnect} onChange={(v) => update('auto_reconnect', v)} />
        <Slider label="Ping Interval" value={prefs.ping_interval_seconds} min={10} max={300} showPercent={false} suffix="s" onChange={(v) => update('ping_interval_seconds', v)} />
        <Dropdown label="Region" options={regionOptions} value={prefs.preferred_region ?? 'auto'} onChange={(v) => update('preferred_region', v === 'auto' ? null : v)} />
        <Dropdown label="Quality" options={qualityOptions} value={prefs.connection_quality} onChange={(v) => update('connection_quality', v)} />
        <Toggle label="Notify Disconnect" value={prefs.notify_connection_lost} onChange={(v) => update('notify_connection_lost', v)} />
        <Toggle label="Notify Restart" value={prefs.notify_server_restart} onChange={(v) => update('notify_server_restart', v)} />
      </SectionBox>

      {sysConfig && (
        <>
          <SectionBox title="DNS (READ-ONLY)">
            <Row label="Servers" value={sysConfig.dns_servers.join(', ')} />
            <Row label="Search Domain" value={sysConfig.dns_search_domain ?? 'none'} />
          </SectionBox>

          <SectionBox title="FIREWALL (READ-ONLY)">
            <Row label="Status" value={sysConfig.firewall_enabled ? 'ENABLED' : 'DISABLED'} />
            <Row label="Incoming" value={sysConfig.firewall_default_incoming.toUpperCase()} />
            <Row label="Outgoing" value={sysConfig.firewall_default_outgoing.toUpperCase()} />
            <Row label="Allowed Ports" value={sysConfig.firewall_allowed_ports.join(', ')} />
          </SectionBox>

          <SectionBox title="GAME SERVERS (READ-ONLY)">
            <Row label="Game Server" value={sysConfig.game_server_url} />
            <Row label="Blockchain" value={sysConfig.blockchain_proxy_url} />
            <Row label="Oracle Feed" value={sysConfig.oracle_feed_url} />
          </SectionBox>
        </>
      )}

      {secPolicy && (
        <SectionBox title="SECURITY POLICY (READ-ONLY)">
          <Row label="Min Password" value={`${secPolicy.min_password_length} chars`} />
          <Row label="Special Char" value={secPolicy.require_special_char ? 'Required' : 'Optional'} />
          <Row label="Uppercase" value={secPolicy.require_uppercase ? 'Required' : 'Optional'} />
          <Row label="Max Attempts" value={String(secPolicy.max_login_attempts)} />
          <Row label="Lockout" value={`${secPolicy.lockout_duration_seconds}s`} />
          <Row label="Session Timeout" value={`${secPolicy.session_timeout_seconds}s`} />
          <Row label="Max Sessions" value={String(secPolicy.max_concurrent_sessions)} />
        </SectionBox>
      )}
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
