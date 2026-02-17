'use client'

import { useEffect, useState } from 'react'
import { SectionBox } from '../controls/SectionBox'
import { getSecurityPoliciesServer } from '@/lib/api/sysprefs-server'
import type { DbUserSecurityPolicies } from '@/types/database'

interface UserPanelProps {
  userId: string
  username: string | null
}

export function UserPanel({ userId, username }: UserPanelProps) {
  const [secPolicy, setSecPolicy] = useState<DbUserSecurityPolicies | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSecurityPoliciesServer()
      .then(setSecPolicy)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-2">Loading user information...</div>

  return (
    <div className="overflow-y-auto space-y-1">
      <SectionBox title="PROFILE">
        <Row label="Username" value={username ?? 'operator'} />
        <Row label="User ID" value={userId.slice(0, 8) + '...'} />
        <Row label="Role" value="operator" />
        <Row label="Shell" value="/bin/unsh" />
        <Row label="Home" value={`/unhome/${username ?? 'operator'}`} />
      </SectionBox>

      <SectionBox title="ACTIVE SESSION">
        <Row label="Status" value="ACTIVE" />
        <Row label="Login" value={new Date().toISOString().replace('T', ' ').slice(0, 19)} />
        <Row label="Terminal" value="tty0" />
        <Row label="Client" value="web-terminal" />
      </SectionBox>

      {secPolicy && (
        <SectionBox title="SECURITY POLICY">
          <Row label="Min Password" value={`${secPolicy.min_password_length} characters`} />
          <Row label="Special Char" value={secPolicy.require_special_char ? 'Required' : 'Not required'} />
          <Row label="Uppercase" value={secPolicy.require_uppercase ? 'Required' : 'Not required'} />
          <Row label="Number" value={secPolicy.require_number ? 'Required' : 'Not required'} />
          <Row label="Expiry" value={secPolicy.password_expiry_days ? `${secPolicy.password_expiry_days} days` : 'Never'} />
          <Row label="Max Attempts" value={String(secPolicy.max_login_attempts)} />
          <Row label="Lockout" value={`${secPolicy.lockout_duration_seconds}s`} />
          <Row label="Session Timeout" value={`${secPolicy.session_timeout_seconds}s`} />
          <Row label="Max Sessions" value={String(secPolicy.max_concurrent_sessions)} />
        </SectionBox>
      )}

      <SectionBox title="PASSWORD">
        <div className="text-[var(--state-offline,#666)]">
          Use the terminal command <span className="text-current">passwd</span> to change your password.
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
