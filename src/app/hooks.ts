import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { repo } from '../data/repo'
import { maxHrFor } from '../domain/training'
import { todayIn, type ISODate } from '../lib/dates'
import { unitFormat } from '../lib/format'
import { useSession } from './session'

/** Runs `load` now and again after every data change. Keeps the last data while reloading. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const run = useCallback(() => {
    let alive = true
    loadRef
      .current()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let cancel = run()
    const unsub = repo.subscribe(() => {
      cancel()
      cancel = run()
    })
    return () => {
      cancel()
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading: data === undefined && !error }
}

/** "Today" in the user's timezone; re-renders every minute so midnight rolls over. */
export function useToday(): ISODate {
  const { profile } = useSession()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  return todayIn(profile.timezone)
}

/** Formatters for the user's unit system. */
export function useUnits() {
  const { profile } = useSession()
  return useMemo(() => unitFormat(profile.units), [profile.units])
}

export function useMaxHr() {
  const { profile } = useSession()
  return maxHrFor(profile, new Date().getFullYear())
}

export const useDays = (from: ISODate, to: ISODate) => useLive(() => repo.listDays(from, to), [from, to])
export const useSleep = (from: ISODate, to: ISODate) => useLive(() => repo.listSleep(from, to), [from, to])
export const useActivities = (from: ISODate, to: ISODate) => useLive(() => repo.listActivities(from, to), [from, to])
export const useWeights = (from: ISODate, to: ISODate) => useLive(() => repo.listWeights(from, to), [from, to])
export const useIntraday = (date: ISODate) => useLive(() => repo.getIntraday(date), [date])
export const useActivity = (id: string) => useLive(() => repo.getActivity(id), [id])
