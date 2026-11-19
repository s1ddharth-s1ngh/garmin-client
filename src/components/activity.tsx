import { Link } from 'react-router'
import { useToday, useUnits } from '../app/hooks'
import { useSession } from '../app/session'
import { SPORTS } from '../config/sports'
import type { Activity } from '../domain/types'
import { relativeDay, timeIn } from '../lib/dates'
import { hms, type UnitFormat } from '../lib/format'
import { IconTile, cx, rise } from './ui'

/** Main speed figure of an activity: pace (per km/mi, or per 100 m for swims) or speed. */
export function activitySpeed(a: Pick<Activity, 'sport' | 'avg_speed'>, u: UnitFormat, mps = a.avg_speed): { value: string; unit: string } | null {
  const s = SPORTS[a.sport]
  if (s.metric === 'none' || mps <= 0) return null
  if (s.swim) return { value: hms(100 / mps), unit: '/100m' }
  if (s.metric === 'speed') return { value: u.speed(mps), unit: u.speedUnit }
  return { value: u.pace(mps), unit: u.paceUnit }
}

/** One activity in a list: icon, name, when, and its main numbers. */
export function ActivityRow({ a, index = 0, className }: { a: Activity; index?: number; className?: string }) {
  const u = useUnits()
  const today = useToday()
  const { profile } = useSession()
  const s = SPORTS[a.sport]
  const speed = activitySpeed(a, u)
  return (
    <Link
      to={`/activities/${a.id}`}
      style={rise(index)}
      className={cx('group flex animate-rise items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60 active:bg-surface-2', className)}
    >
      <IconTile icon={s.icon} tone={s.tone} size={44} className="transition-transform group-hover:scale-105" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{a.name}</span>
        <span className="block truncate text-[13px] text-muted">
          {relativeDay(a.date, today)} · {timeIn(a.start, profile.timezone)} · {hms(a.duration_s)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-bold tabular">{a.distance_m ? u.dist(a.distance_m) : hms(a.duration_s)}</span>
        <span className="block text-[12px] font-medium text-muted tabular">{speed ? `${speed.value} ${speed.unit}` : `${a.avg_hr} bpm`}</span>
      </span>
    </Link>
  )
}
