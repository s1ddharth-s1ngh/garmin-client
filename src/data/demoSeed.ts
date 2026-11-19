// Deterministic demo data shaped like the Garmin Connect Personal API, generated on the fly.
// Same user + same date = same numbers, so nothing big is stored in the browser.
import { hrvStatus } from '../domain/stats'
import { trimp, zoneOf } from '../domain/training'
import type { Activity, ActivityDetail, ActivitySample, DailySummary, Intraday, Lap, SleepNight, SleepSegment, SleepStage, Sport, StrengthSet, WeightEntry } from '../domain/types'
import { addDays, clock, diffDays, minutesOfDayIn, weekday, zonedTimeToInstant, type ISODate } from '../lib/dates'

// ---- Seeded randomness ----

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rand = () => number
const rng = (...parts: (string | number)[]): Rand => mulberry32(hash(parts.join('|')))
const gauss = (r: Rand) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round1 = (v: number) => Math.round(v * 10) / 10

export interface GenContext {
  seed: string
  tz: string
  maxHr: number
  device: string
  now: Date
  today: ISODate
  /** First day with data (Garmin imports one year of history on connect). */
  first: ISODate
}

// ---- Slow trends: fitness improves over the year ----

const fit = (date: ISODate) => clamp(diffDays(date, '2025-10-01') / 420, 0, 1)
const vo2For = (date: ISODate) => Math.round(46 + 6 * fit(date) + 0.7 * Math.sin(diffDays(date, '2025-01-01') / 11))
const restFor = (date: ISODate) => 57 - 6 * fit(date)
const hrvBaseline = (date: ISODate) => 56 + 9 * fit(date)

// ---- Activities ----

type Kind = 'easy' | 'intervals' | 'long' | 'trail' | 'hike' | 'walk' | 'ride' | 'indoor' | 'swim' | 'strength' | 'yoga' | 'hiit'

const KIND: Record<Kind, { sport: Sport; name: string; hr: number }> = {
  easy: { sport: 'running', name: 'Easy run', hr: 0.75 },
  intervals: { sport: 'running', name: 'Track intervals', hr: 0.82 },
  long: { sport: 'running', name: 'Long run', hr: 0.77 },
  trail: { sport: 'trail_running', name: 'Trail run', hr: 0.79 },
  hike: { sport: 'hiking', name: 'Hike', hr: 0.62 },
  walk: { sport: 'walking', name: 'Lunch walk', hr: 0.55 },
  ride: { sport: 'cycling', name: 'Sunday ride', hr: 0.7 },
  indoor: { sport: 'indoor_cycling', name: 'Indoor ride', hr: 0.73 },
  swim: { sport: 'swimming', name: 'Pool swim', hr: 0.7 },
  strength: { sport: 'strength', name: 'Strength', hr: 0.6 },
  yoga: { sport: 'yoga', name: 'Yoga', hr: 0.48 },
  hiit: { sport: 'hiit', name: 'HIIT', hr: 0.8 },
}

/** Weekly routine with random skips: Mon gym, Tue easy, Wed bike/yoga, Thu intervals, Fri walk/swim, Sat long, Sun ride. */
function plan(seed: string, date: ISODate): { kind: Kind; start: number }[] {
  const r = rng(seed, date, 'plan')
  const out: { kind: Kind; start: number }[] = []
  const at = (kind: Kind, h: number) => out.push({ kind, start: Math.round(h * 60 + gauss(r) * 25) })
  switch (weekday(date)) {
    case 0:
      if (r() < 0.7) at('strength', 18.5)
      break
    case 1:
      if (r() < 0.85) at('easy', 7)
      break
    case 2:
      if (r() < 0.5) at('indoor', 19)
      else if (r() < 0.6) at('yoga', 20)
      break
    case 3:
      if (r() < 0.8) at('intervals', 18)
      break
    case 4:
      if (r() < 0.3) at('swim', 7)
      if (r() < 0.5) at('walk', 13)
      break
    case 5:
      if (r() < 0.72) at('long', 8.5)
      else at(r() < 0.5 ? 'hike' : 'trail', 9)
      break
    case 6:
      if (r() < 0.7) at('ride', 9)
      else if (r() < 0.5) at('hiit', 10.5)
      break
  }
  return out
}

