'use client'

import type { DeviceCategory, DeviceState } from '@/types/devices'
import type { DeviceListFilters as FilterState, SortField, SortDirection, DeviceListSort } from './hooks/useDeviceList'

interface DeviceListFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  sort: DeviceListSort
  onSortChange: (sort: DeviceListSort) => void
}

const CATEGORIES: { value: DeviceCategory; label: string }[] = [
  { value: 'generator', label: 'GEN' },
  { value: 'heavy', label: 'HVY' },
  { value: 'medium', label: 'MED' },
  { value: 'light', label: 'LGT' },
  { value: 'storage', label: 'STR' },
]

const STATES: { value: DeviceState; label: string }[] = [
  { value: 'online', label: 'ONLINE' },
  { value: 'standby', label: 'STANDBY' },
  { value: 'offline', label: 'OFFLINE' },
  { value: 'error', label: 'ERROR' },
]

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'device_id', label: 'ID' },
  { value: 'name', label: 'NAME' },
  { value: 'tier', label: 'TIER' },
  { value: 'power', label: 'POWER' },
  { value: 'health', label: 'HEALTH' },
  { value: 'category', label: 'CAT' },
]

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (value: T | undefined) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-green-500/60">{label}:</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as T) : undefined)}
        className="bg-transparent text-green-400 font-mono text-[10px] border border-green-500/20 px-1 py-0 outline-none focus:border-green-500/50 cursor-pointer"
      >
        <option value="" className="bg-[#141618]">ALL</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#141618]">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function DeviceListFilters({ filters, onFiltersChange, sort, onSortChange }: DeviceListFiltersProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleDirection = () => {
    onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
  }

  return (
    <div className="font-mono text-[10px] flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="flex items-center gap-1">
        <span className="text-green-500/60">FIND:</span>
        <input
          type="text"
          value={filters.search ?? ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
          placeholder="..."
          className="bg-transparent text-green-400 font-mono text-[10px] border border-green-500/20 px-1 py-0 w-[100px] outline-none focus:border-green-500/50 placeholder-green-500/20 caret-green-400"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <span className="text-green-500/20">│</span>

      <FilterSelect
        label="CAT"
        value={filters.category}
        options={CATEGORIES}
        onChange={(v) => updateFilter('category', v)}
      />

      <FilterSelect
        label="STATE"
        value={filters.state}
        options={STATES}
        onChange={(v) => updateFilter('state', v)}
      />

      {/* Tier */}
      <div className="flex items-center gap-1">
        <span className="text-green-500/60">TIER:</span>
        <select
          value={filters.tier ?? ''}
          onChange={(e) => updateFilter('tier', e.target.value ? Number(e.target.value) : undefined)}
          className="bg-transparent text-green-400 font-mono text-[10px] border border-green-500/20 px-1 py-0 outline-none focus:border-green-500/50 cursor-pointer"
        >
          <option value="" className="bg-[#141618]">ALL</option>
          {[1, 2, 3, 4, 5].map((t) => (
            <option key={t} value={t} className="bg-[#141618]">T{t}</option>
          ))}
        </select>
      </div>

      <span className="text-green-500/20">│</span>

      {/* Sort */}
      <FilterSelect
        label="SORT"
        value={sort.field}
        options={SORT_FIELDS}
        onChange={(v) => v && onSortChange({ ...sort, field: v })}
      />

      <button
        onClick={toggleDirection}
        className="text-green-400 hover:text-green-300 cursor-pointer border border-green-500/20 px-1 leading-[16px]"
      >
        {sort.direction === 'asc' ? '▲' : '▼'}
      </button>

      {/* Reset */}
      {(filters.category || filters.state || filters.tier || filters.search) && (
        <>
          <span className="text-green-500/20">│</span>
          <button
            onClick={() => onFiltersChange({})}
            className="text-amber-400/80 hover:text-amber-300 cursor-pointer"
          >
            [RESET]
          </button>
        </>
      )}
    </div>
  )
}
