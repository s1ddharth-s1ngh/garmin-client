import type { ISODate } from '../lib/dates'
import type { Activity, ActivityDetail, DailySummary, GarminLink, Intraday, Profile, SleepNight, WeightEntry } from '../domain/types'
import { createLocalRepo } from './localRepo'

export interface AuthUser {
  id: string
  email: string
}

export type ProfileInput = Partial<Omit<Profile, 'id' | 'created_at'>>

/** Everything the UI needs from a backend. Screens never talk to a backend directly. */
export interface Repo {
  readonly kind: 'local' | 'supabase'

  getUser(): Promise<AuthUser | null>
  signUp(email: string, password: string, name: string): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  onAuthChange(cb: () => void): () => void

  getProfile(userId: string): Promise<Profile | null>
  saveProfile(input: ProfileInput): Promise<Profile>

  getGarmin(): Promise<GarminLink | null>
  /** Checks the Personal API key with Garmin, stores it encrypted on the server and imports history. */
  connectGarmin(apiKey: string): Promise<void>
  /** Imports the last days now (the server also syncs on a schedule). Returns how many days were refreshed. */
  syncGarmin(): Promise<number>
  disconnectGarmin(): Promise<void>

  listDays(from: ISODate, to: ISODate): Promise<DailySummary[]>
  getIntraday(date: ISODate): Promise<Intraday | null>
  /** Nights by wake-up date. */
  listSleep(from: ISODate, to: ISODate): Promise<SleepNight[]>
  /** Newest first. */
  listActivities(from: ISODate, to: ISODate): Promise<Activity[]>
  getActivity(id: string): Promise<ActivityDetail | null>
  listWeights(from: ISODate, to: ISODate): Promise<WeightEntry[]>
  addWeight(date: ISODate, kg: number): Promise<void>
  deleteWeight(date: ISODate): Promise<void>

  /** Fires on any data change (own writes, sync, other tabs). Returns unsubscribe. */
  subscribe(cb: () => void): () => void

  /** Demo-only helpers (local backend). */
  demo?: {
    reset(): void
  }
}

// shortcut: only the local demo backend exists; add supabaseRepo here when the server is connected.
export const repo: Repo = createLocalRepo()
