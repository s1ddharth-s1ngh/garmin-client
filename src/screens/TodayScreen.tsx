import { Activity as ActivityIcon, BatteryCharging, Brain, ChevronRight, Flame, Footprints, Gauge as GaugeIcon, HeartPulse, MoonStar, Sunrise, Timer, TrendingUp, Watch, Zap, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useActivities, useDays, useIntraday, useSleep, useToday, useUnits } from '../app/hooks'
import { useSession } from '../app/session'
import { ActivityRow } from '../components/activity'
import { Gauge, IntradayChart, Ring, SplitBar, STAGES, stressColor } from '../components/charts'
import { AnimatedNumber, Avatar, Card, Chip, Delta, EmptyState, PageHeader, Progress, SectionTitle, SeeAll, Segmented, Skeleton, TONE, cx, rise, type Tone } from '../components/ui'
import { avg, batteryLevel, change, HRV_LABEL, readinessLevel, sleepQuality, stressLevel } from '../domain/stats'
import { intensityMinutes, loadSeries, recoveryHours, STATUS_INFO, trainingStatus, trend } from '../domain/training'
import type { Activity, DailySummary, Intraday, SleepNight } from '../domain/types'
import { addDays, formatWeekdayLetter, minutesOfDayIn, startOfWeek, timeAgo, timeIn, type ISODate } from '../lib/dates'
import { compact, duration, formatNumber, greeting } from '../lib/format'

