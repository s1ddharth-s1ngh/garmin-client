import { Clock, Dumbbell, Flame, Gauge, HeartPulse, Mountain, Route, Timer, Watch, Zap, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { useActivity, useMaxHr, useUnits } from '../app/hooks'
import { useSession } from '../app/session'
import { activitySpeed } from '../components/activity'
import { LineChart, RouteMap, ZoneBars } from '../components/charts'
import { BackButton, Card, Chip, EmptyState, IconTile, SectionTitle, Segmented, Skeleton, TONE, cx, rise } from '../components/ui'
import { SPORTS } from '../config/sports'
import { trainingEffectLabel } from '../domain/training'
import type { ActivityDetail } from '../domain/types'
import { formatDay, timeIn } from '../lib/dates'
import { formatNumber, hms, type UnitFormat } from '../lib/format'

export default function ActivityScreen() {
  const { id = '' } = useParams()
  const { data, loading } = useActivity(id)
  if (loading)
    return (
      <div className="mx-auto max-w-md space-y-3 p-4 pt-16">
        <Skeleton className="h-60" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  if (!data)
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="safe-top">
          <BackButton fallback="/activities" />
        </div>
        <EmptyState title="Activity not found" text="It may have been deleted on Garmin Connect, or it is older than your synced history." />
      </div>
    )
  return <Detail a={data} />
}

function Detail({ a }: { a: ActivityDetail }) {
  const { profile } = useSession()
  const u = useUnits()
  const maxHr = useMaxHr()
  const s = SPORTS[a.sport]
  const speed = activitySpeed(a, u)
  const stats: { icon: LucideIcon; label: string; value: ReactNode }[] = [
    ...(a.distance_m ? [{ icon: Route, label: 'Distance', value: u.dist(a.distance_m) }] : []),
    { icon: Timer, label: 'Time', value: hms(a.duration_s) },
    ...(speed ? [{ icon: Gauge, label: s.metric === 'speed' ? 'Avg speed' : 'Avg pace', value: `${speed.value} ${speed.unit}` }] : []),
    { icon: HeartPulse, label: 'Avg HR', value: `${a.avg_hr} bpm` },
    { icon: Flame, label: 'Calories', value: `${formatNumber(a.kcal)} kcal` },
    ...(a.elevation_gain_m ? [{ icon: Mountain, label: 'Elevation', value: u.elev(a.elevation_gain_m) }] : []),
    { icon: Clock, label: 'Moving time', value: hms(a.moving_s) },
    { icon: HeartPulse, label: 'Max HR', value: `${a.max_hr} bpm` },
    ...(a.avg_cadence ? [{ icon: Zap, label: 'Cadence', value: `${a.avg_cadence} ${s.metric === 'speed' ? 'rpm' : 'spm'}` }] : []),
  ].slice(0, 9)

  return (
    <div className="mx-auto min-h-dvh max-w-md animate-fade-in pb-10">
      {/* Header band in the sport color. */}
      <div className={cx('relative overflow-hidden rounded-b-[36px] px-5 pb-6 text-white', TONE[s.tone].bg)}>
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full opacity-15" aria-hidden>
          <path d="M0 120 L60 70 L110 96 L180 30 L240 84 L300 50 L400 104 L400 120 Z" fill="white" />
        </svg>
        <div className="safe-top relative flex items-center justify-between pt-3">
          <span className="[&>button]:bg-white/15 [&>button]:text-white [&>button]:ring-white/25 [&>button:hover]:bg-white/25">
            <BackButton fallback="/activities" />
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold ring-1 ring-white/20">
            <s.icon className="size-4" /> {s.label}
          </span>
        </div>
        <div className="relative mt-5 animate-pop">
          <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em]">{a.name}</h1>
          <p className="mt-1 text-[14px] text-white/80">
            {formatDay(a.date)} · {timeIn(a.start, profile.timezone)} – {timeIn(new Date(new Date(a.start).getTime() + a.duration_s * 1000), profile.timezone)}
          </p>
          {a.distance_m > 0 && (
            <p className="display mt-4 text-[56px]">
              {u.distNum(a.distance_m)}
              <span className="ml-1.5 text-xl font-bold tracking-normal text-white/75">{a.sport === 'swimming' ? '' : u.distUnit}</span>
            </p>
          )}
        </div>
      </div>

      <div className="px-4">
        {a.route ? (
          <div className="mt-4 animate-rise">
            <RouteMap route={a.route} tone={s.tone} />
          </div>
        ) : (
          <Card className="mt-4 flex animate-rise items-center gap-4 p-4">
            <IconTile icon={s.icon} tone={s.tone} size={52} />
            <p className="text-[14px] text-muted">{a.sport === 'swimming' ? 'Pool swim: no GPS track.' : 'Indoor activity: no GPS track.'}</p>
          </Card>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {stats.map((st, i) => (
            <Card key={st.label} style={rise(i)} className="animate-rise px-3 py-3">
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
                <st.icon className="size-3.5" /> {st.label}
              </span>
              <span className="mt-1 block text-[15px] leading-tight font-bold tabular">{st.value}</span>
            </Card>
          ))}
        </div>

        <SectionTitle>Training effect</SectionTitle>
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <TeBar label="Aerobic" value={a.aerobic_te} tone="train" />
            <TeBar label="Anaerobic" value={a.anaerobic_te} tone="sleep" />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[18px] bg-surface-2/70 px-4 py-3">
            <span className="text-[13px] font-medium text-muted">Training load</span>
            <span className="text-lg font-extrabold tabular">{a.load}</span>
          </div>
        </Card>

        {a.samples.length > 1 && <Charts a={a} u={u} />}

        <SectionTitle>Heart rate zones</SectionTitle>
        <Card className="p-5">
          <ZoneBars zones={a.zones} maxHr={maxHr} />
        </Card>

        {a.laps.length > 1 && <Laps a={a} u={u} />}
        {a.sets && <Sets a={a} u={u} />}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-[12px] font-medium text-faint">
          <Watch className="size-3.5" /> Recorded with {a.device}
        </p>
      </div>
    </div>
  )
}

function TeBar({ label, value, tone }: { label: string; value: number; tone: 'train' | 'sleep' }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-muted">{label}</p>
      <p className="display mt-1 text-[30px]">{value.toFixed(1)}</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className={cx('block h-full origin-left animate-grow-x rounded-full', TONE[tone].bg)}
              style={{ width: `${Math.max(0, Math.min(1, value - (n - 1))) * 100}%`, animationDelay: `${n * 90}ms` }}
            />
          </span>
        ))}
      </div>
      <p className={cx('mt-2 text-[12px] font-bold', TONE[tone].text)}>{trainingEffectLabel(value)}</p>
    </div>
  )
}

