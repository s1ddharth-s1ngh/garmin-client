import { addDays, startOfWeek, type ISODate } from '../lib/dates'
import type { Activity, DailySummary, HrvStatus, Sport } from './types'

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Average of the known values; null when there are none. */
export function avg(xs: (number | null | undefined)[]): number | null {
  const k = xs.filter((x): x is number => x != null)
  return k.length ? sum(k) / k.length : null
}

/** Percent change from `prev` to `cur`; null when it can't be computed. */
export const change = (cur: number | null, prev: number | null) => (cur == null || prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100)

/**
 * Consecutive qualifying days ending today. Today only counts once reached,
 * so an unfinished today doesn't break the streak.
 */
export function streak(days: DailySummary[], ok: (d: DailySummary) => boolean): number {
  let i = days.length - 1
  if (i >= 0 && !ok(days[i])) i--
  let n = 0
  for (; i >= 0 && ok(days[i]); i--) n++
  return n
}

export interface WeekVolume {
  week: ISODate
  count: number
  distance_m: number
  duration_s: number
  elevation_m: number
  load: number
  bySport: Partial<Record<Sport, number>>
}

/** Activity totals for the `weeks` weeks ending with the week of `today`, oldest first. bySport = seconds. */
export function weeklyVolume(activities: Activity[], weeks: number, today: ISODate): WeekVolume[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  const out: WeekVolume[] = Array.from({ length: weeks }, (_, i) => ({
    week: addDays(first, 7 * i),
    count: 0,
    distance_m: 0,
    duration_s: 0,
    elevation_m: 0,
    load: 0,
    bySport: {},
  }))
  for (const a of activities) {
    const w = out.find((x) => a.date >= x.week && a.date < addDays(x.week, 7))
    if (!w) continue
    w.count++
    w.distance_m += a.distance_m
    w.duration_s += a.duration_s
    w.elevation_m += a.elevation_gain_m
    w.load += a.load
    w.bySport[a.sport] = (w.bySport[a.sport] ?? 0) + a.duration_s
  }
  return out
}

export interface SportTotal {
  sport: Sport
  count: number
  distance_m: number
  duration_s: number
}

/** Per-sport totals, most time first. */
export function sportTotals(activities: Activity[]): SportTotal[] {
  const m = new Map<Sport, SportTotal>()
  for (const a of activities) {
    const t = m.get(a.sport) ?? { sport: a.sport, count: 0, distance_m: 0, duration_s: 0 }
    t.count++
    t.distance_m += a.distance_m
    t.duration_s += a.duration_s
    m.set(a.sport, t)
  }
  return [...m.values()].sort((a, b) => b.duration_s - a.duration_s)
}

export interface PersonalRecord {
  key: string
  label: string
  kind: 'distance' | 'time' | 'elevation' | 'steps' | 'duration'
  value: number
  date: ISODate
  activityId?: string
}

const RUNS: Sport[] = ['running', 'trail_running']
const RIDES: Sport[] = ['cycling', 'indoor_cycling']

/**
 * Personal records. Race-distance times are estimated from the average moving pace
 * of runs at least that long (the list API has no best-effort splits).
 */
export function personalRecords(activities: Activity[], days: DailySummary[]): PersonalRecord[] {
  const out: PersonalRecord[] = []
  const best = <T>(xs: T[], score: (x: T) => number) => xs.reduce<T | null>((b, x) => (b === null || score(x) > score(b) ? x : b), null)
  const runs = activities.filter((a) => RUNS.includes(a.sport) && a.distance_m > 0)

  for (const [key, label, meters] of [
    ['5k', 'Fastest 5K', 5000],
    ['10k', 'Fastest 10K', 10000],
    ['half', 'Fastest half marathon', 21097.5],
  ] as const) {
    const r = best(
      runs.filter((a) => a.distance_m >= meters),
      (a) => -a.moving_s / a.distance_m,
    )
    if (r) out.push({ key, label, kind: 'time', value: Math.round((r.moving_s / r.distance_m) * meters), date: r.date, activityId: r.id })
  }
  const longRun = best(runs, (a) => a.distance_m)
  if (longRun) out.push({ key: 'long-run', label: 'Longest run', kind: 'distance', value: longRun.distance_m, date: longRun.date, activityId: longRun.id })
  const longRide = best(
    activities.filter((a) => RIDES.includes(a.sport)),
    (a) => a.distance_m,
  )
  if (longRide) out.push({ key: 'long-ride', label: 'Longest ride', kind: 'distance', value: longRide.distance_m, date: longRide.date, activityId: longRide.id })
  const climb = best(activities, (a) => a.elevation_gain_m)
  if (climb && climb.elevation_gain_m > 0)
    out.push({ key: 'climb', label: 'Most elevation gain', kind: 'elevation', value: climb.elevation_gain_m, date: climb.date, activityId: climb.id })
  const longest = best(activities, (a) => a.duration_s)
  if (longest) out.push({ key: 'longest', label: 'Longest activity', kind: 'duration', value: longest.duration_s, date: longest.date, activityId: longest.id })
  const stepDay = best(days, (d) => d.steps)
  if (stepDay && stepDay.steps > 0) out.push({ key: 'steps', label: 'Most steps in a day', kind: 'steps', value: stepDay.steps, date: stepDay.date })
  return out
}

/** HRV status from the 7-day average against the personal baseline (Garmin-like bands). */
export function hrvStatus(avg7: number, baseline: number): HrvStatus {
  const r = avg7 / baseline
  if (r > 1.1) return 'unbalanced'
  if (r >= 0.92) return 'balanced'
  if (r >= 0.82) return 'unbalanced'
  if (r >= 0.7) return 'low'
  return 'poor'
}

// ---- Labels shared by several screens ----

export const sleepQuality = (score: number) => (score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Poor')
export const stressLevel = (v: number) => (v <= 25 ? 'Resting' : v <= 50 ? 'Low' : v <= 75 ? 'Medium' : 'High')
export const batteryLevel = (v: number) => (v >= 75 ? 'High' : v >= 50 ? 'Medium' : v >= 25 ? 'Low' : 'Very low')
export const readinessLevel = (v: number) => (v >= 75 ? 'High' : v >= 50 ? 'Moderate' : v >= 25 ? 'Low' : 'Poor')

export const HRV_LABEL: Record<HrvStatus, string> = { balanced: 'Balanced', unbalanced: 'Unbalanced', low: 'Low', poor: 'Poor' }
