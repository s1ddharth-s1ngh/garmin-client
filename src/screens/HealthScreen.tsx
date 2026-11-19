import { ChevronRight, MoonStar, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useDays, useSleep, useToday, useUnits, useWeights } from '../app/hooks'
import { Sparkline } from '../components/charts'
import { Card, Delta, PageHeader, SectionTitle, Skeleton, TONE, cx, rise } from '../components/ui'
import { METRICS, seriesFor, type MetricKey } from '../config/metrics'
import { avg, change } from '../domain/stats'
import type { DailySummary, SleepNight, WeightEntry } from '../domain/types'
import { addDays, eachDay } from '../lib/dates'
import WeightSheet from './sheets/WeightSheet'

const SECTIONS: { title: string; keys: MetricKey[] }[] = [
  { title: 'Recovery', keys: ['resting_hr', 'hrv', 'body_battery', 'stress'] },
  { title: 'Sleep', keys: ['sleep_score', 'sleep_time'] },
  { title: 'Body', keys: ['weight', 'vo2max', 'spo2', 'respiration'] },
  { title: 'Activity', keys: ['steps', 'intensity', 'calories', 'floors'] },
]

const SNAPSHOT: MetricKey[] = ['resting_hr', 'hrv', 'respiration', 'spo2', 'stress']

interface Data {
  days: DailySummary[]
  sleep: SleepNight[]
  weights: WeightEntry[]
}

export default function HealthScreen() {
  const today = useToday()
  const days = useDays(addDays(today, -27), today)
  const sleep = useSleep(addDays(today, -13), today)
  const weights = useWeights(addDays(today, -59), today)
  const [logging, setLogging] = useState(false)
  const data: Data | null = days.data && sleep.data && weights.data ? { days: days.data, sleep: sleep.data, weights: weights.data } : null

  return (
    <div className="animate-fade-in">
      <PageHeader subtitle="Your body, from Garmin" title="Health" />
      <div className="px-4">
        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-[280px]" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[140px]" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <Snapshot data={data} today={today} />
            {SECTIONS.map((s) => (
              <section key={s.title}>
                <SectionTitle
                  action={
                    s.title === 'Body' ? (
                      <button
                        type="button"
                        onClick={() => setLogging(true)}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-3"
                      >
                        <Plus className="size-4" strokeWidth={2.6} /> Weight
                      </button>
                    ) : s.title === 'Sleep' ? (
                      <Link to="/sleep" className="inline-flex h-8 items-center gap-1 rounded-full bg-sleep-soft pr-2 pl-3 text-[13px] font-bold text-sleep-strong">
                        <MoonStar className="size-4" /> Last night <ChevronRight className="size-4" />
                      </Link>
                    ) : undefined
                  }
                >
                  {s.title}
                </SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  {s.keys.map((k, i) => (
                    <MetricTile key={k} metric={k} data={data} today={today} index={i} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
      <WeightSheet open={logging} onClose={() => setLogging(false)} />
    </div>
  )
}

function MetricTile({ metric, data, today, index }: { metric: MetricKey; data: Data; today: string; index: number }) {
  const u = useUnits()
  const m = METRICS[metric]
  // Weight is sparse: look further back.
  const span = metric === 'weight' ? 60 : 14
  const dates = eachDay(addDays(today, -(span - 1)), today)
  const values = seriesFor(metric, dates, data)
  const last = values.findLast((v) => v != null) ?? null
  const half = Math.floor(span / 2)
  const delta = change(avg(values.slice(half)), avg(values.slice(0, half)))
  return (
    <Card to={`/health/${metric}`} style={rise(index)} className="flex animate-rise flex-col p-4">
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-muted">
          <m.icon className={cx('size-4 shrink-0', TONE[m.tone].text)} /> <span className="truncate">{m.label}</span>
        </span>
      </span>
      <p className="display mt-2.5 text-[26px]">
        {last != null ? m.format(last, u) : '–'}
        {m.unit && last != null && <span className="ml-1 text-[12px] font-semibold tracking-normal text-muted">{m.unit}</span>}
      </p>
      <div className="mt-1 min-h-5">{m.level && last != null ? <span className={cx('text-[12px] font-bold', TONE[m.tone].text)}>{m.level(last)}</span> : <Delta value={delta} better={m.better} />}</div>
      <div className="mt-2">
        <Sparkline values={values} tone={m.tone} height={30} />
      </div>
    </Card>
  )
}

/** Today's vitals against the personal normal range of the last 4 weeks (mean ± 1.5 SD). */
function Snapshot({ data, today }: { data: Data; today: string }) {
  const u = useUnits()
  const dates = eachDay(addDays(today, -27), today)
  const rows = SNAPSHOT.map((k) => {
    const values = seriesFor(k, dates, data)
    const now = values.at(-1) ?? null
    const past = values.slice(0, -1).filter((v): v is number => v != null)
    const mean = past.reduce((a, b) => a + b, 0) / (past.length || 1)
    const sd = Math.sqrt(past.reduce((a, b) => a + (b - mean) ** 2, 0) / (past.length || 1)) || 1
    const lo = mean - 1.5 * sd
    const hi = mean + 1.5 * sd
    const pad = (hi - lo) * 0.6
    const pos = now == null ? null : Math.max(0, Math.min(1, (now - (lo - pad)) / (hi - lo + 2 * pad)))
    const status: 'in' | 'above' | 'below' | null = now == null ? null : now > hi ? 'above' : now < lo ? 'below' : 'in'
    return { k, now, lo, hi, pad, pos, status }
  })
  const inRange = rows.filter((r) => r.status === 'in').length
  const known = rows.filter((r) => r.status).length
  return (
    <Card className="animate-rise p-5">
      <div className="flex items-center gap-3">
        <span className={cx('grid size-11 place-items-center rounded-[14px] text-white', inRange === known ? 'bg-train' : 'bg-star')}>
          <ShieldCheck className="size-6" />
        </span>
        <div>
          <p className="text-[17px] font-bold tracking-tight">Health snapshot</p>
          <p className="text-[13px] text-muted">
            {inRange} of {known} vitals in your normal range today
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {rows.map((r, i) => {
          const m = METRICS[r.k]
          return (
            <Link key={r.k} to={`/health/${r.k}`} className="group block" style={rise(i)}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold">
                  <m.icon className={cx('size-4', TONE[m.tone].text)} /> {m.label}
                </span>
                <span className="font-bold tabular">
                  {r.now != null ? `${m.format(r.now, u)} ${m.unit}` : '–'}
                  {r.status && r.status !== 'in' && <span className="ml-1.5 text-stress-strong">{r.status === 'above' ? '↑ high' : '↓ low'}</span>}
                </span>
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-surface-2">
                <span className="absolute inset-y-0 rounded-full bg-train/25" style={{ left: `${(r.pad / (r.hi - r.lo + 2 * r.pad)) * 100}%`, right: `${(r.pad / (r.hi - r.lo + 2 * r.pad)) * 100}%` }} />
                {r.pos != null && (
                  <span
                    className={cx('absolute top-1/2 size-4 -translate-1/2 animate-pop rounded-full ring-[3px] ring-surface', r.status === 'in' ? 'bg-train' : 'bg-stress')}
                    style={{ left: `${r.pos * 100}%`, animationDelay: `${200 + i * 80}ms` }}
                  />
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
