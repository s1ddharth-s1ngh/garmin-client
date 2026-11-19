import { Info, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { useDays, useSleep, useToday, useUnits, useWeights } from '../app/hooks'
import { useSession } from '../app/session'
import { BarChart, LineChart } from '../components/charts'
import { useToast } from '../components/toast'
import { AnimatedNumber, Button, Card, Chip, Delta, IconTile, PageHeader, SectionTitle, Segmented, Skeleton, TONE, cx, rise } from '../components/ui'
import { METRICS, seriesFor, type MetricDef, type MetricKey } from '../config/metrics'
import { repo } from '../data/repo'
import { avg, change } from '../domain/stats'
import type { WeightEntry } from '../domain/types'
import { addDays, eachDay, formatDay, formatDayShort, formatDayYear, formatMonthShort, formatWeekdayShort, startOfMonth, startOfWeek, type ISODate } from '../lib/dates'
import type { UnitFormat } from '../lib/format'
import WeightSheet from './sheets/WeightSheet'

type Period = '7d' | '4w' | '3m' | '1y'
const DAYS: Record<Period, number> = { '7d': 7, '4w': 28, '3m': 91, '1y': 364 }

interface Point {
  key: string
  label: string
  tip: string
  value: number | null
}

/** Daily points, or weekly/monthly averages for long periods so charts stay readable. */
function bucket(dates: ISODate[], values: (number | null)[], by: 'day' | 'week' | 'month'): Point[] {
  if (by === 'day') return dates.map((d, i) => ({ key: d, label: dates.length <= 7 ? formatWeekdayShort(d) : String(Number(d.slice(8))), tip: formatDayShort(d), value: values[i] }))
  const groups = new Map<string, (number | null)[]>()
  dates.forEach((d, i) => {
    const k = by === 'week' ? startOfWeek(d) : startOfMonth(d)
    groups.set(k, [...(groups.get(k) ?? []), values[i]])
  })
  return [...groups.entries()].map(([k, vs]) => ({
    key: k,
    label: by === 'week' ? formatDayShort(k) : formatMonthShort(k).split(' ')[0],
    tip: by === 'week' ? `week of ${formatDayShort(k)}` : formatMonthShort(k),
    value: avg(vs),
  }))
}

export default function MetricScreen() {
  const { metric = '' } = useParams()
  if (!(metric in METRICS)) return <Navigate to="/health" replace />
  return <Metric key={metric} m={METRICS[metric as MetricKey]} />
}

function Metric({ m }: { m: MetricDef }) {
  const { profile } = useSession()
  const today = useToday()
  const u = useUnits()
  const [period, setPeriod] = useState<Period>('4w')
  const [logging, setLogging] = useState(false)
  const n = DAYS[period]
  const from = addDays(today, -(n - 1))
  const prevFrom = addDays(from, -n)
  const days = useDays(prevFrom, today)
  const sleep = useSleep(prevFrom, today)
  const weights = useWeights(prevFrom, today)
  const ready = days.data && sleep.data && weights.data

  const dates = eachDay(from, today)
  const data = { days: days.data, sleep: sleep.data, weights: weights.data }
  const values = ready ? seriesFor(m.key, dates, data) : []
  const prev = ready ? seriesFor(m.key, eachDay(prevFrom, addDays(from, -1)), data) : []
  const known = values.filter((v): v is number => v != null)
  const mean = avg(values)
  const latestI = values.findLastIndex((v) => v != null)
  const by = period === '1y' ? (m.chart === 'bar' ? 'month' : 'week') : period === '3m' && m.chart === 'bar' ? 'week' : 'day'
  const points = bucket(dates, values, by)
  const goal = m.key === 'steps' ? profile.goals.steps : m.key === 'sleep_time' ? profile.goals.sleep_min : m.key === 'floors' ? profile.goals.floors : undefined
  const band: [number, number] | undefined =
    (m.key === 'hrv' || m.key === 'resting_hr') && known.length > 4
      ? (() => {
          const sd = Math.sqrt(known.reduce((a, b) => a + (b - mean!) ** 2, 0) / known.length)
          return [mean! - sd, mean! + sd]
        })()
      : undefined
  const fmt = (v: number) => `${m.format(v, u)}${m.unit && m.key !== 'weight' ? ` ${m.unit}` : ''}`

  return (
    <div className="animate-fade-in">
      <PageHeader back="/health" subtitle="Health" title={m.label} actions={<IconTile icon={m.icon} tone={m.tone} size={42} />} />
      <div className="px-4">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: '7d', label: '7D' },
            { value: '4w', label: '4W' },
            { value: '3m', label: '3M' },
            { value: '1y', label: '1Y' },
          ]}
        />
        {!ready ? (
          <Skeleton className="mt-4 h-[340px]" />
        ) : (
          <Card key={period} className="mt-4 animate-rise p-5">
            <p className="text-[12px] font-semibold tracking-wide text-faint uppercase">{by === 'day' ? 'Average' : `Average per day`}</p>
            <div className="mt-1.5 flex items-end gap-3">
              <p className="display text-[40px]">{mean != null ? <AnimatedNumber value={mean} format={(v) => m.format(v, u)} /> : '–'}</p>
              {m.unit && m.key !== 'weight' && <span className="mb-1 text-[14px] font-semibold text-muted">{m.unit}</span>}
              <Delta value={change(mean, avg(prev))} better={m.better} className="mb-1.5" />
            </div>
            {m.level && mean != null && <Chip tone={m.tone} className="mt-2">{m.level(mean)}</Chip>}
            <div className="mt-7">
              {m.chart === 'bar' ? (
                <BarChart
                  tone={m.tone}
                  format={fmt}
                  goal={goal}
                  goalLabel={goal ? `Goal ${m.format(goal, u)}` : undefined}
                  bars={points.map((p, i) => ({
                    key: p.key,
                    // Up to 14 bars show every label; 8–14 wide labels would collide, so every other one.
                    label: points.length > 7 && points.length <= 14 && i % 2 ? '' : p.label,
                    value: p.value,
                    active: i === points.length - 1,
                    level: goal && p.value != null ? (p.value >= goal ? 'good' : p.value >= goal * 0.7 ? 'ok' : 'low') : 'good',
                  }))}
                />
              ) : (
                <LineChart
                  tone={m.tone}
                  pulse
                  band={band}
                  format={fmt}
                  values={points.map((p) => p.value)}
                  tip={(i) => points[i].tip}
                  labels={[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => ({ i, text: points[i].tip.replace('week of ', '') }))}
                />
              )}
            </div>
            {band && <p className="mt-3 text-[12px] text-muted">Shaded: your normal range for this period.</p>}
          </Card>
        )}

        {ready && known.length > 0 && <Stats m={m} u={u} dates={dates} values={values} latestI={latestI} today={today} />}

        {m.key === 'weight' && weights.data && <WeighIns weights={weights.data.filter((w) => w.date >= from)} u={u} onAdd={() => setLogging(true)} />}

        <SectionTitle>About</SectionTitle>
        <Card className="flex gap-3 p-4">
          <Info className={cx('mt-0.5 size-5 shrink-0', TONE[m.tone].text)} />
          <p className="text-[14px] leading-relaxed text-ink-2">{m.about}</p>
        </Card>
      </div>
      <WeightSheet open={logging} onClose={() => setLogging(false)} />
    </div>
  )
}

