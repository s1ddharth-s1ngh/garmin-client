import { Footprints, Gauge, HeartPulse, House, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useToast } from '../components/toast'
import { cx } from '../components/ui'
import { repo } from '../data/repo'

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/activities', label: 'Activities', icon: Footprints },
  null,
  { to: '/training', label: 'Training', icon: Gauge },
  { to: '/health', label: 'Health', icon: HeartPulse },
]

export default function AppShell() {
  return (
    <>
      {/* Scrim behind the status bar on edge-to-edge devices (height is 0 elsewhere). */}
      <div className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-bg/80 backdrop-blur-xl" />
      <div className="mx-auto min-h-dvh max-w-md pb-28">
        <Outlet />
      </div>

      {/* Flat tab bar: hairline on top, outlined icons, the active tab in the accent color. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[var(--nav-bg)]">
        <div className="mx-auto grid h-[62px] max-w-md grid-cols-5 items-center">
          {TABS.map((t) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => cx('flex flex-col items-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-brand' : 'text-faint hover:text-muted')}
              >
                <t.icon className="size-[22px]" strokeWidth={1.6} />
                {t.label}
              </NavLink>
            ) : (
              <SyncButton key="sync" />
            ),
          )}
        </div>
      </nav>
    </>
  )
}

/** Center button: pulls fresh data from Garmin. Spins while syncing, then pops. */
function SyncButton() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const sync = async () => {
    if (busy) return
    setBusy(true)
    try {
      const days = await repo.syncGarmin()
      toast(`Synced with Garmin · last ${days} days`, 'sync')
      setDone((n) => n + 1)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex justify-center">
      <button
        type="button"
        aria-label="Sync with Garmin"
        onClick={() => void sync()}
        className="group relative grid size-11 place-items-center rounded-full bg-brand text-white transition-[background-color,transform] duration-200 ease-out hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)] active:scale-90"
      >
        {busy && <span className="absolute inset-0 animate-ping rounded-full bg-brand/40 motion-reduce:hidden" />}
        <RefreshCw
          key={done}
          className={cx(
            'relative size-[22px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            busy ? 'animate-spin' : 'animate-pop group-hover:rotate-90 group-active:scale-75',
          )}
          strokeWidth={2.2}
        />
      </button>
    </div>
  )
}