type ChartKind = 'hr' | 'speed' | 'elevation' | 'cadence'

function Charts({ a, u }: { a: ActivityDetail; u: UnitFormat }) {
  const s = SPORTS[a.sport]
  const options: { value: ChartKind; label: string }[] = [
    { value: 'hr', label: 'Heart' },
    ...(s.metric !== 'none' ? [{ value: 'speed' as const, label: s.metric === 'speed' ? 'Speed' : 'Pace' }] : []),
    ...(a.elevation_gain_m > 0 ? [{ value: 'elevation' as const, label: 'Elevation' }] : []),
    ...(a.avg_cadence ? [{ value: 'cadence' as const, label: 'Cadence' }] : []),
  ]
  const [kind, setKind] = useState<ChartKind>('hr')
  const n = a.samples.length
  const labels = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const i = Math.round(p * (n - 1))
    return { i, text: hms(a.samples[i].t) }
  })
  const tip = (i: number) => hms(a.samples[i].t)
  // Pace in seconds per km/mi or per 100 m; plotted inverted so faster is higher.
  const paceOf = (mps: number) => (s.swim ? 100 / mps : (u.units === 'imperial' ? 1609.344 : 1000) / mps)
  const chart = {
    hr: <LineChart values={a.samples.map((x) => x.hr)} labels={labels} tip={tip} tone="heart" format={(v) => `${Math.round(v)} bpm`} />,
    speed:
      s.metric === 'speed' ? (
        <LineChart values={a.samples.map((x) => x.speed * 3.6 * (u.units === 'imperial' ? 0.621371 : 1))} labels={labels} tip={tip} tone="battery" format={(v) => `${v.toFixed(1)} ${u.speedUnit}`} />
      ) : (
        <LineChart
          values={a.samples.map((x) => (x.speed > 0.4 ? paceOf(x.speed) : null))}
          labels={labels}
          tip={tip}
          tone={s.tone}
          invert
          area={false}
          format={(v) => `${hms(v)}${s.swim ? '/100m' : u.paceUnit}`}
        />
      ),
    elevation: <LineChart values={a.samples.map((x) => u.elevNum(x.elevation))} labels={labels} tip={tip} tone="train" format={(v) => `${Math.round(v)} ${u.elevUnit}`} />,
    cadence: <LineChart values={a.samples.map((x) => x.cadence)} labels={labels} tip={tip} tone="star" area={false} format={(v) => `${Math.round(v)}`} />,
  }
  return (
    <>
      <SectionTitle>Charts</SectionTitle>
      <Card className="p-4">
        {options.length > 1 && <Segmented size="sm" value={kind} onChange={setKind} options={options} className="mb-6" />}
        <div key={kind} className="pt-2">
          {chart[kind]}
        </div>
      </Card>
    </>
  )
}

