import { Activity, ChevronLeft, ChevronRight, Droplets, HeartPulse, Lightbulb, MoonStar, Sunrise, WavesHorizontal, Wind } from 'lucide-react'
import { useState } from 'react'
import { useSleep, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { Hypnogram, LineChart, Ring, StackedBars, STAGES } from '../components/charts'
import { AnimatedNumber, Card, Chip, EmptyState, IconButton, PageHeader, SectionTitle, Skeleton, rise } from '../components/ui'
import { avg, sleepQuality } from '../domain/stats'
import type { SleepNight, SleepStage } from '../domain/types'
import { addDays, clock, formatDayShort, formatWeekdayLetter, minutesOfDayIn, relativeDay } from '../lib/dates'
import { duration } from '../lib/format'

/** Typical healthy share of each stage (Garmin uses similar ranges). */
const RANGES: Record<SleepStage, [number, number]> = { deep: [16, 33], light: [30, 64], rem: [21, 31], awake: [0, 5] }

const asleepMin = (n: SleepNight) => n.deep_min + n.light_min + n.rem_min
/** Bedtime as minutes after 18:00, so 23:30 and 00:30 compare correctly. */
const bedRank = (m: number) => (m - 1080 + 1440) % 1440

export default function SleepScreen() {
  const { profile } = useSession()
  const today = useToday()
  const { data } = useSleep(addDays(today, -27), today)
  const [offset, setOffset] = useState(0)
  const date = addDays(today, -offset)
  const night = data?.find((n) => n.date === date) ?? null

  return (
    <div className="animate-fade-in">
      <PageHeader
        back="/"
        subtitle={relativeDay(date, today) === 'Today' ? 'Last night' : `Night to ${formatDayShort(date)}`}
        title="Sleep"
        actions={
          <>
            <IconButton icon={ChevronLeft} label="Previous night" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 27} />
            <IconButton icon={ChevronRight} label="Next night" onClick={() => setOffset((o) => o - 1)} disabled={offset === 0} />
          </>
        }
      />
      <div className="px-4">
        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[220px]" />
          </div>
        ) : !night ? (
          <Card>
            <EmptyState icon={MoonStar} title="No sleep data" text="Your watch didn't record this night. Wear it to bed to track sleep stages, HRV and recovery." />
          </Card>
        ) : (
          <div key={date} className="[&>*]:animate-rise">
            <ScoreCard night={night} tz={profile.timezone} goal={profile.goals.sleep_min} />
            <SectionTitle>Sleep stages</SectionTitle>
            <Card className="p-4">
              <Hypnogram night={night} startClock={minutesOfDayIn(night.start, profile.timezone)} />
              <div className="mt-5 space-y-3">
                {(['deep', 'light', 'rem', 'awake'] as const).map((s, i) => (
                  <StageRow key={s} stage={s} minutes={night[`${s}_min`]} total={asleepMin(night) + night.awake_min} index={i} />
                ))}
              </div>
            </Card>
            <SectionTitle>Overnight</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: HeartPulse, label: 'Avg heart rate', value: `${night.avg_hr} bpm`, tone: 'text-heart' },
                { icon: Activity, label: 'Avg HRV', value: `${night.hrv} ms`, tone: 'text-train' },
                { icon: Wind, label: 'Respiration', value: `${night.avg_respiration} brpm`, tone: 'text-train' },
                { icon: Droplets, label: 'Pulse Ox', value: `${night.avg_spo2}%`, tone: 'text-battery' },
              ].map((m, i) => (
                <Card key={m.label} style={rise(i)} className="animate-rise p-4">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                    <m.icon className={`size-4 ${m.tone}`} /> {m.label}
                  </span>
                  <p className="display mt-2 text-[24px]">{m.value}</p>
                </Card>
              ))}
            </div>
            <Insights night={night} nights={data} tz={profile.timezone} goal={profile.goals.sleep_min} />
          </div>
        )}

        {data && data.length > 0 && <History nights={data} today={today} active={date} goal={profile.goals.sleep_min} />}
      </div>
    </div>
  )
}

