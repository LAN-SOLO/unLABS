'use client'

import { useCombinations } from '../hooks/useCombinations'
import { ActiveSynergyCard } from './ActiveSynergyCard'
import { AvailableCombinationCard } from './AvailableCombinationCard'
import { SpecialApplications } from './SpecialApplications'

interface CombinationsViewProps {
  deviceId: string
  playerId: string
  onLink: (partnerId: string) => void
  onUnlink: (partnerId: string) => void
  onBack: () => void
}

export function CombinationsView({ deviceId, playerId, onLink, onUnlink, onBack }: CombinationsViewProps) {
  const { device, activeList, availableList, loading, linking, error, handleLink, handleUnlink } =
    useCombinations({ deviceId, playerId })

  const doLink = async (partnerId: string) => {
    await handleLink(partnerId)
    onLink(partnerId)
  }

  const doUnlink = async (partnerId: string) => {
    await handleUnlink(partnerId)
    onUnlink(partnerId)
  }

  if (loading) {
    return (
      <div className="font-mono text-[10px] text-green-500/40 py-4 px-2">
        <span className="animate-pulse">LOADING COMBINATIONS...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="font-mono text-[10px] text-red-500 py-4 px-2">
        ERR: {error}
      </div>
    )
  }

  return (
    <div className="font-mono text-[10px] space-y-3 px-2 py-1">
      {/* Active Synergies */}
      <div>
        <div className="text-green-500/40 whitespace-pre">
          {'┌─ Active Synergies (' + activeList.length + ') ' + '─'.repeat(48) + '┐'}
        </div>
        {activeList.length === 0 ? (
          <div className="whitespace-pre">
            <span className="text-green-500/40">│</span>
            <span className="text-green-500/30">  NO ACTIVE SYNERGIES</span>
          </div>
        ) : (
          activeList.map((combo) => (
            <div key={`${combo.primary_device}-${combo.secondary_device}`} className="whitespace-pre">
              <span className="text-green-500/40">│ </span>
              <ActiveSynergyCard
                combo={combo}
                currentDeviceId={deviceId}
                onUnlink={doUnlink}
                linking={linking}
              />
            </div>
          ))
        )}
        <div className="text-green-500/40 whitespace-pre">
          {'└' + '─'.repeat(69) + '┘'}
        </div>
      </div>

      {/* Available Combinations */}
      <div>
        <div className="text-green-500/40 whitespace-pre">
          {'┌─ Available (' + availableList.length + ') ' + '─'.repeat(54) + '┐'}
        </div>
        {availableList.length === 0 ? (
          <div className="whitespace-pre">
            <span className="text-green-500/40">│</span>
            <span className="text-green-500/30">  NO COMBINATIONS AVAILABLE</span>
          </div>
        ) : (
          availableList.map((combo) => (
            <div key={`${combo.primary_device}-${combo.secondary_device}`} className="whitespace-pre">
              <span className="text-green-500/40">│ </span>
              <AvailableCombinationCard
                combo={combo}
                currentDeviceId={deviceId}
                onLink={doLink}
                linking={linking}
              />
            </div>
          ))
        )}
        <div className="text-green-500/40 whitespace-pre">
          {'└' + '─'.repeat(69) + '┘'}
        </div>
      </div>

      {/* Special Applications */}
      <div>
        <div className="text-green-500/40 whitespace-pre">
          {'┌─ Special Applications ' + '─'.repeat(47) + '┐'}
        </div>
        <div className="whitespace-pre">
          <span className="text-green-500/40">│ </span>
          {device ? (
            <SpecialApplications device={device} />
          ) : (
            <span className="text-green-500/30">NO DEVICE DATA</span>
          )}
        </div>
        <div className="text-green-500/40 whitespace-pre">
          {'└' + '─'.repeat(69) + '┘'}
        </div>
      </div>
    </div>
  )
}