const ACT_CACHE = new Map<string, Activity[]>()

/** All activities of a day (including ones later than now: callers cut by time). */
function dayActivities(ctx: GenContext, date: ISODate): Activity[] {
  const key = `${ctx.seed}|${ctx.tz}|${ctx.maxHr}|${date}`
  const hit = ACT_CACHE.get(key)
  if (hit) return hit
  const acts = plan(ctx.seed, date).map((p, n) => makeActivity(ctx, date, p.kind, p.start, n))
  ACT_CACHE.set(key, acts)
  return acts
}

function makeActivity(ctx: GenContext, date: ISODate, kind: Kind, startMin: number, n: number): Activity {
  const r = rng(ctx.seed, date, 'act', n)
  const k = KIND[kind]
  const vo2 = vo2For(date)
  const easyPace = 362 - (vo2 - 46) * 7 // s/km
  let dist = 0
  let speed = 0
  let minutes = 0
  let elevPerKm = 0
  switch (kind) {
    case 'easy':
      ;[dist, speed, elevPerKm] = [7000 + r() * 3500, 1000 / (easyPace * (0.97 + r() * 0.06)), 6 + r() * 8]
      break
    case 'intervals':
      ;[dist, speed, elevPerKm] = [8000 + r() * 3000, 1000 / (easyPace * 0.86), 3 + r() * 3]
      break
    case 'long':
      ;[dist, speed, elevPerKm] = [14000 + r() * 8000, 1000 / (easyPace * 1.03), 7 + r() * 9]
      break
    case 'trail':
      ;[dist, speed, elevPerKm] = [10000 + r() * 6000, 1000 / (easyPace * 1.38), 40 + r() * 35]
      break
    case 'hike':
      ;[dist, speed, elevPerKm] = [9000 + r() * 6000, 1000 / (720 + r() * 180), 55 + r() * 40]
      break
    case 'walk':
      ;[dist, speed, elevPerKm] = [3800 + r() * 2600, 1000 / (640 + r() * 80), 4 + r() * 6]
      break
    case 'ride':
      ;[dist, speed, elevPerKm] = [45000 + r() * 45000, 7.4 + r() * 1.3 + fit(date) * 0.4, 8 + r() * 9]
      break
    case 'indoor':
      ;[minutes, speed] = [45 + r() * 20, 8.2 + r() * 0.6]
      dist = speed * minutes * 60
      break
    case 'swim':
      ;[dist, speed] = [1500 + Math.round(r() * 4) * 250, 100 / (112 + r() * 18)]
      break
    case 'strength':
      minutes = 45 + r() * 20
      break
    case 'yoga':
      minutes = 40 + r() * 25
      break
    case 'hiit':
      minutes = 24 + r() * 12
      break
  }
  const moving = dist && speed ? dist / speed : minutes * 60
  const duration = Math.round(moving * (kind === 'hike' || kind === 'ride' ? 1.08 : 1.02))
  const rest = restFor(date)
  const avgHr = Math.round(clamp(k.hr * ctx.maxHr + gauss(r) * 3, 80, ctx.maxHr - 5))
  const maxHr = Math.round(Math.min(ctx.maxHr, avgHr + 12 + r() * 14))
  const load = Math.round(trimp(duration / 60, avgHr, rest, ctx.maxHr) * 1.15)
  const start = zonedTimeToInstant(date, clock(clamp(startMin, 300, 1380)), ctx.tz)
  const foot = k.sport === 'running' || k.sport === 'trail_running' || k.sport === 'walking' || k.sport === 'hiking'
  const part = startMin < 660 ? 'Morning' : startMin < 1020 ? 'Afternoon' : 'Evening'
  return {
    id: `${date}_${n}`,
    date,
    start: start.toISOString(),
    name: kind === 'easy' ? `${part} run` : kind === 'strength' ? `${part} strength` : k.name,
    sport: k.sport,
    duration_s: duration,
    moving_s: Math.round(moving),
    distance_m: Math.round(dist),
    elevation_gain_m: kind === 'indoor' || kind === 'swim' ? 0 : Math.round((dist / 1000) * elevPerKm),
    avg_hr: avgHr,
    max_hr: maxHr,
    kcal: Math.round((duration / 60) * (0.085 * avgHr - 3.2)),
    avg_speed: Math.round(speed * 1000) / 1000,
    max_speed: Math.round(speed * (1.18 + r() * 0.2) * 1000) / 1000,
    avg_cadence: foot ? Math.round(kind === 'walk' || kind === 'hike' ? 108 + r() * 10 : 164 + r() * 12) : k.sport.includes('cycling') ? Math.round(84 + r() * 8) : null,
    aerobic_te: round1(clamp(0.8 + load / 58, 0, 5)),
    anaerobic_te: round1(kind === 'intervals' || kind === 'hiit' ? 2.2 + r() * 1.4 : r() * 1.1),
    load,
    device: ctx.device,
  }
}

