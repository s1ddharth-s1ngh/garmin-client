import type { Units } from '../domain/types'

const nf = new Intl.NumberFormat('en-US')

export const formatNumber = (n: number) => nf.format(Math.round(n))

/** 9488 → "9.5k", 12000 → "12k", 950 → "950" */
export function compact(n: number): string {
  if (n < 1000) return String(Math.round(n))
  const k = n / 1000
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`
}

/** 475 → "7h 55m" */
export function duration(minutes: number): string {
  const m = Math.round(minutes)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}m`
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

/** 3725 → "1:02:05", 605 → "10:05" */
export function hms(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

export const greeting = (hour: number) => (hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening')

// ---- Units ----

const KM_PER_MI = 1.609344
const FT_PER_M = 3.28084
const LB_PER_KG = 2.20462

const fixed = (n: number, d: number) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Formatters bound to the user's unit system. Distances in meters, speeds in m/s. */
export function unitFormat(units: Units) {
  const imp = units === 'imperial'
  const distUnit = imp ? 'mi' : 'km'
  const toDist = (m: number) => (imp ? m / 1000 / KM_PER_MI : m / 1000)
  return {
    units,
    distUnit,
    elevUnit: imp ? 'ft' : 'm',
    weightUnit: imp ? 'lb' : 'kg',
    paceUnit: `/${distUnit}`,
    speedUnit: imp ? 'mph' : 'km/h',
    /** Distance as a number in km or mi. */
    toDist,
    /** "8.42" (no unit); fewer decimals for long distances. */
    distNum: (m: number) => fixed(toDist(m), toDist(m) >= 100 ? 0 : toDist(m) >= 10 ? 1 : 2),
    dist: (m: number) => `${fixed(toDist(m), toDist(m) >= 100 ? 0 : toDist(m) >= 10 ? 1 : 2)} ${distUnit}`,
    /** Pace "5:12" per km or mile; "–" when not moving. */
    pace: (mps: number) => (mps > 0.3 ? hms((imp ? KM_PER_MI * 1000 : 1000) / mps) : '–'),
    speed: (mps: number) => fixed(imp ? (mps * 3.6) / KM_PER_MI : mps * 3.6, 1),
    elevNum: (m: number) => (imp ? m * FT_PER_M : m),
    elev: (m: number) => `${formatNumber(imp ? m * FT_PER_M : m)} ${imp ? 'ft' : 'm'}`,
    weightNum: (kg: number) => (imp ? kg * LB_PER_KG : kg),
    weight: (kg: number) => `${fixed(imp ? kg * LB_PER_KG : kg, 1)} ${imp ? 'lb' : 'kg'}`,
    /** User-typed weight back to kg. */
    toKg: (v: number) => (imp ? v / LB_PER_KG : v),
  }
}

export type UnitFormat = ReturnType<typeof unitFormat>
