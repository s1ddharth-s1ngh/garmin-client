import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

// Same key and logic as the inline script in index.html, which applies the theme before first paint.
const KEY = 'peak:theme'
const BG = { light: '#f7f7f8', dark: '#000000' } as const
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

// Light is the default; 'system' is only used when picked explicitly.
function read(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'system' || v === 'dark' ? v : 'light'
}

export const resolveTheme = (pref: ThemePref) => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref)

function apply() {
  const theme = resolveTheme(read())
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[theme])
  listeners.forEach((l) => l())
}

export function initTheme() {
  apply()
  media.addEventListener('change', apply)
}

export function setThemePref(pref: ThemePref) {
  if (pref === 'light') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  apply()
}

const ACCENT_KEY = 'peak:accent'

/** The user's cover color doubles as the app accent (brand, steps, headers); null = default pink. */
export function setAccent(color: string | null) {
  const root = document.documentElement
  if (color) {
    root.dataset.accent = ''
    root.style.setProperty('--accent', color)
    localStorage.setItem(ACCENT_KEY, color)
  } else {
    delete root.dataset.accent
    root.style.removeProperty('--accent')
    localStorage.removeItem(ACCENT_KEY)
  }
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l))

/** Current preference and the theme actually shown. */
export function useTheme() {
  const pref = useSyncExternalStore(subscribe, read)
  return { pref, theme: resolveTheme(pref), setPref: setThemePref }
}
