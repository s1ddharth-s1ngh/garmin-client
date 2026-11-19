import { addDays, eachDay, type ISODate } from '../lib/dates'
import type { Activity, Profile } from './types'

// Pure training math. Numbers are close to Garmin's public descriptions, not Firstbeat's private formulas.

/** Banister TRIMP: minutes × HR-reserve fraction × 0.64·e^(1.92·x). */
export function trimp(minutes: number, avgHr: number, restHr: number, maxHr: number): number {
  const x = Math.max(0, Math.min(1, (avgHr - restHr) / (maxHr - restHr)))
  return Math.round(minutes * x * 0.64 * Math.exp(1.92 * x))
}

export const maxHrFor = (p: Pick<Profile, 'max_hr' | 'birth_year'>, year: number) => p.max_hr ?? 220 - (year - p.birth_year)

/** Five zones as % of max HR: 50–60, 60–70, 70–80, 80–90, 90–100. */
export const ZONE_PCT = [0.5, 0.6, 0.7, 0.8, 0.9, 1] as const

export function hrZones(maxHr: number) {
  return [1, 2, 3, 4, 5].map((z) => ({ zone: z, min: Math.round(ZONE_PCT[z - 1] * maxHr), max: Math.round(ZONE_PCT[z] * maxHr) }))
}

/** 0 = below zone 1, else 1–5. */
export function zoneOf(hr: number, maxHr: number): number {
  const p = hr / maxHr
  for (let z = 5; z >= 1; z--) if (p >= ZONE_PCT[z - 1]) return z
  return 0
}

export interface LoadPoint {
  date: ISODate
  /** Sum of the last 7 days. */
  acute: number
  /** Weekly average of the last 28 days. */
  chronic: number
  /** acute / chronic, 0 when there is no chronic load. */
  ratio: number
}

/** Acute and chronic load per day in [from, to]. Needs activities from 27 days before `from`. */
export function loadSeries(activities: Pick<Activity, 'date' | 'load'>[], from: ISODate, to: ISODate): LoadPoint[] {
  const perDay = new Map<ISODate, number>()
  for (const a of activities) perDay.set(a.date, (perDay.get(a.date) ?? 0) + a.load)
  const window = (end: ISODate, days: number) => {
    let s = 0
    for (let i = 0; i < days; i++) s += perDay.get(addDays(end, -i)) ?? 0
    return s
  }
  return eachDay(from, to).map((date) => {
    const acute = window(date, 7)
    const chronic = window(date, 28) / 4
    return { date, acute: Math.round(acute), chronic: Math.round(chronic), ratio: chronic > 0 ? acute / chronic : 0 }
  })
}

export type TrainingStatus = 'no_status' | 'detraining' | 'recovery' | 'maintaining' | 'productive' | 'overreaching'

/** Status from the acute:chronic ratio and the VO2 max trend (points over the last weeks). */
export function trainingStatus(acute: number, chronic: number, vo2Trend: number): TrainingStatus {
  if (chronic <= 0) return 'no_status'
  const r = acute / chronic
  if (r > 1.5) return 'overreaching'
  if (r >= 0.85) return vo2Trend > 0.2 ? 'productive' : 'maintaining'
  if (r >= 0.6) return 'recovery'
  return 'detraining'
}

export const STATUS_INFO: Record<TrainingStatus, { label: string; text: string; tone: 'train' | 'battery' | 'star' | 'stress' | 'heart' | 'muted' }> = {
  no_status: { label: 'No status', text: 'Log a few weeks of activities to get a status.', tone: 'muted' },
  detraining: { label: 'Detraining', text: 'Much lighter training than usual. Fitness starts to fade.', tone: 'stress' },
  recovery: { label: 'Recovery', text: 'A lighter week lets your body recover.', tone: 'battery' },
  maintaining: { label: 'Maintaining', text: 'Your load keeps your fitness where it is.', tone: 'star' },
  productive: { label: 'Productive', text: 'Your load is improving your fitness.', tone: 'train' },
  overreaching: { label: 'Overreaching', text: 'Load is far above your usual. Plan some rest.', tone: 'heart' },
}

// ---- Race predictions (Jack Daniels' VDOT model; Garmin's predictor is also VO2 max based) ----

const vo2At = (metersPerMin: number) => -4.6 + 0.182258 * metersPerMin + 0.000104 * metersPerMin ** 2
const pctMax = (minutes: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)

/** Race time in seconds for `meters` at a given VDOT (≈ VO2 max), solved by bisection. */
export function predictRaceTime(vdot: number, meters: number): number {
  let lo = 1
  let hi = 1500
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (vo2At(meters / mid) / pctMax(mid) > vdot) lo = mid
    else hi = mid
  }
  return Math.round(((lo + hi) / 2) * 60)
}

export const RACES = [
  { key: '5k', label: '5K', meters: 5000 },
  { key: '10k', label: '10K', meters: 10000 },
  { key: 'half', label: 'Half marathon', meters: 21097.5 },
  { key: 'marathon', label: 'Marathon', meters: 42195 },
] as const

export function trainingEffectLabel(te: number): string {
  if (te >= 5) return 'Overreaching'
  if (te >= 4) return 'Highly improving'
  if (te >= 3) return 'Improving'
  if (te >= 2) return 'Maintaining'
  if (te >= 1) return 'Minor benefit'
  return 'No benefit'
}

/** Hours of recovery still needed at `now`: each session asks for ~0.4 h per load point, from its end. */
export function recoveryHours(activities: Pick<Activity, 'start' | 'duration_s' | 'load'>[], now: Date): number {
  let left = 0
  for (const a of activities) {
    const end = new Date(a.start).getTime() + a.duration_s * 1000
    const need = Math.min(96, Math.max(6, a.load * 0.4)) * 3_600_000
    left = Math.max(left, end + need - now.getTime())
  }
  return Math.max(0, Math.round(left / 3_600_000))
}

/** Weekly intensity minutes: moderate + 2 × vigorous. */
export const intensityMinutes = (days: { moderate_min: number; vigorous_min: number }[]) =>
  days.reduce((s, d) => s + d.moderate_min + 2 * d.vigorous_min, 0)

/** VO2 max change between the first and last known value in a list (oldest first). */
export function trend(values: (number | null)[]): number {
  const known = values.filter((v): v is number => v != null)
  return known.length < 2 ? 0 : known[known.length - 1] - known[0]
}