function Stats({ m, u, dates, values, latestI, today }: { m: MetricDef; u: UnitFormat; dates: ISODate[]; values: (number | null)[]; latestI: number; today: ISODate }) {
  let lo = -1
  let hi = -1
  values.forEach((v, i) => {
    if (v == null) return
    if (lo < 0 || v < values[lo]!) lo = i
    if (hi < 0 || v > values[hi]!) hi = i
  })
  const items = [
    { label: 'Latest', i: latestI },
    { label: 'Lowest', i: lo },
    { label: 'Highest', i: hi },
  ]
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map((it, k) => (
        <Card key={it.label} style={rise(k)} className="animate-rise px-3 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{it.label}</p>
          <p className="mt-1 text-[17px] leading-tight font-extrabold tabular">{m.format(values[it.i]!, u)}</p>
          <p className="mt-0.5 text-[11px] text-faint">{formatDayYear(dates[it.i], today)}</p>
        </Card>
      ))}
    </div>
  )
}

function WeighIns({ weights, u, onAdd }: { weights: WeightEntry[]; u: UnitFormat; onAdd: () => void }) {
  const toast = useToast()
  const list = [...weights].reverse().slice(0, 20)
  return (
    <>
      <SectionTitle action={<Button icon={Plus} onClick={onAdd} className="h-8 px-3 text-[13px]">Log</Button>}>Weigh-ins</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        {list.length === 0 && <p className="p-4 text-[14px] text-muted">No weigh-ins in this period.</p>}
        {list.map((w, i) => (
          <div key={w.date} style={rise(Math.min(i, 8))} className="flex animate-rise items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{formatDay(w.date)}</span>
              <span className="block text-[12px] text-muted">{w.source === 'manual' ? 'Added by you' : `Garmin scale${w.body_fat ? ` · ${w.body_fat}% body fat` : ''}`}</span>
            </span>
            <span className="font-bold tabular">{u.weight(w.kg)}</span>
            <button
              type="button"
              aria-label={`Delete weigh-in of ${formatDay(w.date)}`}
              onClick={() => void repo.deleteWeight(w.date).then(() => toast('Weigh-in deleted'))}
              className="p-1 text-faint transition-colors hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </Card>
    </>
  )
}
