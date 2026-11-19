import { AVATAR_COLORS, DEFAULT_GOALS } from '../config/app'
import { maxHrFor } from '../domain/training'
import type { GarminLink, Profile, WeightEntry } from '../domain/types'
import { addDays, browserTimezone, dateIn, eachDay, todayIn, type ISODate } from '../lib/dates'
import { genActivities, genActivity, genDay, genIntraday, genSleep, genWeights, type GenContext } from './demoSeed'
import type { Repo } from './repo'

// Demo backend: accounts and settings in localStorage, Garmin data generated (demoSeed.ts).
const KEY = 'peak:demo'

interface Stored {
  // shortcut: demo passwords are stored as typed, on this device only. Real auth comes with Supabase.
  users: { id: string; email: string; password: string }[]
  session: string | null
  profiles: Record<string, Profile>
  garmin: Record<string, GarminLink>
  /** Manual weigh-ins and hidden generated ones, per user. */
  weights: Record<string, WeightEntry[]>
  hiddenWeights: Record<string, ISODate[]>
}

const empty = (): Stored => ({ users: [], session: null, profiles: {}, garmin: {}, weights: {}, hiddenWeights: {} })

function load(): Stored {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return empty()
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Small random delay so loading states look like a real network. */
const net = () => wait(120 + Math.random() * 220)

export function createLocalRepo(): Repo {
  let db = load()
  const authListeners = new Set<() => void>()
  const dataListeners = new Set<() => void>()
  const save = () => localStorage.setItem(KEY, JSON.stringify(db))
  const notifyAuth = () => authListeners.forEach((l) => l())
  const notifyData = () => dataListeners.forEach((l) => l())

  // Other tabs: reload and refresh everything.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    db = load()
    notifyAuth()
    notifyData()
  })

  const me = () => {
    const id = db.session
    if (!id || !db.profiles[id]) throw new Error('Not signed in')
    return id
  }

  const ctx = (): GenContext | null => {
    const id = me()
    const link = db.garmin[id]
    if (!link) return null
    const p = db.profiles[id]
    const now = new Date()
    return {
      seed: id,
      tz: p.timezone,
      maxHr: maxHrFor(p, now.getFullYear()),
      device: link.device,
      now,
      today: todayIn(p.timezone, now),
      first: addDays(dateIn(link.connected_at, p.timezone), -365),
    }
  }

  const repo: Repo = {
    kind: 'local',

    async getUser() {
      const u = db.users.find((x) => x.id === db.session)
      return u ? { id: u.id, email: u.email } : null
    },
    async signUp(email, password, name) {
      await net()
      const e = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Enter a valid email address.')
      if (password.length < 6) throw new Error('Use at least 6 characters for your password.')
      if (db.users.some((u) => u.email === e)) throw new Error('An account with this email already exists.')
      const id = crypto.randomUUID()
      db.users.push({ id, email: e, password })
      db.profiles[id] = {
        id,
        name: name.trim() || e.split('@')[0],
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        cover_color: null,
        timezone: browserTimezone(),
        units: 'metric',
        birth_year: 1992,
        height_cm: 178,
        max_hr: null,
        goals: { ...DEFAULT_GOALS },
        created_at: new Date().toISOString(),
      }
      db.session = id
      save()
      notifyAuth()
    },
    async signIn(email, password) {
      await net()
      const u = db.users.find((x) => x.email === email.trim().toLowerCase())
      if (!u || u.password !== password) throw new Error('Wrong email or password.')
      db.session = u.id
      save()
      notifyAuth()
    },
    async signOut() {
      db.session = null
      save()
      notifyAuth()
    },
    onAuthChange(cb) {
      authListeners.add(cb)
      return () => void authListeners.delete(cb)
    },

    async getProfile(userId) {
      return db.profiles[userId] ?? null
    },
    async saveProfile(input) {
      await net()
      const id = me()
      db.profiles[id] = { ...db.profiles[id], ...input, goals: { ...db.profiles[id].goals, ...input.goals } }
      save()
      notifyAuth()
      notifyData()
      return db.profiles[id]
    },

    async getGarmin() {
      return db.garmin[me()] ?? null
    },
    async connectGarmin(apiKey) {
      const key = apiKey.trim()
      await wait(1400)
      if (key.length < 8 || /\s/.test(key)) throw new Error('That does not look like a Garmin Personal API key. Copy it again from Garmin Connect.')
      const now = new Date().toISOString()
      db.garmin[me()] = { key_last4: key.slice(-4), connected_at: now, last_sync_at: now, device: 'Forerunner 965' }
      save()
      notifyAuth()
      notifyData()
    },
    async syncGarmin() {
      const id = me()
      if (!db.garmin[id]) throw new Error('Connect Garmin first.')
      await wait(1300)
      db.garmin[id].last_sync_at = new Date().toISOString()
      save()
      notifyAuth()
      notifyData()
      return 7
    },
    async disconnectGarmin() {
      await net()
      delete db.garmin[me()]
      save()
      notifyAuth()
      notifyData()
    },

    async listDays(from, to) {
      await net()
      const c = ctx()
      return c ? eachDay(from, to).flatMap((d) => genDay(c, d) ?? []) : []
    },
    async getIntraday(date) {
      await net()
      const c = ctx()
      return c ? genIntraday(c, date) : null
    },
    async listSleep(from, to) {
      await net()
      const c = ctx()
      return c ? eachDay(from, to).flatMap((d) => genSleep(c, d) ?? []) : []
    },
    async listActivities(from, to) {
      await net()
      const c = ctx()
      return c ? eachDay(from, to).flatMap((d) => genActivities(c, d)).reverse() : []
    },
    async getActivity(id) {
      await net()
      const c = ctx()
      return c ? genActivity(c, id) : null
    },
    async listWeights(from, to) {
      await net()
      const c = ctx()
      const id = me()
      const hidden = new Set(db.hiddenWeights[id] ?? [])
      const manual = (db.weights[id] ?? []).filter((w) => w.date >= from && w.date <= to)
      const byDate = new Map<ISODate, WeightEntry>()
      for (const w of c ? genWeights(c, from, to) : []) if (!hidden.has(w.date)) byDate.set(w.date, w)
      for (const w of manual) byDate.set(w.date, w)
      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
    },
    async addWeight(date, kg) {
      await net()
      if (!(kg > 20 && kg < 400)) throw new Error('Enter a weight between 20 and 400 kg.')
      const id = me()
      db.weights[id] = [...(db.weights[id] ?? []).filter((w) => w.date !== date), { date, kg: Math.round(kg * 10) / 10, body_fat: null, source: 'manual' }]
      save()
      notifyData()
    },
    async deleteWeight(date) {
      await net()
      const id = me()
      db.weights[id] = (db.weights[id] ?? []).filter((w) => w.date !== date)
      db.hiddenWeights[id] = [...new Set([...(db.hiddenWeights[id] ?? []), date])]
      save()
      notifyData()
    },

    subscribe(cb) {
      dataListeners.add(cb)
      return () => void dataListeners.delete(cb)
    },

    demo: {
      reset() {
        localStorage.removeItem(KEY)
        db = empty()
        notifyAuth()
        notifyData()
      },
    },
  }
  return repo
}
