import { Flag, Gauge as GaugeIcon, Timer, TrendingUp, Zap } from 'lucide-react'
import { useActivities, useDays, useToday, useUnits } from '../app/hooks'
import { useSession } from '../app/session'
import { BarChart, Gauge, LineChart, SplitBar } from '../components/charts'
import { AnimatedNumber, Card, Chip, Delta, IconTile, PageHeader, SectionTitle, Skeleton, TONE, cx, rise } from '../components/ui'
import { SPORTS } from '../config/sports'
import { readinessLevel, sportTotals } from '../domain/stats'
import { intensityMinutes, loadSeries, predictRaceTime, RACES, recoveryHours, STATUS_INFO, trainingStatus, trend } from '../domain/training'
import type { Activity, DailySummary } from '../domain/types'
import { addDays, formatDayShort, formatWeekdayLetter, startOfWeek, type ISODate } from '../lib/dates'
import { duration, hms } from '../lib/format'

/** Rough VO2 max categories for adults (Cooper Institute style, not age/sex adjusted). */
function vo2Category(v: number) {
  if (v >= 55) return { label: 'Superior', tone: 'sleep' as const }
  if (v >= 48) return { label: 'Excellent', tone: 'train' as const }
  if (v >= 42) return { label: 'Good', tone: 'battery' as const }
  if (v >= 35) return { label: 'Fair', tone: 'star' as const }
  return { label: 'Poor', tone: 'stress' as const }
}

const RATIO_BANDS = [
  { to: 0.3, color: 'var(--stress)' },
  { to: 0.425, color: 'var(--battery)' },
  { to: 0.75, color: 'var(--train)' },
  { to: 1, color: 'var(--heart)' },
]

export default function TrainingScreen() {
  const today = useToday()
  const acts = useActivities(addDays(today, -120), today)
  const days = useDays(addDays(today, -181), today)
  const ready = acts.data && days.data
  return (
    <div className="animate-fade-in">
      <PageHeader subtitle="Status & performance" title="Training" />
      <div className="px-4">
        {!ready ? (
          <div className="space-y-3">
            <Skeleton className="h-[360px]" />
            <Skeleton className="h-[240px]" />
          </div>
        ) : (
          <Content acts={acts.data!} days={days.data!} today={today} />
        )}
      </div>
    </div>
  )
}