function Laps({ a, u }: { a: ActivityDetail; u: UnitFormat }) {
  const s = SPORTS[a.sport]
  const speeds = a.laps.map((l) => l.distance_m / Math.max(1, l.duration_s))
  // Partial last lap shouldn't win "fastest".
  const full = a.laps.map((l, i) => (i < a.laps.length - 1 || l.distance_m >= a.laps[0].distance_m * 0.9 ? speeds[i] : 0))
  const best = full.indexOf(Math.max(...full))
  const top = Math.max(...speeds)
  return (
    <>
      <SectionTitle action={<span className="text-[13px] font-semibold text-muted">{a.laps.length} laps</span>}>Splits</SectionTitle>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_4.5rem_3rem_3rem] gap-2 border-b border-line px-4 py-2.5 text-[11px] font-bold tracking-wide text-faint uppercase">
          <span>#</span>
          <span>{s.metric === 'speed' ? 'Speed' : 'Pace'}</span>
          <span className="text-right">Time</span>
          <span className="text-right">HR</span>
          <span className="text-right">{u.elevUnit}</span>
        </div>
        {a.laps.map((l, i) => {
          const v = activitySpeed(a, u, speeds[i])
          return (
            <div key={i} style={rise(Math.min(i, 12))} className={cx('grid animate-rise grid-cols-[2rem_1fr_4.5rem_3rem_3rem] items-center gap-2 px-4 py-2 text-[13px] tabular', i === best && 'bg-train-soft/60')}>
              <span className="font-bold text-muted">{i + 1}</span>
              <span className="flex items-center gap-2">
                <span className="w-[3.4rem] shrink-0 font-bold">{v?.value}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className={cx('block h-full origin-left animate-grow-x rounded-full', i === best ? 'bg-train' : TONE[s.tone].bg)} style={{ width: `${(speeds[i] / top) * 100}%`, opacity: i === best ? 1 : 0.6 }} />
                </span>
              </span>
              <span className="text-right font-medium">{hms(l.duration_s)}</span>
              <span className="text-right font-medium">{l.avg_hr}</span>
              <span className="text-right font-medium text-muted">{Math.round(u.elevNum(l.elevation_gain_m))}</span>
            </div>
          )
        })}
      </Card>
    </>
  )
}

function Sets({ a, u }: { a: ActivityDetail; u: UnitFormat }) {
  const byExercise = new Map<string, NonNullable<ActivityDetail['sets']>>()
  for (const s of a.sets ?? []) byExercise.set(s.exercise, [...(byExercise.get(s.exercise) ?? []), s])
  const volume = (a.sets ?? []).reduce((t, s) => t + s.reps * s.weight_kg, 0)
  return (
    <>
      <SectionTitle action={<Chip tone="stress">{formatNumber(u.weightNum(volume))} {u.weightUnit} volume</Chip>}>Sets</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        {[...byExercise.entries()].map(([name, sets], i) => (
          <div key={name} style={rise(i)} className="flex animate-rise items-center gap-3 p-4">
            <IconTile icon={Dumbbell} tone="stress" size={38} />
            <span className="min-w-0 flex-1 font-semibold">{name}</span>
            <span className="flex gap-1.5">
              {sets.map((s, j) => (
                <span key={j} className="rounded-[10px] bg-surface-2 px-2 py-1 text-center text-[11px] leading-tight font-bold tabular">
                  {s.reps}×
                  <span className="block font-semibold text-muted">
                    {Math.round(u.weightNum(s.weight_kg))}
                    {u.weightUnit}
                  </span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </Card>
    </>
  )
}