export default function TodayScreen() {
  const { profile, garmin } = useSession()
  const today = useToday()
  const days = useDays(addDays(today, -13), today)
  const sleep = useSleep(addDays(today, -6), today)
  const acts = useActivities(addDays(today, -34), today)
  const intra = useIntraday(today)
  const day = days.data?.find((d) => d.date === today)
  const night = sleep.data?.find((n) => n.date === today) ?? null

  const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'short', timeZone: profile.timezone }).format(new Date())

  return (
    <div className="animate-fade-in">
      <PageHeader
        subtitle={longDate}
        title={`${greeting(Math.floor(minutesOfDayIn(new Date(), profile.timezone) / 60))} ${profile.name.split(' ')[0]}`}
        actions={
          <Link to="/profile" aria-label="Profile" className="transition-transform active:scale-90">
            <Avatar name={profile.name} color={profile.avatar_color} size={42} />
          </Link>
        }
      />
      {garmin && (
        <Link to="/settings" className="mx-5 -mt-2 mb-4 inline-flex items-center gap-2 rounded-full bg-surface-2 py-1.5 pr-3.5 pl-2.5 text-[12px] font-semibold text-muted ring-1 ring-line">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-train/60" />
            <span className="relative size-2 rounded-full bg-train" />
          </span>
          <Watch className="size-3.5" /> {garmin.device} · synced {garmin.last_sync_at ? timeAgo(garmin.last_sync_at) : 'never'}
        </Link>
      )}

      <div className="px-4 [&>*]:animate-rise">
        {!day || !intra.data || !acts.data ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <Slides labels={['Steps', 'Body Battery', 'Sleep', 'Readiness']}>
            <StepsHero day={day} />
            <BatteryHero day={day} intra={intra.data} />
            <SleepHero night={night} />
            <ReadinessHero day={day} days={days.data!} acts={acts.data} />
          </Slides>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {days.data && day ? <QuickTiles day={day} days={days.data} today={today} /> : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>

        <SectionTitle>Today's timeline</SectionTitle>
        {intra.data ? <Timeline intra={intra.data} day={day} /> : <Skeleton className="h-[230px]" />}

        <SectionTitle action={<span className="text-[13px] font-semibold text-muted tabular">{day ? `${compact(day.steps)} today` : ''}</span>}>Steps this week</SectionTitle>
        {days.data ? <WeekSteps days={days.data} today={today} goal={profile.goals.steps} /> : <Skeleton className="h-[200px]" />}

        <SectionTitle action={<SeeAll to="/activities" />}>Recent activities</SectionTitle>
        {!acts.data ? (
          <Skeleton className="h-[220px]" />
        ) : acts.data.length === 0 ? (
          <Card>
            <EmptyState icon={ActivityIcon} title="No activities yet" text="Record an activity on your watch and sync: it shows up here." />
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {acts.data.slice(0, 3).map((a, i) => (
              <ActivityRow key={a.id} a={a} index={i} />
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}

/** Horizontally swipeable cards with dots. Each child is one full-width slide. */
function Slides({ labels, children }: { labels: string[]; children: ReactNode[] }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4"
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {children.map((c, i) => (
          <div key={labels[i]} className="w-full shrink-0 snap-start" aria-roledescription="slide" aria-label={labels[i]}>
            {c}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
        {labels.map((l, i) => (
          <span key={l} className={cx('h-1.5 rounded-full transition-all', i === active ? 'w-4 bg-ink-2' : 'w-1.5 bg-surface-3')} />
        ))}
      </div>
    </div>
  )
}

function HeroCard({ chip, right, children, footer }: { chip: ReactNode; right?: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <Card className="relative flex h-full flex-col overflow-hidden p-5">
      <div className="flex items-center justify-between gap-2">
        {chip}
        {right}
      </div>
      {children}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">{footer}</div>
    </Card>
  )
}

function DetailsLink({ to, tone = 'brand' }: { to: string; tone?: Tone }) {
  return (
    <Link
      to={to}
      className={cx('inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110', TONE[tone].bg)}
    >
      Details <ChevronRight className="size-4" />
    </Link>
  )
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="rounded-[18px] bg-surface-2/70 px-3 py-2.5">
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="mt-1 block text-[15px] leading-none font-bold tabular">{value}</span>
    </div>
  )
}

function StepsHero({ day }: { day: DailySummary }) {
  const { profile } = useSession()
  const u = useUnits()
  const goal = profile.goals.steps
  const left = goal - day.steps
  return (
    <HeroCard
      chip={
        <Chip tone="steps" className="py-1 text-xs">
          <Footprints className="size-3.5" /> Steps today
        </Chip>
      }
      right={<span className="text-xs font-semibold text-faint">Goal {formatNumber(goal)}</span>}
      footer={
        <>
          <p className="text-[13px] text-muted">{left > 0 ? <><b className="text-ink tabular">{formatNumber(left)}</b> steps to your goal</> : <b className="text-steps-strong">Goal reached. Keep moving!</b>}</p>
          <DetailsLink to="/health/steps" tone="steps" />
        </>
      }
    >
      <div className="mt-3 flex justify-center">
        <Ring value={day.steps / goal} size={200} stroke={19} color="var(--steps)">
          <div>
            <div className="display text-[44px]">
              <AnimatedNumber value={day.steps} format={formatNumber} />
            </div>
            <div className="mt-2 text-[13px] font-medium text-muted">steps</div>
            <div className="mx-auto mt-2 w-fit rounded-full bg-steps-soft px-2.5 py-0.5 text-xs font-bold text-steps-strong tabular">{Math.round((day.steps / goal) * 100)}%</div>
          </div>
        </Ring>
      </div>
      <div className="mt-5 mb-4 grid grid-cols-3 gap-2">
        <MiniStat icon={ActivityIcon} label="Distance" value={u.dist(day.distance_m)} />
        <MiniStat icon={TrendingUp} label="Floors" value={`${day.floors}/${profile.goals.floors}`} />
        <MiniStat icon={Flame} label="Active" value={`${formatNumber(day.active_kcal)} kcal`} />
      </div>
    </HeroCard>
  )
}

function BatteryHero({ day, intra }: { day: DailySummary; intra: Intraday }) {
  const now = intra.battery.findLast((v) => v != null) ?? day.bb_low ?? 0
  return (
    <HeroCard
      chip={
        <Chip tone="battery" className="py-1 text-xs">
          <BatteryCharging className="size-3.5" /> Body Battery
        </Chip>
      }
      right={<span className="text-xs font-semibold text-faint">High {day.bb_high ?? '–'}</span>}
      footer={
        <>
          <p className="text-[13px] text-muted">
            <b className="text-battery-strong">+{day.bb_charged ?? 0}</b> charged · <b className="text-ink">−{day.bb_drained ?? 0}</b> drained
          </p>
          <DetailsLink to="/health/body_battery" tone="battery" />
        </>
      }
    >
      <div className="mt-3 flex justify-center">
        <Ring value={now / 100} size={200} stroke={19} color="var(--battery)">
          <div>
            <BatteryCharging className="mx-auto mb-1 size-6 text-battery" />
            <div className="display text-[48px]">
              <AnimatedNumber value={now} />
            </div>
            <div className="mt-2 text-[13px] font-semibold text-battery-strong">{batteryLevel(now)}</div>
          </div>
        </Ring>
      </div>
      <div className="mt-4 mb-4">
        <IntradayChart values={intra.battery} mode="area" tone="battery" max={100} height={64} />
      </div>
    </HeroCard>
  )
}

function SleepHero({ night }: { night: SleepNight | null }) {
  const { profile } = useSession()
  const asleep = night ? night.deep_min + night.light_min + night.rem_min : 0
  return (
    <HeroCard
      chip={
        <Chip tone="sleep" className="py-1 text-xs">
          <MoonStar className="size-3.5" /> Last night
        </Chip>
      }
      right={<span className="text-xs font-semibold text-faint">Goal {duration(profile.goals.sleep_min)}</span>}
      footer={
        <>
          <p className="text-[13px] text-muted">{night ? <>Asleep <b className="text-ink tabular">{duration(asleep)}</b> · {night.restless} restless moments</> : 'No sleep recorded last night.'}</p>
          <DetailsLink to="/sleep" tone="sleep" />
        </>
      }
    >
      <div className="mt-3 flex justify-center">
        <Ring value={(night?.score ?? 0) / 100} size={200} stroke={19} color="var(--sleep)">
          <div>
            <div className="display text-[48px]">{night ? <AnimatedNumber value={night.score} /> : '–'}</div>
            <div className="mt-2 text-[13px] font-medium text-muted">sleep score</div>
            {night && <div className="mx-auto mt-2 w-fit rounded-full bg-sleep-soft px-2.5 py-0.5 text-xs font-bold text-sleep-strong">{sleepQuality(night.score)}</div>}
          </div>
        </Ring>
      </div>
      <div className="mt-5 flex items-center gap-3 px-1 text-sm">
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 font-semibold tabular">
          <MoonStar className="size-4 text-sleep" /> {night ? timeIn(night.start, profile.timezone) : '—'}
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 font-semibold tabular">
          <Sunrise className="size-4 text-star" /> {night ? timeIn(night.end, profile.timezone) : '—'}
        </span>
      </div>
      {night && (
        <SplitBar
          className="mt-4 mb-4"
          parts={(['deep', 'light', 'rem', 'awake'] as const).map((s) => ({ value: night[`${s}_min`], color: STAGES[s].color }))}
        />
      )}
    </HeroCard>
  )
}

const READINESS_BANDS = [
  { to: 0.25, color: 'var(--heart)' },
  { to: 0.5, color: 'var(--stress)' },
  { to: 0.75, color: 'var(--star)' },
  { to: 1, color: 'var(--train)' },
]

function ReadinessHero({ day, days, acts }: { day: DailySummary; days: DailySummary[]; acts: Activity[] }) {
  const v = day.readiness ?? 0
  const load = loadSeries(acts, day.date, day.date)[0]
  const status = trainingStatus(load.acute, load.chronic, trend(days.map((d) => d.vo2max)))
  const info = STATUS_INFO[status]
  const recovery = recoveryHours(acts, new Date())
  return (
    <HeroCard
      chip={
        <Chip tone="train" className="py-1 text-xs">
          <GaugeIcon className="size-3.5" /> Training readiness
        </Chip>
      }
      right={<Chip tone={info.tone}>{info.label}</Chip>}
      footer={
        <>
          <p className="text-[13px] text-muted">{v >= 75 ? 'Ready for a hard session.' : v >= 50 ? 'Good for moderate training.' : 'Take it easy today.'}</p>
          <DetailsLink to="/training" tone="train" />
        </>
      }
    >
      <div className="mt-6">
        <Gauge value={v} size={232} bands={READINESS_BANDS}>
          <div className="display text-[46px]">
            <AnimatedNumber value={v} />
          </div>
          <div className="mt-1 text-[13px] font-semibold text-muted">{readinessLevel(v)}</div>
        </Gauge>
      </div>
      <div className="mt-5 mb-4 grid grid-cols-3 gap-2">
        <MiniStat icon={Timer} label="Recovery" value={recovery ? `${recovery}h` : 'Done'} />
        <MiniStat icon={ActivityIcon} label="HRV" value={day.hrv_status ? HRV_LABEL[day.hrv_status] : '–'} />
        <MiniStat icon={Zap} label="Acute load" value={load.acute} />
      </div>
    </HeroCard>
  )
}

function Tile({ to, icon: Icon, tone, label, value, unit, foot, beat, index }: { to: string; icon: LucideIcon; tone: Tone; label: string; value: ReactNode; unit?: string; foot: ReactNode; beat?: boolean; index: number }) {
  return (
    <Card to={to} style={rise(index)} className="animate-rise p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        <Icon className={cx('size-4', TONE[tone].text, beat && 'animate-beat')} /> {label}
      </span>
      <p className="display mt-2.5 text-[28px]">
        {value}
        {unit && <span className="ml-1 text-[13px] font-semibold tracking-normal text-muted">{unit}</span>}
      </p>
      <div className="mt-2 min-h-5">{foot}</div>
    </Card>
  )
}

function QuickTiles({ day, days, today }: { day: DailySummary; days: DailySummary[]; today: ISODate }) {
  const { profile } = useSession()
  const prev = days.filter((d) => d.date < today).slice(-7)
  const week = days.filter((d) => d.date >= startOfWeek(today))
  const im = intensityMinutes(week)
  return (
    <>
      <Tile
        index={0}
        to="/health/resting_hr"
        icon={HeartPulse}
        tone="heart"
        beat
        label="Resting HR"
        value={day.resting_hr ?? '–'}
        unit="bpm"
        foot={<Delta value={change(day.resting_hr, avg(prev.map((d) => d.resting_hr)))} better="lower" />}
      />
      <Tile
        index={1}
        to="/health/hrv"
        icon={ActivityIcon}
        tone="train"
        label="Overnight HRV"
        value={day.hrv ?? '–'}
        unit="ms"
        foot={day.hrv_status && <Chip tone={day.hrv_status === 'balanced' ? 'train' : day.hrv_status === 'unbalanced' ? 'star' : 'heart'}>{HRV_LABEL[day.hrv_status]}</Chip>}
      />
      <Tile
        index={2}
        to="/health/stress"
        icon={Brain}
        tone="stress"
        label="Stress"
        value={day.avg_stress ?? '–'}
        foot={day.avg_stress != null && <Chip tone="stress">{stressLevel(day.avg_stress)}</Chip>}
      />
      <Tile
        index={3}
        to="/health/intensity"
        icon={Zap}
        tone="star"
        label="Intensity this week"
        value={im}
        unit={`/ ${profile.goals.intensity_min}`}
        foot={<Progress value={im / profile.goals.intensity_min} tone="star" className="mt-1.5" />}
      />
    </>
  )
}

type TimelineKind = 'hr' | 'stress' | 'battery' | 'steps'

function Timeline({ intra, day }: { intra: Intraday; day?: DailySummary }) {
  const [kind, setKind] = useState<TimelineKind>('hr')
  const known = (xs: (number | null)[]) => xs.filter((v): v is number => v != null)
  const hr = known(intra.hr)
  const facts: Record<TimelineKind, { label: string; value: string }[]> = {
    hr: [
      { label: 'Resting', value: `${day?.resting_hr ?? '–'} bpm` },
      { label: 'Low', value: hr.length ? `${Math.min(...hr)} bpm` : '–' },
      { label: 'High', value: hr.length ? `${Math.max(...hr)} bpm` : '–' },
    ],
    stress: [
      { label: 'Average', value: String(day?.avg_stress ?? '–') },
      { label: 'Max', value: String(day?.max_stress ?? '–') },
      { label: 'Rest time', value: duration(known(intra.stress).filter((v) => v <= 25).length * 15) },
    ],
    battery: [
      { label: 'Charged', value: `+${day?.bb_charged ?? 0}` },
      { label: 'Drained', value: `−${day?.bb_drained ?? 0}` },
      { label: 'Now', value: String(intra.battery.findLast((v) => v != null) ?? '–') },
    ],
    steps: [
      { label: 'Total', value: formatNumber(day?.steps ?? 0) },
      { label: 'Best 15 min', value: formatNumber(Math.max(0, ...known(intra.steps))) },
      { label: 'Active time', value: duration(known(intra.steps).filter((v) => v > 250).length * 15) },
    ],
  }
  return (
    <Card className="p-4">
      <Segmented
        size="sm"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'hr', label: 'Heart' },
          { value: 'stress', label: 'Stress' },
          { value: 'battery', label: 'Battery' },
          { value: 'steps', label: 'Steps' },
        ]}
      />
      <div key={kind} className="mt-6">
        {kind === 'hr' && <IntradayChart values={intra.hr} mode="line" tone="heart" format={(v) => `${Math.round(v)} bpm`} />}
        {kind === 'stress' && <IntradayChart values={intra.stress} mode="bars" tone="stress" max={100} colorFor={stressColor} />}
        {kind === 'battery' && <IntradayChart values={intra.battery} mode="area" tone="battery" max={100} />}
        {kind === 'steps' && <IntradayChart values={intra.steps} mode="bars" tone="steps" format={(v) => `${Math.round(v)} steps`} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {facts[kind].map((f) => (
          <div key={f.label} className="animate-pop rounded-[16px] bg-surface-2/70 px-3 py-2">
            <span className="block text-[11px] font-medium text-muted">{f.label}</span>
            <span className="block text-[15px] font-bold tabular">{f.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Steps for Mon–Sun as a smooth curve, today pulsing (same look as Winner's week strip). */
function WeekSteps({ days, today, goal }: { days: DailySummary[]; today: ISODate; goal: number }) {
  const start = startOfWeek(today)
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDate = new Map(days.map((d) => [d.date, d]))
  const totals = week.map((d) => byDate.get(d)?.steps ?? 0)
  const todayIdx = week.indexOf(today)
  const max = Math.max(goal * 1.1, ...totals)
  // 100×100 viewBox: 22 units of headroom for labels, the line sits in 22..92.
  const pts = totals.map((v, i) => ({ x: ((i + 0.5) / 7) * 100, y: 92 - (v / max) * 70 }))
  const past = pts.slice(0, todayIdx + 1)
  const line = past.reduce((p, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`
    const prev = past[i - 1]
    const mid = (prev.x + pt.x) / 2
    return `${p} C${mid},${prev.y} ${mid},${pt.y} ${pt.x},${pt.y}`
  }, '')
  const area = past.length > 1 ? `${line} L${past[past.length - 1].x},100 L${past[0].x},100 Z` : ''
  const goalY = 92 - (goal / max) * 70
  const t = pts[todayIdx]
  return (
    <Card className="overflow-hidden px-2 pt-3 pb-3">
      <div className="relative h-44">
        <div className="absolute inset-0 animate-reveal">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id="week-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--steps)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--steps)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2="100" y1={goalY} y2={goalY} stroke="var(--ink)" strokeOpacity="0.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            {t && <line x1={t.x} x2={t.x} y1={t.y} y2="100" stroke="var(--steps)" strokeOpacity="0.35" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
            {area && <path d={area} fill="url(#week-area)" />}
            <path d={line} fill="none" stroke="var(--steps)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        <span className="absolute right-2 rounded bg-surface px-1 text-[10px] font-semibold text-muted" style={{ top: `calc(${goalY}% - 16px)` }}>
          Goal {compact(goal)}
        </span>
        {pts.map((p, i) =>
          i === todayIdx ? null : (
            <span
              key={i}
              className={cx('absolute size-2.5 -translate-1/2 rounded-full', i < todayIdx ? (totals[i] >= goal ? 'bg-steps ring-[2.5px] ring-steps' : 'bg-surface ring-[2.5px] ring-steps') : 'bg-line')}
              style={{ left: `${p.x}%`, top: `${i < todayIdx ? p.y : 92}%` }}
            />
          ),
        )}
        {pts.map((p, i) =>
          i < todayIdx ? (
            <span key={`v${i}`} className={cx('absolute -translate-x-1/2 text-[12px] leading-none font-extrabold tabular', totals[i] >= goal ? 'text-steps-strong' : 'text-ink')} style={{ left: `${p.x}%`, top: `calc(${p.y}% - 22px)` }}>
              {compact(totals[i])}
            </span>
          ) : null,
        )}
        {t && (
          <>
            <span className="absolute size-7 -translate-1/2 animate-ping rounded-full bg-steps/25 motion-reduce:hidden" style={{ left: `${t.x}%`, top: `${t.y}%` }} />
            <span className="absolute size-3.5 -translate-1/2 rounded-full bg-steps ring-4 ring-steps/20" style={{ left: `${t.x}%`, top: `${t.y}%` }} />
            <span
              className="absolute -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-[13px] font-extrabold whitespace-nowrap text-bg tabular shadow-sm"
              style={{ left: `clamp(24px, ${t.x}%, calc(100% - 24px))`, top: `calc(${t.y}% - 34px)` }}
            >
              {compact(totals[todayIdx])}
            </span>
          </>
        )}
      </div>
      <div className="mt-1 grid grid-cols-7">
        {week.map((d, i) => (
          <span key={d} className={cx('text-center text-[11px] font-bold', i === todayIdx ? 'text-steps' : 'text-faint')}>
            {formatWeekdayLetter(d)}
          </span>
        ))}
      </div>
    </Card>
  )
}
