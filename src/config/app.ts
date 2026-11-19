import type { Goals } from '../domain/types'

// Product identity. Rename the app here (and in index.html title).
export const APP = {
  name: 'Peak',
  tagline: 'Your Garmin data, beautifully. Activities, sleep, recovery and training in one place.',
} as const

/** Default app accent (pink), shown when the user has no cover color. Matches --brand in src/index.css. */
export const DEFAULT_ACCENT = '#e01d61'

/** Accent / cover colors the user can pick. */
export const ACCENTS = ['#e01d61', '#4f46e5', '#0b84f3', '#0d9488', '#f2700f', '#16161a'] as const

export const AVATAR_COLORS = ['#4f46e5', '#db2777', '#f2700f', '#0fa36b', '#0284c7', '#475569'] as const

export const DEFAULT_GOALS: Goals = { steps: 10000, floors: 10, intensity_min: 150, sleep_min: 480, weight_kg: null }

/** Where users create a Garmin Connect Personal API key. */
export const GARMIN_KEY_URL = 'https://connect.garmin.com/modern/settings'
export const GARMIN_DOCS_URL = 'https://developer.garmin.com/gc-developer-program/personal/personal-api'
