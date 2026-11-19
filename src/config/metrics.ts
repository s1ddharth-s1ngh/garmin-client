import { Activity, BatteryCharging, Brain, Droplets, Flame, Footprints, Gauge, HeartPulse, MoonStar, Scale, TrendingUp, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { Tone } from '../components/ui'
import { sleepQuality, stressLevel, batteryLevel } from '../domain/stats'
import type { DailySummary, SleepNight, WeightEntry } from '../domain/types'
import type { ISODate } from '../lib/dates'
import { compact, duration, formatNumber, type UnitFormat } from '../lib/format'

export type MetricKey =
  | 'resting_hr'
  | 'hrv'
  | 'stress'
  | 'body_battery'
  | 'sleep_score'
  | 'sleep_time'
  | 'steps'
  | 'floors'
  | 'calories'
  | 'intensity'
  | 'spo2'
  | 'respiration'
  | 'vo2max'
  | 'weight'

export interface MetricSource {
  day?: DailySummary
  sleep?: SleepNight
  weight?: WeightEntry
}

export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  icon: LucideIcon
  tone: Tone
  /** Which direction is good; drives the color of the change chip. */
  better: 'higher' | 'lower' | 'none'
  chart: 'line' | 'bar'
  about: string
  value: (s: MetricSource) => number | null
  format: (v: number, u: UnitFormat) => string
  /** Optional word for a value ("Good", "Low"…). */
  level?: (v: number) => string
}

const round = (v: number) => formatNumber(v)