const loadOf = (ctx: GenContext, date: ISODate) => dayActivities(ctx, date).reduce((s, a) => s + a.load, 0)

// ---- Sleep ----

const SLEEP_CACHE = new Map<string, SleepNight | null>()

function hrvFor(ctx: GenContext, date: ISODate): number {
  const r = rng(ctx.seed, date, 'hrv')
  return Math.round(clamp(hrvBaseline(date) - loadOf(ctx, addDays(date, -1)) * 0.06 + gauss(r) * 5, 20, 140))
}

/** The night that ends on the morning of `date`. */
function night(ctx: GenContext, date: ISODate): SleepNight | null {
  const key = `${ctx.seed}|${ctx.tz}|${date}`
  if (SLEEP_CACHE.has(key)) return SLEEP_CACHE.get(key)!
  const r = rng(ctx.seed, date, 'sleep')
  let out: SleepNight | null = null
  if (r() > 0.02) {
    const eve = addDays(date, -1)
    const late = weekday(eve) >= 4 // Friday and Saturday nights
    const bed = 23 * 60 + 5 + gauss(r) * 28 + (late ? 45 : 0)
    const target = clamp(452 + gauss(r) * 36 + (late ? 25 : 0), 320, 590)
    const segs: SleepSegment[] = []
    const push = (stage: SleepStage, len: number) => {
      const from = segs.at(-1)?.to ?? 0
      const to = Math.round(from + len)
      if (to <= from) return
      if (segs.at(-1)?.stage === stage) segs[segs.length - 1].to = to
      else segs.push({ stage, from, to })
    }
    push('light', 8 + r() * 14)
    for (let cycle = 0; (segs.at(-1)?.to ?? 0) < target; cycle++) {
      const len = 82 + r() * 22
      const deep = clamp(0.33 - cycle * 0.075, 0.02, 0.35)
      const rem = clamp(0.12 + cycle * 0.06, 0.1, 0.42)
      const light = 1 - deep - rem
      push('light', len * light * 0.55)
      push('deep', len * deep)
      push('light', len * light * 0.45)
      push('rem', len * rem)
      if (r() < 0.33) push('awake', 2 + r() * 7)
    }
    push('awake', 2 + r() * 4)
    const mins = (s: SleepStage) => segs.filter((x) => x.stage === s).reduce((t, x) => t + x.to - x.from, 0)
    const [deepM, lightM, remM, awakeM] = [mins('deep'), mins('light'), mins('rem'), mins('awake')]
    const asleep = deepM + lightM + remM
    const score = Math.round(clamp(38 + (Math.min(asleep, 500) / 480) * 30 + (deepM / asleep) * 62 + (remM / asleep) * 40 - awakeM * 0.55, 30, 98))
    const startAt = bed >= 1440 ? zonedTimeToInstant(date, clock(bed - 1440), ctx.tz) : zonedTimeToInstant(eve, clock(bed), ctx.tz)
    const total = segs.at(-1)!.to
    out = {
      date,
      start: startAt.toISOString(),
      end: new Date(startAt.getTime() + total * 60_000).toISOString(),
      score,
      deep_min: deepM,
      light_min: lightM,
      rem_min: remM,
      awake_min: awakeM,
      stages: segs,
      avg_hr: Math.round(restFor(date) + 3 + gauss(r) * 1.5),
      avg_respiration: round1(14.1 + gauss(r) * 0.5),
      avg_spo2: Math.round(clamp(95.5 + gauss(r) * 1.2, 89, 100)),
      restless: Math.round(8 + r() * 26),
      hrv: hrvFor(ctx, date),
    }
  }
  SLEEP_CACHE.set(key, out)
  return out
}

