import type { ISODate } from '../lib/dates'

// Rows mirror what the Garmin Connect Personal API returns, flattened to what the app shows.
// Docs: https://developer.garmin.com/gc-developer-program/personal/personal-api

export type Units = 'metric' | 'imperial'

export interface Goals {
  steps: number
  floors: number
  /** Weekly moderate + 2× vigorous minutes (WHO / Garmin intensity minutes). */
  intensity_min: number
  sleep_min: number
  weight_kg: number | null
}

export interface Profile {
  id: string
  name: string
  avatar_color: string
  /** Cover color, doubles as the app accent. null = default pink. */
  cover_color: string | null
  timezone: string
  units: Units
  birth_year: number
  height_cm: number
  /** null = estimated as 220 − age. */
  max_hr: number | null
  goals: Goals
  created_at: string
}

export interface GarminLink {
  key_last4: string
  connected_at: string
  last_sync_at: string | null
  /** Primary device as reported by Garmin. */
  device: string
}

export type HrvStatus = 'balanced' | 'unbalanced' | 'low' | 'poor'

/** One calendar day (user's timezone) of Garmin daily summary + wellness data. */
export interface DailySummary {
  date: ISODate
  steps: number
  floors: number
  distance_m: number
  active_kcal: number
  total_kcal: number
  moderate_min: number
  vigorous_min: number
  resting_hr: number | null
  min_hr: number | null
  max_hr: number | null
  avg_stress: number | null
  max_stress: number | null
  /** Body Battery 0–100. */
  bb_high: number | null
  bb_low: number | null
  bb_charged: number | null
  bb_drained: number | null
  spo2: number | null
  respiration: number | null
  /** Last-night HRV average, ms. */
  hrv: number | null
  hrv_status: HrvStatus | null
  /** Training readiness 0–100. */
  readiness: number | null
  vo2max: number | null
  updated_at: string
}

/** 15-minute samples for one day; index i covers minutes [i*15, i*15+15). null = no data (future or not worn). */
export interface Intraday {
  date: ISODate
  hr: (number | null)[]
  stress: (number | null)[]
  battery: (number | null)[]
  steps: (number | null)[]
}

export type SleepStage = 'deep' | 'light' | 'rem' | 'awake'

export interface SleepSegment {
  stage: SleepStage
  /** Minutes from sleep start. */
  from: number
  to: number
}

/** One night; `date` is the wake-up date. */
export interface SleepNight {
  date: ISODate
  start: string
  end: string
  score: number
  deep_min: number
  light_min: number
  rem_min: number
  awake_min: number
  stages: SleepSegment[]
  avg_hr: number
  avg_respiration: number
  avg_spo2: number
  restless: number
  hrv: number
}

export type Sport =
  | 'running'
  | 'trail_running'
  | 'cycling'
  | 'indoor_cycling'
  | 'walking'
  | 'hiking'
  | 'swimming'
  | 'strength'
  | 'yoga'
  | 'hiit'

export interface Activity {
  id: string
  date: ISODate
  start: string
  name: string
  sport: Sport
  duration_s: number
  moving_s: number
  /** 0 for sports without distance. */
  distance_m: number
  elevation_gain_m: number
  avg_hr: number
  max_hr: number
  kcal: number
  /** m/s, 0 when not applicable. */
  avg_speed: number
  max_speed: number
  avg_cadence: number | null
  /** Garmin Training Effect, 0–5. */
  aerobic_te: number
  anaerobic_te: number
  /** Training load of the session (EPOC-like). */
  load: number
  device: string
}

export interface ActivitySample {
  /** Seconds from start. */
  t: number
  hr: number
  /** m/s */
  speed: number
  elevation: number
  cadence: number | null
}

export interface Lap {
  distance_m: number
  duration_s: number
  avg_hr: number
  elevation_gain_m: number
}

export interface StrengthSet {
  exercise: string
  reps: number
  weight_kg: number
}

export interface ActivityDetail extends Activity {
  samples: ActivitySample[]
  /** [lat, lng] points; null for indoor sports. */
  route: [number, number][] | null
  laps: Lap[]
  /** Seconds in heart-rate zones 1–5. */
  zones: number[]
  sets: StrengthSet[] | null
}

export interface WeightEntry {
  date: ISODate
  kg: number
  body_fat: number | null
  source: 'garmin' | 'manual'
}
