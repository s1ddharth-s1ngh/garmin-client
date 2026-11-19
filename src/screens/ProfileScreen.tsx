import { Check, ChevronRight, Lock, Medal, Paintbrush, Settings, Watch } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useActivities, useDays, useSleep, useToday, useUnits } from '../app/hooks'
import { useSession } from '../app/session'
import { useToast } from '../components/toast'
import { Avatar, Button, Card, Field, IconTile, SectionTitle, Sheet, Skeleton, TONE, cx, rise } from '../components/ui'
import { ACCENTS, AVATAR_COLORS, DEFAULT_ACCENT } from '../config/app'
import { BADGES } from '../config/badges'
import { repo } from '../data/repo'
import { personalRecords, type PersonalRecord } from '../domain/stats'
import { addDays, formatDayYear, formatMonth, timeAgo } from '../lib/dates'
import { formatNumber, hms, type UnitFormat } from '../lib/format'

export default function ProfileScreen() {
  const { profile, garmin } = useSession()
  const today = useToday()
  const u = useUnits()
  const acts = useActivities(addDays(today, -365), today)
  const days = useDays(addDays(today, -365), today)
  const sleep = useSleep(addDays(today, -365), today)
  const [editing, setEditing] = useState(false)
  const ready = acts.data && days.data && sleep.data
  const year = acts.data?.filter((a) => a.date >= `${today.slice(0, 4)}-01-01`) ?? []
  const oldestFirst = acts.data ? [...acts.data].reverse() : []
  const badgeData = ready ? { activities: oldestFirst, days: days.data!, sleep: sleep.data!, goals: profile.goals, tz: profile.timezone } : null
  const badges = badgeData ? BADGES.map((b) => ({ ...b, at: b.earned(badgeData) })) : null
  const earned = badges?.filter((b) => b.at) ?? []
  const records = ready ? personalRecords(acts.data!, days.data!) : null

  return (
    <div className="animate-fade-in">
      <div className="relative h-48 overflow-hidden rounded-b-[36px] bg-hero">
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-28 w-full opacity-15" aria-hidden>
          <path d="M0 120 L80 46 L130 82 L200 14 L262 76 L310 40 L400 100 L400 120 Z" fill="white" />
        </svg>
        <div className="safe-top absolute top-0 right-4 flex gap-2">
          <button type="button" aria-label="Customize profile" onClick={() => setEditing(true)} className={HERO_BTN}>
            <Paintbrush className="size-[18px]" />
          </button>
          <Link to="/settings" aria-label="Settings" className={HERO_BTN}>
            <Settings className="size-[19px]" />
          </Link>
        </div>
      </div>
      <div className="relative z-10 -mt-14 flex flex-col items-center px-5 text-center">
        <button type="button" aria-label="Customize profile" onClick={() => setEditing(true)} className="animate-pop rounded-full transition-transform active:scale-95">
          <Avatar name={profile.name} color={profile.avatar_color} size={100} ring />
        </button>
        <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em]">{profile.name}</h1>
        <p className="text-[13px] text-muted">
          Member since {formatMonth(profile.created_at.slice(0, 10))} · {profile.timezone.replace(/_/g, ' ')}
        </p>
        {garmin && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[12px] font-semibold text-muted ring-1 ring-line">
            <Watch className="size-3.5" /> {garmin.device} · synced {garmin.last_sync_at ? timeAgo(garmin.last_sync_at) : 'never'}
          </span>
        )}
      </div>

      <div className="px-4">
        <p className="mt-6 mb-2 px-1 text-[12px] font-semibold tracking-wide text-faint uppercase">{today.slice(0, 4)} so far</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Activities', value: ready ? formatNumber(year.length) : '–' },
            { label: 'Distance', value: ready ? `${formatNumber(u.toDist(year.reduce((s, a) => s + a.distance_m, 0)))} ${u.distUnit}` : '–' },
            { label: 'Time', value: ready ? `${Math.round(year.reduce((s, a) => s + a.duration_s, 0) / 3600)}h` : '–' },
          ].map((k, i) => (
            <Card key={k.label} style={rise(i)} className="animate-rise px-3 py-4 text-center">
              <p className="display text-[21px]">{k.value}</p>
              <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{k.label}</p>
            </Card>
          ))}
        </div>

        <SectionTitle>Personal records</SectionTitle>
        {!records ? (
          <Skeleton className="h-64" />
        ) : records.length === 0 ? (
          <Card className="p-4 text-[14px] text-muted">Records appear after your first activities.</Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {records.map((r, i) => (
              <RecordRow key={r.key} r={r} u={u} index={i} today={today} />
            ))}
          </Card>
        )}

        <SectionTitle action={badges && <span className="text-[13px] font-semibold text-muted tabular">{earned.length}/{BADGES.length}</span>}>Badges</SectionTitle>
        {!badges || !badgeData ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b, i) => {
              const prog = !b.at && b.progress ? b.progress(badgeData) : null
              return (
                <Card key={b.id} style={rise(i)} className={cx('flex animate-rise flex-col items-center p-3 text-center', !b.at && 'opacity-80')}>
                  <span className={cx('relative grid size-14 place-items-center rounded-2xl text-white', b.at ? TONE[b.tone].bg : 'bg-surface-2 text-faint')} title={b.description}>
                    <b.icon className="size-7" strokeWidth={2} />
                    {!b.at && (
                      <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-surface-3 text-ink-2 ring-2 ring-surface">
                        <Lock className="size-3" strokeWidth={2.5} />
                      </span>
                    )}
                  </span>
                  <p className={cx('mt-2 text-[13px] leading-tight font-bold', !b.at && 'text-muted')}>{b.name}</p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{b.at ? `Earned ${formatDayYear(b.at, today)}` : b.description}</p>
                  {prog && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full origin-left animate-grow-x rounded-full bg-brand/70" style={{ width: `${Math.min(100, (prog[0] / prog[1]) * 100)}%` }} />
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        <SectionTitle>More</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <Link to="/sleep" className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2/60">
            <span className="flex-1">
              <span className="block font-semibold">Sleep</span>
              <span className="block text-[13px] text-muted">Stages, score and trends</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
          <Link to="/settings" className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2/60">
            <span className="flex-1">
              <span className="block font-semibold">Settings</span>
              <span className="block text-[13px] text-muted">Garmin connection, units, goals, appearance</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
        </Card>
      </div>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Customize profile">
        <CustomizeFields />
      </Sheet>
    </div>
  )
}

// Dark glass so the buttons stay readable on any cover color.
const HERO_BTN = 'mt-3 grid size-10 place-items-center rounded-full bg-black/20 text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-black/30'

function RecordRow({ r, u, index, today }: { r: PersonalRecord; u: UnitFormat; index: number; today: string }) {
  const value = r.kind === 'time' || r.kind === 'duration' ? hms(r.value) : r.kind === 'distance' ? u.dist(r.value) : r.kind === 'elevation' ? u.elev(r.value) : formatNumber(r.value)
  const body = (
    <>
      <IconTile icon={Medal} tone={r.kind === 'steps' ? 'steps' : r.kind === 'elevation' ? 'train' : 'star'} size={38} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{r.label}</span>
        <span className="block text-[12px] text-muted">{formatDayYear(r.date, today)}</span>
      </span>
      <span className="text-[16px] font-extrabold tabular">{value}</span>
      {r.activityId && <ChevronRight className="size-4 text-faint" />}
    </>
  )
  const cls = 'flex animate-rise items-center gap-3 px-4 py-3 transition-colors'
  return r.activityId ? (
    <Link to={`/activities/${r.activityId}`} style={rise(index)} className={cx(cls, 'hover:bg-surface-2/60')}>
      {body}
    </Link>
  ) : (
    <div style={rise(index)} className={cls}>
      {body}
    </div>
  )
}

/** Name, avatar color and accent. Colors save right away so the app recolors live. */
export function CustomizeFields() {
  const { profile, refresh } = useSession()
  const toast = useToast()
  const [name, setName] = useState(profile.name)
  const [busy, setBusy] = useState(false)
  const save = async (input: Parameters<typeof repo.saveProfile>[0]) => {
    await repo.saveProfile(input)
    await refresh()
  }
  const accent = profile.cover_color ?? DEFAULT_ACCENT
  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Avatar name={name || '?'} color={profile.avatar_color} size={84} />
      </div>
      <div className="flex items-end gap-2">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Button
          loading={busy}
          disabled={!name.trim() || name.trim() === profile.name}
          onClick={async () => {
            setBusy(true)
            await save({ name: name.trim() })
            setBusy(false)
            toast('Name saved')
          }}
        >
          Save
        </Button>
      </div>
      <div>
        <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Avatar color</p>
        <div className="flex gap-3">
          {AVATAR_COLORS.map((c) => (
            <Swatch key={c} color={c} on={profile.avatar_color === c} onClick={() => void save({ avatar_color: c })} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 px-1 text-[13px] font-semibold text-ink-2">Accent color</p>
        <div className="flex gap-3">
          {ACCENTS.map((c) => (
            <Swatch key={c} color={c} on={accent === c} onClick={() => void save({ cover_color: c === DEFAULT_ACCENT ? null : c })} />
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-muted">Colors the header, buttons and the steps ring.</p>
      </div>
    </div>
  )
}

function Swatch({ color, on, onClick }: { color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Color ${color}`}
      aria-pressed={on}
      onClick={onClick}
      className={cx('grid size-10 place-items-center rounded-full text-white transition-transform active:scale-90', on && 'ring-[3px] ring-ink/80 ring-offset-2 ring-offset-bg')}
      style={{ background: color }}
    >
      {on && <Check className="size-5 animate-pop" strokeWidth={3} />}
    </button>
  )
}