const nowMinute = (ctx: GenContext) => minutesOfDayIn(ctx.now, ctx.tz)

/** Night of `date` only once it is over. */
export function genSleep(ctx: GenContext, date: ISODate): SleepNight | null {
  if (date < ctx.first || date > ctx.today) return null
  const n = night(ctx, date)
  return n && new Date(n.end) <= ctx.now ? n : null
}

/** Activities of a day that already started (and finished). */
export function genActivities(ctx: GenContext, date: ISODate): Activity[] {
  if (date < ctx.first || date > ctx.today) return []
  return dayActivities(ctx, date).filter((a) => new Date(a.start).getTime() + a.duration_s * 1000 <= ctx.now.getTime())
}

// ---- Daily summary ----

export function genDay(ctx: GenContext, date: ISODate): DailySummary | null {
  if (date < ctx.first || date > ctx.today) return null
  const r = rng(ctx.seed, date, 'day')
  const all = dayActivities(ctx, date)
  const acts = genActivities(ctx, date)
  const isToday = date === ctx.today
  // Share of the waking day already gone (7:00 → 22:00).
  const part = isToday ? clamp((nowMinute(ctx) - 420) / 900, 0, 1) : 1
  const f = fit(date)
  const weekend = weekday(date) >= 5
  const footSteps = acts.reduce((s, a) => s + (a.avg_cadence && !a.sport.includes('cycling') ? (a.moving_s / 60) * a.avg_cadence : 0), 0)
  const baseSteps = clamp(6200 + 2400 * f + gauss(r) * 2100 + (weekend ? 1400 : 0), 1500, 20000) * part
  const steps = Math.round(baseSteps + footSteps)
  const footDist = acts.reduce((s, a) => s + (a.avg_cadence && !a.sport.includes('cycling') ? a.distance_m : 0), 0)
  const climb = acts.reduce((s, a) => s + a.elevation_gain_m, 0)
  const floors = Math.round(clamp(5 + gauss(r) * 3.5, 0, 25) * part + (climb / 3) * 0.35)
  const actMin = (hard: boolean) => acts.reduce((s, a) => s + ((a.avg_hr >= 0.77 * ctx.maxHr) === hard ? Math.round(a.duration_s / 60) : 0), 0)
  const night0 = genSleep(ctx, date)
  const sleepScore = night0?.score ?? 60
  const hrv = night0 ? night0.hrv : null
  const baseline = hrvBaseline(date)
  const week = Array.from({ length: 7 }, (_, i) => hrvFor(ctx, addDays(date, -i)))
  const prevLoad = loadOf(ctx, addDays(date, -1))
  const prev2Load = loadOf(ctx, addDays(date, -2))
  const avgStress = Math.round(clamp(33 + gauss(r) * 7 - (sleepScore - 75) * 0.22 - (weekend ? 6 : 0), 10, 75))
  const bbHigh = Math.round(clamp(28 + sleepScore * 0.62 + (hrv ? (hrv / baseline - 1) * 45 : 0) + gauss(r) * 4, 15, 100))
  const drained = clamp(32 + baseSteps / 650 + all.reduce((s, a) => s + a.load, 0) * 0.22 + avgStress * 0.35, 15, 95) * (isToday ? Math.max(part, 0.05) : 1)
  const activeKcal = Math.round(baseSteps * 0.042 + acts.reduce((s, a) => s + a.kcal, 0) * 0.9)
  const bmr = 1680
  const readinessRaw = 0.45 * sleepScore + 0.33 * clamp((hrv ?? baseline) / baseline, 0, 1.2) * 85 + 22 - prevLoad * 0.13 - prev2Load * 0.05
  return {
    date,
    steps,
    floors,
    distance_m: Math.round(baseSteps * 0.76 + footDist),
    active_kcal: activeKcal,
    total_kcal: Math.round(bmr * (isToday ? nowMinute(ctx) / 1440 : 1) + activeKcal),
    moderate_min: Math.round(clamp(12 + gauss(r) * 9, 0, 50) * part) + actMin(false),
    vigorous_min: actMin(true),
    resting_hr: Math.round(restFor(date) + prevLoad * 0.012 + (sleepScore < 60 ? 2 : 0) + gauss(r) * 1.2),
    min_hr: Math.round(restFor(date) - 4 + gauss(r)),
    max_hr: acts.length ? Math.max(...acts.map((a) => a.max_hr)) : Math.round(118 + r() * 20),
    avg_stress: avgStress,
    max_stress: Math.round(clamp(avgStress + 32 + r() * 25, 0, 99) * (isToday ? 0.6 + part * 0.4 : 1)),
    bb_high: bbHigh,
    bb_low: Math.max(5, Math.round(bbHigh - drained)),
    bb_charged: Math.round(clamp(sleepScore * 0.72 + gauss(r) * 5, 8, 92)),
    bb_drained: Math.round(drained),
    spo2: night0?.avg_spo2 ?? null,
    respiration: night0?.avg_respiration ?? null,
    hrv,
    hrv_status: hrv ? hrvStatus(week.reduce((a, b) => a + b, 0) / 7, baseline) : null,
    readiness: Math.round(clamp(readinessRaw, 5, 100)),
    vo2max: vo2For(date),
    updated_at: (isToday ? ctx.now : new Date(zonedTimeToInstant(addDays(date, 1), '06:00', ctx.tz))).toISOString(),
  }
}

