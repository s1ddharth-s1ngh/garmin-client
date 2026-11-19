import { Globe } from 'lucide-react'
import { useId } from 'react'
import { browserTimezone } from '../lib/dates'

const zones = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['Europe/Rome', 'Europe/London', 'America/New_York']
  }
})()

export function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const id = useId()
  const detected = browserTimezone()
  const options = zones.includes(value) ? zones : [value, ...zones]
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-semibold text-ink-2">Timezone</span>
      <span className="flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-1 ring-line/60">
        <Globe className="size-[18px] shrink-0 text-faint" />
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-full w-full bg-transparent text-[15px] outline-none">
          {options.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
              {z === detected ? ' (this device)' : ''}
            </option>
          ))}
        </select>
      </span>
      <span className="mt-1.5 block px-1 text-xs text-muted">Days and nights are counted in this timezone.</span>
    </label>
  )
}
