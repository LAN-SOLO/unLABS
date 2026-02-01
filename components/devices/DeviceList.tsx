'use client'

import { useState } from 'react'
import { useDeviceList } from './hooks/useDeviceList'
import { DeviceListHeader } from './DeviceListHeader'
import { DeviceListFilters } from './DeviceListFilters'
import { DeviceListItem } from './DeviceListItem'
import type { DeviceCategory, DeviceState } from '@/types/devices'

interface DeviceListProps {
  onDeviceSelect: (device_id: string) => void
  playerId?: string
  filter?: { category?: DeviceCategory; state?: DeviceState; tier?: number }
}

// Column widths for the ASCII table
const HEADER_LINE = '╔══════════╦═══════════════════════════╦═══════╦═════════╦══════════════╦══════╦═══════╗'
const HEADER_ROW  = '║ ID       ║ DEVICE                    ║ TIER  ║ STATUS  ║ POWER        ║ CAT  ║ HEALTH║'
const HEADER_DIV  = '╠══════════╬═══════════════════════════╬═══════╬═════════╬══════════════╬══════╬═══════╣'
const FOOTER_LINE = '╚══════════╩═══════════════════════════╩═══════╩═════════╩══════════════╩══════╩═══════╝'

export function DeviceList({ onDeviceSelect, playerId, filter }: DeviceListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const {
    items,
    powerSummary,
    filters,
    setFilters,
    sort,
    setSort,
    loading,
    error,
    totalCount,
    filteredCount,
  } = useDeviceList({ playerId, initialFilter: filter })

  const handleSelect = (device_id: string) => {
    setSelectedId(device_id)
    onDeviceSelect(device_id)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Summary header */}
      <DeviceListHeader
        totalCount={totalCount}
        filteredCount={filteredCount}
        powerSummary={powerSummary}
        loading={loading}
      />

      {/* Filter bar */}
      <DeviceListFilters
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Error */}
      {error && (
        <div className="font-mono text-[10px] text-red-500 border border-red-500/30 px-2 py-1">
          ERR: {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] leading-[18px] whitespace-pre select-none min-w-fit">
          {/* Table header */}
          <div className="text-green-500/30">{HEADER_LINE}</div>
          <div className="text-green-500/80">{HEADER_ROW}</div>
          <div className="text-green-500/30">{HEADER_DIV}</div>

          {/* Loading state */}
          {loading && (
            <div className="text-green-500/40 py-2 px-2">
              ║ <span className="animate-pulse">LOADING DEVICE REGISTRY...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div className="text-green-500/40 py-2 px-2">
              ║ NO DEVICES MATCH CURRENT FILTERS
            </div>
          )}

          {/* Device rows */}
          {!loading && items.map((item) => (
            <DeviceListItem
              key={item.device_id}
              device={item}
              selected={selectedId === item.device_id}
              onClick={handleSelect}
            />
          ))}

          {/* Table footer */}
          <div className="text-green-500/30">{FOOTER_LINE}</div>
        </div>
      </div>

      {/* Footer info */}
      {!loading && (
        <div className="font-mono text-[9px] text-green-500/40 flex justify-between">
          <span>{filteredCount} device{filteredCount !== 1 ? 's' : ''} listed</span>
          <span>CLICK TO INSPECT</span>
        </div>
      )}
    </div>
  )
}
