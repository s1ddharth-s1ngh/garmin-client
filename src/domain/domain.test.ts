import { describe, expect, it } from 'vitest'
import { genActivities, genActivity, genDay, genIntraday, genSleep, type GenContext } from '../data/demoSeed'
import { addDays, eachDay } from '../lib/dates'
import { hms, unitFormat } from '../lib/format'
import { hrvStatus, personalRecords, streak, weeklyVolume } from './stats'
import { hrZones, loadSeries, predictRaceTime, recoveryHours, trainingStatus, trimp, zoneOf } from './training'
import type { Activity, DailySummary } from './types'

const act = (over: Partial<Activity>): Activity => ({
  id: 'a',
  date: '2026-11-02',
  start: '2026-11-02T07:00:00.000Z',
  name: 'Run',
  sport: 'running',
  duration_s: 3000,
  moving_s: 3000,
  distance_m: 10000,
  elevation_gain_m: 50,
  avg_hr: 150,
  max_hr: 170,
  kcal: 600,
  avg_speed: 3.33,
  max_speed: 4,
  avg_cadence: 170,
  aerobic_te: 3,
  anaerobic_te: 1,
  load: 100,
  device: 'Test',
  ...over,
})

describe('training', () => {
  it('trimp grows with intensity and duration', () => {
    expect(trimp(60, 150, 50, 190)).toBeGreaterThan(trimp(60, 130, 50, 190))
    expect(trimp(90, 150, 50, 190)).toBeGreaterThan(trimp(60, 150, 50, 190))
    expect(trimp(60, 40, 50, 190)).toBe(0)
  })

  it('predicts race times close to Daniels VDOT tables', () => {
    // VDOT 50: 5K 19:57, 10K 41:21, marathon 3:10:49.
    expect(Math.abs(predictRaceTime(50, 5000) - 1197)).toBeLessThan(15)
    expect(Math.abs(predictRaceTime(50, 10000) - 2481)).toBeLessThan(30)
    expect(Math.abs(predictRaceTime(50, 42195) - 11449)).toBeLessThan(120)
    expect(predictRaceTime(55, 5000)).toBeLessThan(predictRaceTime(50, 5000))
  })

  it('maps load ratio to status', () => {
    expect(trainingStatus(100, 0, 0)).toBe('no_status')
    expect(trainingStatus(200, 100, 0)).toBe('overreaching')
    expect(trainingStatus(100, 100, 1)).toBe('productive')
    expect(trainingStatus(100, 100, 0)).toBe('maintaining')
    expect(trainingStatus(70, 100, 0)).toBe('recovery')
    expect(trainingStatus(30, 100, 0)).toBe('detraining')
  })

  it('computes acute and chronic load', () => {
    const acts = [act({ date: '2026-11-01', load: 70 }), act({ date: '2026-11-10', load: 140 })]
    const [p] = loadSeries(acts, '2026-11-10', '2026-11-10')
    expect(p.acute).toBe(140)
    expect(p.chronic).toBe(53) // (70 + 140) / 4 = 52.5
  })

  it('zones and recovery', () => {
    expect(hrZones(200).map((z) => z.min)).toEqual([100, 120, 140, 160, 180])
    expect(zoneOf(95, 200)).toBe(0)
    expect(zoneOf(185, 200)).toBe(5)
    const now = new Date('2026-11-02T09:00:00Z')
    expect(recoveryHours([act({ start: '2026-11-02T07:00:00Z', duration_s: 3600, load: 100 })], now)).toBe(39)
    expect(recoveryHours([act({ start: '2026-10-20T07:00:00Z' })], now)).toBe(0)
  })
})