// ---- Intraday ----

export function genIntraday(ctx: GenContext, date: ISODate): Intraday | null {
  const d = genDay(ctx, date)
  if (!d) return null
  const r = rng(ctx.seed, date, 'intraday')
  const n0 = night(ctx, date)
  const n1 = night(ctx, addDays(date, 1))
  const midnight = zonedTimeToInstant(date, '00:00', ctx.tz).getTime()
  const wake = n0 ? (new Date(n0.end).getTime() - midnight) / 60_000 : 420
  const bed = n1 ? (new Date(n1.start).getTime() - midnight) / 60_000 : 1400
  const acts = dayActivities(ctx, date).map((a) => {
    const s = (new Date(a.start).getTime() - midnight) / 60_000
    return { a, s, e: s + a.duration_s / 60 }
  })
  const until = date === ctx.today ? Math.floor(nowMinute(ctx) / 15) : 96
  const rest = d.resting_hr ?? 55
  const hr: (number | null)[] = []
  const stress: (number | null)[] = []
  const steps: (number | null)[] = []
  const cost: number[] = []
  const restSteps = Math.max(0, d.steps - acts.reduce((s, x) => s + (x.a.avg_cadence && !x.a.sport.includes('cycling') ? (x.a.moving_s / 60) * x.a.avg_cadence : 0), 0))
  // Step weights: commute peaks around 8:30 and 18:30, lunch walk at 13.
  const weights = Array.from({ length: 96 }, (_, i) => {
    const h = (i * 15 + 7.5) / 60
    return i * 15 < wake || i * 15 > bed ? 0 : 0.4 + Math.exp(-((h - 8.5) ** 2) / 0.6) + 0.8 * Math.exp(-((h - 13) ** 2) / 0.5) + Math.exp(-((h - 18.5) ** 2) / 0.8)
  })
  const wsum = weights.reduce((a, b) => a + b, 0) || 1
  for (let i = 0; i < 96; i++) {
    const m = i * 15 + 7.5
    const asleep = m < wake || m > bed
    const act = acts.find((x) => m >= x.s && m < x.e)
    let h: number
    let s: number | null
    if (act) {
      h = act.a.avg_hr + gauss(r) * 6
      s = null
    } else if (asleep) {
      h = rest + 2 + gauss(r) * 2
      s = Math.round(clamp(6 + r() * 12, 1, 25))
    } else {
      h = 66 + 10 * Math.sin(m / 140) + gauss(r) * 5
      s = Math.round(clamp((d.avg_stress ?? 30) + 14 * Math.sin(m / 90 + 1) + gauss(r) * 11, 1, 99))
    }
    hr.push(Math.round(h))
    stress.push(s)
    const actSteps = act && act.a.avg_cadence && !act.a.sport.includes('cycling') ? act.a.avg_cadence * 15 * 0.92 : 0
    steps.push(Math.round((restSteps * weights[i]) / wsum + actSteps))
    cost.push(asleep ? 0 : 1 + (act ? 5 + act.a.load / 30 : 0) + (s ?? 0) / 35)
  }
  // Body Battery: charges overnight to the daily high, then drains (faster in workouts) to the low.
  const high = d.bb_high ?? 80
  const low = d.bb_low ?? 30
  const start = clamp(low + 5 + r() * 10, 5, high - 5)
  const wakeI = Math.min(95, Math.floor(wake / 15))
  const total = cost.reduce((a, b) => a + b, 0) || 1
  let used = 0
  const battery = cost.map((c, i) => {
    if (i <= wakeI) return Math.round(start + ((high - start) * i) / Math.max(1, wakeI))
    used += c
    return Math.round(high - ((high - low) * used) / total)
  })
  const cut = <T,>(xs: T[]) => xs.map((v, i) => (i < until ? v : null))
  return { date, hr: cut(hr), stress: cut(stress), battery: cut(battery), steps: cut(steps) }
}

