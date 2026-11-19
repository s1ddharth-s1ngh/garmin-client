import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { repo, type AuthUser } from '../data/repo'
import type { GarminLink, Profile } from '../domain/types'
import { setAccent } from './theme'

export interface Session {
  user: AuthUser
  profile: Profile
  /** null until the user connects Garmin. */
  garmin: GarminLink | null
  refresh(): Promise<void>
}

type State = { status: 'loading' } | { status: 'signed-out' } | { status: 'ready'; session: Session }

const Ctx = createContext<State>({ status: 'loading' })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    const user = await repo.getUser()
    if (!user) return setState({ status: 'signed-out' })
    const [profile, garmin] = await Promise.all([repo.getProfile(user.id), repo.getGarmin()])
    if (!profile) return setState({ status: 'signed-out' })
    setState({ status: 'ready', session: { user, profile, garmin, refresh: load } })
  }, [])

  useEffect(() => {
    void load()
    return repo.onAuthChange(() => void load())
  }, [load])

  // Signed out falls back to the default accent; while loading keep the cached one from index.html.
  const accent = state.status === 'ready' ? state.session.profile.cover_color : state.status === 'signed-out' ? null : undefined
  useEffect(() => {
    if (accent !== undefined) setAccent(accent)
  }, [accent])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useSessionState = () => useContext(Ctx)

/** Only call inside the signed-in part of the app. */
export function useSession(): Session {
  const s = useContext(Ctx)
  if (s.status !== 'ready') throw new Error('useSession outside a signed-in tree')
  return s.session
}