describe('stats', () => {
  const day = (date: string, steps: number) => ({ date, steps }) as DailySummary

  it('streak ignores an unfinished today', () => {
    const days = [day('2026-11-01', 12000), day('2026-11-02', 11000), day('2026-11-03', 3000)]
    expect(streak(days, (d) => d.steps >= 10000)).toBe(2)
    expect(streak([...days, day('2026-11-04', 10000)], (d) => d.steps >= 10000)).toBe(1)
  })

  it('weekly volume buckets by Monday', () => {
    const w = weeklyVolume([act({ date: '2026-11-16' }), act({ date: '2026-11-22' }), act({ date: '2026-11-15' })], 2, '2026-11-19')
    expect(w.map((x) => x.week)).toEqual(['2026-11-09', '2026-11-16'])
    expect(w.map((x) => x.count)).toEqual([1, 2])
  })

  it('personal records pick the fastest pace over the distance', () => {
    const r = personalRecords(
      [act({ id: 'slow', distance_m: 10000, moving_s: 3000 }), act({ id: 'fast', distance_m: 6000, moving_s: 1500 }), act({ id: 'ride', sport: 'cycling', distance_m: 80000 })],
      [],
    )
    const fivek = r.find((x) => x.key === '5k')!
    expect(fivek.activityId).toBe('fast')
    expect(fivek.value).toBe(1250)
    expect(r.find((x) => x.key === '10k')!.activityId).toBe('slow')
    expect(r.find((x) => x.key === 'long-ride')!.value).toBe(80000)
  })

  it('hrv status bands', () => {
    expect(hrvStatus(60, 60)).toBe('balanced')
    expect(hrvStatus(70, 60)).toBe('unbalanced')
    expect(hrvStatus(45, 60)).toBe('low')
    expect(hrvStatus(30, 60)).toBe('poor')
  })
})

describe('format', () => {
  it('pace, distance and time', () => {
    const m = unitFormat('metric')
    const i = unitFormat('imperial')
    expect(m.pace(1000 / 300)).toBe('5:00')
    expect(i.pace(1609.344 / 480)).toBe('8:00')
    expect(m.dist(8420)).toBe('8.42 km')
    expect(m.dist(123456)).toBe('123 km')
    expect(i.weight(100)).toBe('220.5 lb')
    expect(i.toKg(220.462)).toBeCloseTo(100, 2)
    expect(hms(3725)).toBe('1:02:05')
    expect(hms(605)).toBe('10:05')
  })
})

describe('demo data', () => {
  const ctx: GenContext = {
    seed: 'user-1',
    tz: 'Europe/Rome',
    maxHr: 190,
    device: 'Test',
    now: new Date('2026-11-19T15:00:00Z'),
    today: '2026-11-19',
    first: '2025-11-19',
  }

  it('is deterministic and stays inside the history window', () => {
    expect(genDay(ctx, '2026-10-01')).toEqual(genDay(ctx, '2026-10-01'))
    expect(genDay(ctx, '2025-11-18')).toBeNull()
    expect(genDay(ctx, '2026-11-20')).toBeNull()
  })

  it('sleep stages are contiguous and add up', () => {
    for (const d of eachDay('2026-10-01', '2026-10-20')) {
      const n = genSleep(ctx, d)
      if (!n) continue
      n.stages.forEach((s, i) => {
        expect(s.to).toBeGreaterThan(s.from)
        if (i) expect(s.from).toBe(n.stages[i - 1].to)
      })
      expect(n.deep_min + n.light_min + n.rem_min + n.awake_min).toBe(n.stages.at(-1)!.to)
      expect(n.score).toBeGreaterThanOrEqual(30)
      expect(n.score).toBeLessThanOrEqual(98)
    }
  })

  it('activities have consistent details', () => {
    const acts = eachDay('2026-10-01', '2026-10-31').flatMap((d) => genActivities(ctx, d))
    expect(acts.length).toBeGreaterThan(10)
    for (const a of acts.slice(0, 8)) {
      const d = genActivity(ctx, a.id)!
      expect(d.zones.reduce((s, z) => s + z, 0)).toBeCloseTo(a.duration_s, -1)
      if (a.distance_m) expect(Math.abs(d.laps.reduce((s, l) => s + l.distance_m, 0) - a.distance_m)).toBeLessThan(a.distance_m * 0.03)
      expect(d.samples.every((s) => s.hr <= a.max_hr)).toBe(true)
    }
  })

  it('today only shows what already happened', () => {
    const intra = genIntraday(ctx, ctx.today)!
    const nowSlot = Math.floor((16 * 60) / 15) // 15:00 UTC = 16:00 in Rome
    expect(intra.hr[nowSlot - 1]).not.toBeNull()
    expect(intra.hr[nowSlot + 1]).toBeNull()
    expect(genActivities(ctx, addDays(ctx.today, 1))).toEqual([])
  })
})