export const METRICS: Record<MetricKey, MetricDef> = {
  resting_hr: {
    key: 'resting_hr',
    label: 'Resting heart rate',
    unit: 'bpm',
    icon: HeartPulse,
    tone: 'heart',
    better: 'lower',
    chart: 'line',
    about: 'Your lowest 30-minute average heart rate of the day. A falling trend usually means better fitness; a sudden rise can mean stress, illness or poor recovery.',
    value: (s) => s.day?.resting_hr ?? null,
    format: round,
  },
  hrv: {
    key: 'hrv',
    label: 'HRV',
    unit: 'ms',
    icon: Activity,
    tone: 'train',
    better: 'higher',
    chart: 'line',
    about: 'Heart rate variability measured overnight. Compare it with your own baseline, not with other people: values above your normal range mean good recovery.',
    value: (s) => s.day?.hrv ?? null,
    format: round,
  },
  stress: {
    key: 'stress',
    label: 'Stress',
    unit: '',
    icon: Brain,
    tone: 'stress',
    better: 'lower',
    chart: 'bar',
    about: 'Average all-day stress from 0 to 100, estimated from heart rate variability. Activities are left out.',
    value: (s) => s.day?.avg_stress ?? null,
    format: round,
    level: stressLevel,
  },
  body_battery: {
    key: 'body_battery',
    label: 'Body Battery',
    unit: '',
    icon: BatteryCharging,
    tone: 'battery',
    better: 'higher',
    chart: 'bar',
    about: 'Your energy reserve from 0 to 100. It charges while you sleep and rest, and drains with stress and activity. Shown here: the daily high.',
    value: (s) => s.day?.bb_high ?? null,
    format: round,
    level: batteryLevel,
  },
  sleep_score: {
    key: 'sleep_score',
    label: 'Sleep score',
    unit: '',
    icon: MoonStar,
    tone: 'sleep',
    better: 'higher',
    chart: 'bar',
    about: 'A 0–100 summary of last night: duration, deep and REM sleep, awake time and how restful it was.',
    value: (s) => s.sleep?.score ?? null,
    format: round,
    level: sleepQuality,
  },
  sleep_time: {
    key: 'sleep_time',
    label: 'Sleep duration',
    unit: '',
    icon: MoonStar,
    tone: 'sleep',
    better: 'higher',
    chart: 'bar',
    about: 'Total time asleep, without awake periods. Most adults need 7 to 9 hours.',
    value: (s) => (s.sleep ? s.sleep.deep_min + s.sleep.light_min + s.sleep.rem_min : null),
    format: (v) => duration(v),
  },
  steps: {
    key: 'steps',
    label: 'Steps',
    unit: 'steps',
    icon: Footprints,
    tone: 'steps',
    better: 'higher',
    chart: 'bar',
    about: 'All steps counted by your watch during the day.',
    value: (s) => s.day?.steps ?? null,
    format: (v) => compact(v),
  },
  floors: {
    key: 'floors',
    label: 'Floors climbed',
    unit: 'floors',
    icon: TrendingUp,
    tone: 'train',
    better: 'higher',
    chart: 'bar',
    about: 'One floor is about 3 m (10 ft) of climbing, measured by the barometric altimeter.',
    value: (s) => s.day?.floors ?? null,
    format: round,
  },
  calories: {
    key: 'calories',
    label: 'Active calories',
    unit: 'kcal',
    icon: Flame,
    tone: 'stress',
    better: 'higher',
    chart: 'bar',
    about: 'Calories burned by movement and workouts, on top of your resting metabolism.',
    value: (s) => s.day?.active_kcal ?? null,
    format: round,
  },
  intensity: {
    key: 'intensity',
    label: 'Intensity minutes',
    unit: 'min',
    icon: Zap,
    tone: 'star',
    better: 'higher',
    chart: 'bar',
    about: 'Minutes of moderate activity plus double the vigorous ones. Health bodies suggest 150 a week.',
    value: (s) => (s.day ? s.day.moderate_min + 2 * s.day.vigorous_min : null),
    format: round,
  },
  spo2: {
    key: 'spo2',
    label: 'Pulse Ox',
    unit: '%',
    icon: Droplets,
    tone: 'battery',
    better: 'higher',
    chart: 'line',
    about: 'Average blood oxygen saturation during sleep. Most healthy people sit between 95 and 100%.',
    value: (s) => s.day?.spo2 ?? null,
    format: round,
  },
  respiration: {
    key: 'respiration',
    label: 'Respiration',
    unit: 'brpm',
    icon: Wind,
    tone: 'train',
    better: 'none',
    chart: 'line',
    about: 'Average breaths per minute while asleep. Stable values are a good sign; a jump can come with illness.',
    value: (s) => s.day?.respiration ?? null,
    format: (v) => v.toFixed(1),
  },
  vo2max: {
    key: 'vo2max',
    label: 'VO2 max',
    unit: 'ml/kg/min',
    icon: Gauge,
    tone: 'steps',
    better: 'higher',
    chart: 'line',
    about: 'The most oxygen your body can use during hard effort, estimated from outdoor runs with heart rate. The best single number for aerobic fitness.',
    value: (s) => s.day?.vo2max ?? null,
    format: (v) => v.toFixed(0),
  },
  weight: {
    key: 'weight',
    label: 'Weight',
    unit: '',
    icon: Scale,
    tone: 'brand',
    better: 'none',
    chart: 'line',
    about: 'Weigh-ins from your Garmin scale or added by hand. Daily changes are mostly water; watch the trend.',
    value: (s) => s.weight?.kg ?? null,
    format: (v, u) => u.weight(v),
  },
}

/** Values of a metric per date (null where unknown). */
export function seriesFor(key: MetricKey, dates: ISODate[], data: { days?: DailySummary[]; sleep?: SleepNight[]; weights?: WeightEntry[] }): (number | null)[] {
  const days = new Map(data.days?.map((d) => [d.date, d]))
  const sleep = new Map(data.sleep?.map((n) => [n.date, n]))
  const weights = new Map(data.weights?.map((w) => [w.date, w]))
  return dates.map((d) => METRICS[key].value({ day: days.get(d), sleep: sleep.get(d), weight: weights.get(d) }))
}

