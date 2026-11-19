import { Bike, CalendarCheck, Crown, Footprints, Medal, MoonStar, Mountain, Sparkles, Sunrise, Trophy, Watch, Zap, type LucideIcon } from 'lucide-react'
import type { Tone } from '../components/ui'
import type { Activity, DailySummary, Goals, SleepNight } from '../domain/types'
import { addDays, minutesOfDayIn, startOfWeek, type ISODate } from '../lib/dates'

export interface BadgeData {
  /** Oldest first. */
  activities: Activity[]
  days: DailySummary[]
  sleep: SleepNight[]
  goals: Goals
  tz: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: LucideIcon
  tone: Tone
  /** Date it was earned, or null. Badges are computed from data, never stored. */
  earned: (d: BadgeData) => ISODate | null
  progress?: (d: BadgeData) => [number, number]
}

const firstWhere = <T extends { date: ISODate }>(xs: T[], ok: (x: T) => boolean) => xs.find(ok)?.date ?? null
const nth = <T extends { date: ISODate }>(xs: T[], ok: (x: T) => boolean, n: number) => xs.filter(ok)[n - 1]?.date ?? null
const best = <T>(xs: T[], f: (x: T) => number) => xs.reduce((m, x) => Math.max(m, f(x)), 0)
const isRun = (a: Activity) => a.sport === 'running' || a.sport === 'trail_running'
const isRide = (a: Activity) => a.sport === 'cycling'

/** Date the step goal was first hit `n` days in a row, and the longest run of such days. */
function stepStreak(d: BadgeData, n: number): { at: ISODate | null; longest: number } {
  let run = 0
  let longest = 0
  let at: ISODate | null = null
  for (const day of d.days) {
    run = day.steps >= d.goals.steps ? run + 1 : 0
    longest = Math.max(longest, run)
    if (run >= n && !at) at = day.date
  }
  return { at, longest }
}

/** First week ending a run of `n` consecutive weeks with at least 3 activities. */
function activeWeeks(d: BadgeData, n: number): { at: ISODate | null; longest: number } {
  const counts = new Map<ISODate, number>()
  for (const a of d.activities) counts.set(startOfWeek(a.date), (counts.get(startOfWeek(a.date)) ?? 0) + 1)
  const weeks = [...counts.keys()].sort()
  if (!weeks.length) return { at: null, longest: 0 }
  let run = 0
  let longest = 0
  let at: ISODate | null = null
  for (let w = weeks[0]; w <= weeks[weeks.length - 1]; w = addDays(w, 7)) {
    run = (counts.get(w) ?? 0) >= 3 ? run + 1 : 0
    longest = Math.max(longest, run)
    if (run >= n && !at) at = addDays(w, 6)
  }
  return { at, longest }
}

export const BADGES: Badge[] = [
  {
    id: 'first',
    name: 'First sync',
    description: 'Your first activity in Peak',
    icon: Watch,
    tone: 'brand',
    earned: (d) => d.activities[0]?.date ?? null,
  },
  {
    id: 'half',
    name: 'Half marathon',
    description: 'Run 21.1 km in one go',
    icon: Medal,
    tone: 'steps',
    earned: (d) => firstWhere(d.activities, (a) => isRun(a) && a.distance_m >= 21097),
    progress: (d) => [Math.round(best(d.activities.filter(isRun), (a) => a.distance_m) / 1000), 21],
  },
  {
    id: 'marathon',
    name: 'Marathoner',
    description: 'Run 42.2 km in one go',
    icon: Crown,
    tone: 'star',
    earned: (d) => firstWhere(d.activities, (a) => isRun(a) && a.distance_m >= 42195),
    progress: (d) => [Math.round(best(d.activities.filter(isRun), (a) => a.distance_m) / 1000), 42],
  },
  {
    id: 'century',
    name: 'Century ride',
    description: 'Ride 100 km in one go',
    icon: Bike,
    tone: 'battery',
    earned: (d) => firstWhere(d.activities, (a) => isRide(a) && a.distance_m >= 100_000),
    progress: (d) => [Math.round(best(d.activities.filter(isRide), (a) => a.distance_m) / 1000), 100],
  },
  {
    id: 'climber',
    name: 'Climber',
    description: '1,000 m of climbing in one activity',
    icon: Mountain,
    tone: 'train',
    earned: (d) => firstWhere(d.activities, (a) => a.elevation_gain_m >= 1000),
    progress: (d) => [best(d.activities, (a) => a.elevation_gain_m), 1000],
  },
  {
    id: 'early',
    name: 'Early bird',
    description: '10 activities started before 7:00',
    icon: Sunrise,
    tone: 'star',
    earned: (d) => nth(d.activities, (a) => minutesOfDayIn(a.start, d.tz) < 420, 10),
    progress: (d) => [d.activities.filter((a) => minutesOfDayIn(a.start, d.tz) < 420).length, 10],
  },
  {
    id: 'streak',
    name: 'Step streak',
    description: 'Step goal 7 days in a row',
    icon: Footprints,
    tone: 'steps',
    earned: (d) => stepStreak(d, 7).at,
    progress: (d) => [stepStreak(d, 7).longest, 7],
  },
  {
    id: 'steps30',
    name: '30 goal days',
    description: 'Reach your step goal on 30 days',
    icon: Trophy,
    tone: 'star',
    earned: (d) => nth(d.days, (x) => x.steps >= d.goals.steps, 30),
    progress: (d) => [d.days.filter((x) => x.steps >= d.goals.steps).length, 30],
  },
  {
    id: 'sleeper',
    name: 'Deep sleeper',
    description: 'A sleep score of 90 or more',
    icon: MoonStar,
    tone: 'sleep',
    earned: (d) => firstWhere(d.sleep, (n) => n.score >= 90),
    progress: (d) => [best(d.sleep, (n) => n.score), 90],
  },
  {
    id: 'consistent',
    name: 'Consistent',
    description: '4 weeks in a row with 3+ activities',
    icon: CalendarCheck,
    tone: 'train',
    earned: (d) => activeWeeks(d, 4).at,
    progress: (d) => [activeWeeks(d, 4).longest, 4],
  },
  {
    id: 'zen',
    name: 'Zen',
    description: '10 yoga sessions',
    icon: Sparkles,
    tone: 'sleep',
    earned: (d) => nth(d.activities, (a) => a.sport === 'yoga', 10),
    progress: (d) => [d.activities.filter((a) => a.sport === 'yoga').length, 10],
  },
  {
    id: 'hundred',
    name: 'Century club',
    description: '100 activities',
    icon: Zap,
    tone: 'heart',
    earned: (d) => d.activities[99]?.date ?? null,
    progress: (d) => [d.activities.length, 100],
  },
]