function Content({ acts, days, today }: { acts: Activity[]; days: DailySummary[]; today: ISODate }) {
  const { profile } = useSession()
  const u = useUnits()
  const series = loadSeries(acts, addDays(today, -55), today)
  const now = series.at(-1)!
  const vo2Values = days.map((d) => d.vo2max)
  const vo2 = vo2Values.findLast((v) => v != null) ?? 0
  const status = trainingStatus(now.acute, now.chronic, trend(vo2Values.slice(-28)))
  const info = STATUS_INFO[status]
  const recovery = recoveryHours(acts, new Date())
  const cat = vo2Category(vo2)
  const week7 = days.slice(-7)
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(today), -7 * (7 - i)))
  const month = acts.filter((a) => a.date > addDays(today, -30))
  const totals = sportTotals(month)
  const monthTime = totals.reduce((s, t) => s + t.duration_s, 0) || 1

  return (
    <div className="[&>*]:animate-rise">
      {/* Status hero */}
      <Card className="relative overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <Chip tone={info.tone} className="py-1 text-xs">
            <TrendingUp className="size-3.5" /> Training status
          </Chip>
          <Chip tone={recovery ? 'star' : 'train'}>
            <Timer className="size-3.5" /> {recovery ? `${recovery}h recovery` : 'Recovered'}
          </Chip>
        </div>
        <h2 className={cx('mt-4 text-[34px] leading-none font-black tracking-[-0.03em]', TONE[info.tone].text)}>{info.label}</h2>
        <p className="mt-2 text-[14px] text-muted">{info.text}</p>
        <div className="mt-6">
          <Gauge value={Math.min(now.ratio, 2)} max={2} size={240} bands={RATIO_BANDS}>
            <div className="display text-[38px]">{now.ratio ? now.ratio.toFixed(2) : '–'}</div>
            <div className="mt-1 text-[12px] font-semibold text-muted">load ratio (acute ÷ chronic)</div>
          </Gauge>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[18px] bg-surface-2/70 px-4 py-3">
            <p className="text-[12px] font-medium text-muted">Acute load · 7 days</p>
            <p className="mt-1 text-xl font-extrabold tabular">
              <AnimatedNumber value={now.acute} />
            </p>
          </div>
          <div className="rounded-[18px] bg-surface-2/70 px-4 py-3">
            <p className="text-[12px] font-medium text-muted">Chronic · weekly avg</p>
            <p className="mt-1 text-xl font-extrabold tabular">
              <AnimatedNumber value={now.chronic} />
            </p>
          </div>
        </div>
      </Card>

      <SectionTitle action={<span className="text-[13px] font-semibold text-muted">Optimal {Math.round(now.chronic * 0.85)}–{Math.round(now.chronic * 1.5)}</span>}>Acute load, 8 weeks</SectionTitle>
      <Card className="p-4 pt-6">
        <LineChart
          tone="train"
          pulse
          values={series.map((p) => p.acute)}
          band={now.chronic ? [now.chronic * 0.85, now.chronic * 1.5] : undefined}
          tip={(i) => formatDayShort(series[i].date)}
          labels={[0, 27, 55].map((i) => ({ i, text: formatDayShort(series[i].date) }))}
          min={0}
        />
        <p className="mt-3 text-[12px] text-muted">Shaded: the load range that builds fitness without overreaching.</p>
      </Card>

      <SectionTitle>Readiness, last 7 days</SectionTitle>
      <Card className="p-4 pt-8">
        <BarChart
          tone="train"
          bars={week7.map((d, i) => ({
            key: d.date,
            label: formatWeekdayLetter(d.date),
            value: d.readiness,
            active: i === week7.length - 1,
            level: (d.readiness ?? 0) >= 75 ? 'good' : (d.readiness ?? 0) >= 50 ? 'ok' : 'low',
          }))}
          format={(v) => `${Math.round(v)} · ${readinessLevel(v)}`}
        />
      </Card>

      <SectionTitle action={<Chip tone={cat.tone}>{cat.label}</Chip>}>VO2 max</SectionTitle>
      <Card className="p-5">
        <div className="flex items-end gap-3">
          <p className="display text-[44px]">{vo2}</p>
          <span className="mb-1 text-[13px] font-semibold text-muted">ml/kg/min</span>
          <Delta value={trend(vo2Values.slice(-90))} suffix="" better="higher" className="mb-1.5" />
          <span className="mb-1.5 text-[12px] text-faint">in 90 days</span>
        </div>
        <div className="mt-6">
          <LineChart
            tone="steps"
            values={vo2Values}
            format={(v) => v.toFixed(0)}
            tip={(i) => formatDayShort(days[i].date)}
            labels={[0, Math.floor(days.length / 2), days.length - 1].map((i) => ({ i, text: formatDayShort(days[i].date) }))}
          />
        </div>
      </Card>

      <SectionTitle>Race predictor</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        {RACES.map((r, i) => {
          const t = predictRaceTime(vo2, r.meters)
          return (
            <div key={r.key} style={rise(i)} className="flex animate-rise items-center gap-3 px-4 py-3.5">
              <IconTile icon={Flag} tone="steps" size={38} />
              <span className="flex-1 font-semibold">{r.label}</span>
              <span className="text-right">
                <span className="block text-[17px] font-extrabold tabular">{hms(t)}</span>
                <span className="block text-[12px] text-muted tabular">
                  {u.pace(r.meters / t)} {u.paceUnit}
                </span>
              </span>
            </div>
          )
        })}
      </Card>
      <p className="mt-2 px-1 text-[12px] text-faint">Estimated from your VO2 max with the Daniels running formula, assuming proper training for the distance.</p>

      <SectionTitle action={<span className="text-[13px] font-semibold text-muted">Goal {profile.goals.intensity_min}/week</span>}>Intensity minutes</SectionTitle>
      <Card className="p-4 pt-8">
        <BarChart
          tone="star"
          goal={profile.goals.intensity_min}
          bars={weeks.map((w, i) => {
            const v = intensityMinutes(days.filter((d) => d.date >= w && d.date < addDays(w, 7)))
            return { key: w, label: formatDayShort(w).split(' ')[0], value: v, active: i === weeks.length - 1, level: v >= profile.goals.intensity_min ? 'good' : 'ok' }
          })}
          format={(v) => `${Math.round(v)} min`}
        />
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
          <Zap className="size-3.5 text-star" /> Moderate minutes + 2× vigorous minutes, Monday to Sunday.
        </p>
      </Card>

      <SectionTitle action={<span className="text-[13px] font-semibold text-muted">{duration(monthTime / 60)}</span>}>Last 30 days by sport</SectionTitle>
      <Card className="p-5">
        {totals.length === 0 ? (
          <p className="text-[14px] text-muted">No activities in the last 30 days.</p>
        ) : (
          <>
            <SplitBar parts={totals.map((t) => ({ value: t.duration_s, color: TONE[SPORTS[t.sport].tone].color }))} />
            <div className="mt-4 space-y-3">
              {totals.map((t, i) => {
                const s = SPORTS[t.sport]
                return (
                  <div key={t.sport} style={rise(i)} className="flex animate-rise items-center gap-3">
                    <IconTile icon={s.icon} tone={s.tone} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{s.label}</span>
                      <span className="block text-[12px] text-muted">
                        {t.count}× {t.distance_m ? `· ${u.dist(t.distance_m)}` : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-bold tabular">{duration(t.duration_s / 60)}</span>
                      <span className="block text-[12px] text-faint tabular">{Math.round((t.duration_s / monthTime) * 100)}%</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-faint">
        <GaugeIcon className="size-3.5" /> Training metrics are estimates from heart rate and load.
      </p>
    </div>
  )
}