// ---- Activity detail ----

const EXERCISES = ['Bench press', 'Back squat', 'Deadlift', 'Pull-up', 'Overhead press', 'Barbell row', 'Walking lunge', 'Hip thrust']

export function genActivity(ctx: GenContext, id: string): ActivityDetail | null {
  const [date, n] = id.split('_')
  const a = genActivities(ctx, date).find((x) => x.id === id)
  if (!a || n === undefined) return null
  const r = rng(ctx.seed, id, 'detail')
  const count = clamp(Math.round(a.duration_s / 20), 30, 600)
  const dt = a.duration_s / count
  // Distance integrates over moving time only (pauses are in duration_s).
  const mv = a.moving_s / count
  const intervals = a.name.includes('intervals')
  const hasSpeed = a.avg_speed > 0
  // Elevation: two waves, rescaled so the total gain matches the summary.
  const [p1, p2, k1, k2] = [r() * 6, r() * 6, 1 + r() * 2.5, 3 + r() * 5]
  const raw = Array.from({ length: count }, (_, i) => Math.sin((i / count) * Math.PI * 2 * k1 + p1) * 0.65 + Math.sin((i / count) * Math.PI * 2 * k2 + p2) * 0.35 + gauss(r) * 0.01)
  let rawGain = 0
  for (let i = 1; i < count; i++) rawGain += Math.max(0, raw[i] - raw[i - 1])
  const scale = a.elevation_gain_m > 0 ? a.elevation_gain_m / (rawGain || 1) : 0
  const base = 220 + r() * 200
  const elevation = raw.map((v) => Math.round((base + v * scale) * 10) / 10)
  // Speed: noise, slower uphill, fast/slow reps for intervals.
  let speed = elevation.map((e, i) => {
    if (!hasSpeed) return 0
    const slope = i ? (e - elevation[i - 1]) / Math.max(1, a.avg_speed * dt) : 0
    const rep = intervals && i > count * 0.15 && i < count * 0.85 ? (Math.floor((i / count) * 24) % 2 === 0 ? 1.2 : 0.78) : 1
    return Math.max(0.5, a.avg_speed * rep * (1 - clamp(slope * 6, -0.25, 0.35)) * (1 + gauss(r) * 0.035))
  })
  const mean = speed.reduce((s, v) => s + v, 0) / count || 1
  speed = speed.map((v) => (hasSpeed ? Math.round((v * a.avg_speed) / mean * 1000) / 1000 : 0))
  // Heart rate follows effort with lag, after a warm-up ramp.
  let hrNow = a.avg_hr * 0.7
  const hrs = speed.map((v, i) => {
    const effort = hasSpeed ? v / a.avg_speed - 1 : Math.sin(i / 9) * 0.08
    const target = a.avg_hr * (1 + effort * 0.35) * (i < count * 0.08 ? 0.86 + (i / (count * 0.08)) * 0.14 : 1)
    hrNow += (target - hrNow) * 0.12 + gauss(r) * 0.8
    return hrNow
  })
  const hrMean = hrs.reduce((s, v) => s + v, 0) / count
  const samples: ActivitySample[] = hrs.map((h, i) => ({
    t: Math.round(i * dt),
    hr: Math.round(clamp(h + (a.avg_hr - hrMean), 70, a.max_hr)),
    speed: speed[i],
    elevation: elevation[i],
    cadence: a.avg_cadence ? Math.round(a.avg_cadence + (hasSpeed ? (speed[i] / a.avg_speed - 1) * 30 : 0) + gauss(r) * 2) : null,
  }))
  // Zones.
  const zones = [0, 0, 0, 0, 0]
  for (const s of samples) zones[Math.max(1, zoneOf(s.hr, ctx.maxHr)) - 1] += dt
  // Laps: 1 km on foot, 5 km on the bike, 250 m in the pool.
  const lapLen = a.sport.includes('cycling') ? 5000 : a.sport === 'swimming' ? 250 : 1000
  const laps: Lap[] = []
  if (a.distance_m > 0) {
    let acc = { d: 0, t: 0, hr: 0, n: 0, up: 0 }
    samples.forEach((s, i) => {
      acc.d += s.speed * mv
      acc.t += mv
      acc.hr += s.hr
      acc.n++
      if (i) acc.up += Math.max(0, s.elevation - samples[i - 1].elevation)
      if (acc.d >= lapLen || i === count - 1) {
        laps.push({ distance_m: Math.round(acc.d), duration_s: Math.round(acc.t), avg_hr: Math.round(acc.hr / acc.n), elevation_gain_m: Math.round(acc.up) })
        acc = { d: 0, t: 0, hr: 0, n: 0, up: 0 }
      }
    })
  }
  // Route: an irregular loop around a city park, sized to the distance.
  const outdoor = a.distance_m > 0 && a.sport !== 'swimming' && a.sport !== 'indoor_cycling'
  let route: [number, number][] | null = null
  if (outdoor) {
    const lat0 = 45.07 + (r() - 0.5) * 0.04
    const lng0 = 7.68 + (r() - 0.5) * 0.06
    const R = a.distance_m / (2 * Math.PI * 1.12)
    const [f1, f2] = [r() * 6, r() * 6]
    let cum = 0
    route = samples.map((s) => {
      cum += s.speed * mv
      const th = (cum / a.distance_m) * Math.PI * 2
      const rad = R * (1 + 0.28 * Math.sin(3 * th + f1) + 0.12 * Math.sin(7 * th + f2))
      const x = rad * Math.cos(th)
      const y = rad * Math.sin(th) * 0.75
      return [lat0 + y / 111_320, lng0 + x / (111_320 * Math.cos((lat0 * Math.PI) / 180))]
    })
  }
  let sets: StrengthSet[] | null = null
  if (a.sport === 'strength') {
    const picked = [...EXERCISES].sort(() => r() - 0.5).slice(0, 5)
    sets = picked.flatMap((exercise) => {
      const w = Math.round((20 + r() * 70) / 2.5) * 2.5
      return [0, 1, 2].map((i) => ({ exercise, reps: Math.round(12 - i * 2 + r() * 2), weight_kg: w + i * 2.5 }))
    })
  }
  return { ...a, samples, route, laps, zones: zones.map(Math.round), sets }
}

// ---- Weight ----

export function genWeights(ctx: GenContext, from: ISODate, to: ISODate): WeightEntry[] {
  const out: WeightEntry[] = []
  for (let d = from < ctx.first ? ctx.first : from; d <= to && d <= ctx.today; d = addDays(d, 1)) {
    const r = rng(ctx.seed, d, 'weight')
    if (r() > 0.42) continue
    const f = fit(d)
    out.push({ date: d, kg: round1(77.6 - 3.3 * f + gauss(r) * 0.35), body_fat: round1(19.4 - 2.6 * f + gauss(r) * 0.4), source: 'garmin' })
  }
  return out
}