function ScoreCard({ night, tz, goal }: { night: SleepNight; tz: string; goal: number }) {
  const asleep = asleepMin(night)
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-center gap-5">
        <Ring value={night.score / 100} size={150} stroke={15} color="var(--sleep)">
          <div>
            <div className="display text-[42px]">
              <AnimatedNumber value={night.score} />
            </div>
            <div className="mt-1 text-[12px] font-bold text-sleep-strong">{sleepQuality(night.score)}</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-wide text-faint uppercase">Time asleep</p>
          <p className="display mt-1 text-[30px]">{duration(asleep)}</p>
          <p className="mt-1 text-[13px] text-muted">{asleep >= goal ? 'Goal reached' : `${duration(goal - asleep)} under your goal`}</p>
          <div className="mt-3 flex flex-col gap-1.5 text-[13px] font-semibold tabular">
            <span className="flex items-center gap-1.5">
              <MoonStar className="size-4 text-sleep" /> {clock(minutesOfDayIn(night.start, tz))}
            </span>
            <span className="flex items-center gap-1.5">
              <Sunrise className="size-4 text-star" /> {clock(minutesOfDayIn(night.end, tz))}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

function StageRow({ stage, minutes, total, index }: { stage: SleepStage; minutes: number; total: number; index: number }) {
  const pct = Math.round((minutes / total) * 100)
  const [lo, hi] = RANGES[stage]
  const ok = pct >= lo && pct <= hi
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="flex items-center gap-2 font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: STAGES[stage].color }} />
          {STAGES[stage].label}
          <span className="font-medium text-faint">
            ideal {lo}–{hi}%
          </span>
        </span>
        <span className="font-bold tabular">
          {duration(minutes)} <span className={ok ? 'text-train-strong' : 'text-stress-strong'}>{pct}%</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        {/* Ideal range band behind the value. */}
        <span className="absolute inset-y-0 rounded-full bg-train/15" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <span className="absolute inset-y-0 left-0 origin-left animate-grow-x rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: STAGES[stage].color, animationDelay: `${index * 80}ms` }} />
      </div>
    </div>
  )
}

function Insights({ night, nights, tz, goal }: { night: SleepNight; nights: SleepNight[]; tz: string; goal: number }) {
  const others = nights.filter((n) => n.date !== night.date)
  const bed = bedRank(minutesOfDayIn(night.start, tz))
  const avgBed = avg(others.map((n) => bedRank(minutesOfDayIn(n.start, tz))))
  const avgScore = avg(others.map((n) => n.score))
  const tips: string[] = []
  if (avgBed != null && Math.abs(bed - avgBed) >= 30)
    tips.push(`You went to bed ${duration(Math.abs(bed - avgBed))} ${bed > avgBed ? 'later' : 'earlier'} than usual (${clock(avgBed + 1080)}). A steady bedtime improves sleep quality.`)
  if (asleepMin(night) < goal - 45) tips.push(`You slept ${duration(goal - asleepMin(night))} less than your goal. Try to protect the first hours of the night: that's when deep sleep happens.`)
  if (night.deep_min / asleepMin(night) >= 0.2) tips.push('Plenty of deep sleep: great for physical recovery after training.')
  if (night.rem_min / asleepMin(night) < 0.18) tips.push('REM sleep was low. Alcohol, late meals and late screens can reduce it.')
  if (avgScore != null && night.score >= avgScore + 8) tips.push(`Score ${Math.round(night.score - avgScore)} points above your 4-week average. Nice!`)
  if (!tips.length) tips.push('A typical night for you. Consistency is the best sleep habit.')
  return (
    <>
      <SectionTitle>Insights</SectionTitle>
      <Card className="divide-y divide-line">
        {tips.slice(0, 3).map((t, i) => (
          <p key={i} style={rise(i)} className="flex animate-rise gap-3 p-4 text-[14px] leading-snug text-ink-2">
            <Lightbulb className="mt-0.5 size-[18px] shrink-0 text-star" /> {t}
          </p>
        ))}
      </Card>
    </>
  )
}

function History({ nights, today, active, goal }: { nights: SleepNight[]; today: string; active: string; goal: number }) {
  const byDate = new Map(nights.map((n) => [n.date, n]))
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const all = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27))
  const avgScore = avg(nights.map((n) => n.score))
  const avgAsleep = avg(nights.map(asleepMin))
  return (
    <>
      <SectionTitle action={<Chip tone="sleep">avg {avgAsleep ? duration(avgAsleep) : '–'}</Chip>}>Last 7 nights</SectionTitle>
      <Card className="p-4 pt-8">
        <StackedBars
          goal={goal}
          format={duration}
          columns={week.map((d) => {
            const n = byDate.get(d)
            return {
              key: d,
              label: formatWeekdayLetter(d),
              active: d === active,
              parts: n ? (['deep', 'light', 'rem', 'awake'] as const).map((s) => ({ value: n[`${s}_min`], color: STAGES[s].color })) : [],
            }
          })}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {(['deep', 'light', 'rem', 'awake'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
              <span className="size-2 rounded-full" style={{ background: STAGES[s].color }} /> {STAGES[s].label}
            </span>
          ))}
        </div>
      </Card>
      <SectionTitle action={<Chip tone="sleep">avg {avgScore ? Math.round(avgScore) : '–'}</Chip>}>Score, 4 weeks</SectionTitle>
      <Card className="p-4 pt-6">
        <LineChart
          tone="sleep"
          pulse
          values={all.map((d) => byDate.get(d)?.score ?? null)}
          tip={(i) => formatDayShort(all[i])}
          labels={[0, 7, 14, 21, 27].map((i) => ({ i, text: formatDayShort(all[i]) }))}
          band={[80, 100]}
          min={30}
          max={100}
        />
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
          <WavesHorizontal className="size-3.5 text-sleep" /> Shaded: good sleep (80+)
        </p>
      </Card>
    </>
  )
}
