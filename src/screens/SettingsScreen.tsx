import { KeyRound, LogOut, Minus, MonitorSmartphone, Moon, Paintbrush, Plus, RefreshCw, RotateCcw, Sun, Unlink, Watch } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useMaxHr } from '../app/hooks'
import { useSession } from '../app/session'
import { useTheme, type ThemePref } from '../app/theme'
import { ZONE_COLORS } from '../components/charts'
import { TimezoneSelect } from '../components/TimezoneSelect'
import { useToast } from '../components/toast'
import { Button, Card, Chip, Field, IconTile, PageHeader, Row, SectionTitle, Segmented, Sheet, cx } from '../components/ui'
import { APP } from '../config/app'
import { repo } from '../data/repo'
import { hrZones } from '../domain/training'
import type { Goals, Units } from '../domain/types'
import { formatDayShort, timeAgo } from '../lib/dates'
import { duration, formatNumber } from '../lib/format'
import { CustomizeFields } from './ProfileScreen'

export default function SettingsScreen() {
  const [customize, setCustomize] = useState(false)
  return (
    <div className="animate-fade-in">
      <PageHeader back="/profile" title="Settings" />
      <div className="px-4 [&>*]:animate-rise">
        <GarminSection />
        <Appearance onCustomize={() => setCustomize(true)} />
        <UnitsSection />
        <GoalsSection />
        <BodySection />
        {repo.demo && <DemoTools />}

        <SectionTitle>About</SectionTitle>
        <Card className="divide-y divide-line">
          <Row title={APP.name} text={`Version ${__APP_VERSION__} · ${repo.kind === 'local' ? 'demo mode' : 'connected'}`} />
          <Row title="Data source" text="Garmin Connect Personal API, for your own data only." />
        </Card>

        <Button variant="secondary" icon={LogOut} onClick={() => void repo.signOut()} className="mt-6 w-full">
          Sign out
        </Button>
      </div>
      <Sheet open={customize} onClose={() => setCustomize(false)} title="Customize profile">
        <CustomizeFields />
      </Sheet>
    </div>
  )
}

function GarminSection() {
  const { garmin } = useSession()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<'key' | 'disconnect' | null>(null)
  if (!garmin) return null
  const sync = async () => {
    setBusy(true)
    try {
      const n = await repo.syncGarmin()
      toast(`Synced the last ${n} days`, 'sync')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <SectionTitle>Garmin Connect</SectionTitle>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <IconTile icon={Watch} tone="brand" size={46} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{garmin.device}</span>
            <span className="block text-[13px] text-muted">Connected {formatDayShort(garmin.connected_at.slice(0, 10))}</span>
          </span>
          <Chip tone="train">
            <span className="size-1.5 rounded-full bg-train" /> Live
          </Chip>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <div className="rounded-[18px] bg-surface-2/70 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted">API key</p>
            <p className="mt-0.5 font-bold tracking-wider tabular">•••• {garmin.key_last4}</p>
          </div>
          <div className="rounded-[18px] bg-surface-2/70 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted">Last sync</p>
            <p className="mt-0.5 font-bold">{garmin.last_sync_at ? timeAgo(garmin.last_sync_at) : 'never'}</p>
          </div>
        </div>
        <div className="divide-y divide-line border-t border-line">
          <Row title="Sync now" text="Imports the last 7 days" onClick={() => void sync()} right={<RefreshCw className={cx('size-5 text-brand', busy && 'animate-spin')} />} />
          <Row title="Replace API key" text="When your key expires or you made a new one" onClick={() => setSheet('key')} />
          <Row title={<span className="text-danger">Disconnect Garmin</span>} text="Deletes the key from the server" onClick={() => setSheet('disconnect')} />
        </div>
      </Card>
      <p className="mt-2 px-1 text-[12px] text-faint">The server also syncs automatically every few hours.</p>
      <ReplaceKeySheet open={sheet === 'key'} onClose={() => setSheet(null)} />
      <Sheet open={sheet === 'disconnect'} onClose={() => setSheet(null)} title="Disconnect Garmin?">
        <p className="text-[15px] leading-relaxed text-ink-2">The API key is deleted from the server and syncing stops. You can connect again anytime with a new key.</p>
        <Button
          variant="danger"
          icon={Unlink}
          className="mt-6 w-full"
          onClick={async () => {
            setSheet(null)
            await repo.disconnectGarmin()
          }}
        >
          Disconnect
        </Button>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setSheet(null)}>
          Cancel
        </Button>
      </Sheet>
    </>
  )
}

function ReplaceKeySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await repo.connectGarmin(key)
      toast('New key connected')
      setKey('')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Replace API key">
      <Field label="New Personal API key" icon={KeyRound} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key" />
      {error && <p className="mt-4 animate-pop rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button loading={busy} disabled={!key.trim()} onClick={() => void save()} className="mt-5 w-full">
        Check and save
      </Button>
    </Sheet>
  )
}

function Appearance({ onCustomize }: { onCustomize: () => void }) {
  const { pref, setPref } = useTheme()
  return (
    <>
      <SectionTitle>Appearance</SectionTitle>
      <Card className="divide-y divide-line">
        <div className="p-4">
          <Segmented<ThemePref>
            value={pref}
            onChange={setPref}
            options={[
              { value: 'light', label: <><Sun className="size-4" /> Light</> },
              { value: 'dark', label: <><Moon className="size-4" /> Dark</> },
              { value: 'system', label: <><MonitorSmartphone className="size-4" /> Auto</> },
            ]}
          />
        </div>
        <Row title="Name, avatar and accent color" icon={<Paintbrush className="size-5 text-brand" />} onClick={onCustomize} />
      </Card>
    </>
  )
}

/** Saves one profile change and refreshes the session. */
function useSaveProfile() {
  const { refresh } = useSession()
  return async (input: Parameters<typeof repo.saveProfile>[0]) => {
    await repo.saveProfile(input)
    await refresh()
  }
}

function UnitsSection() {
  const { profile } = useSession()
  const save = useSaveProfile()
  const [tz, setTz] = useState(profile.timezone)
  return (
    <>
      <SectionTitle>Units & region</SectionTitle>
      <Card className="space-y-4 p-4">
        <Segmented<Units>
          value={profile.units}
          onChange={(units) => void save({ units })}
          options={[
            { value: 'metric', label: 'Metric · km, kg' },
            { value: 'imperial', label: 'Imperial · mi, lb' },
          ]}
        />
        <TimezoneSelect
          value={tz}
          onChange={(v) => {
            setTz(v)
            void save({ timezone: v })
          }}
        />
      </Card>
    </>
  )
}

function Stepper({ label, value, step, min, max, format, onChange }: { label: string; value: number; step: number; min: number; max: number; format: (v: number) => ReactNode; onChange: (v: number) => void }) {
  const btn = 'grid size-9 place-items-center rounded-full bg-surface-2 text-ink-2 ring-1 ring-line transition-[background-color,transform] hover:bg-surface-3 active:scale-90 disabled:opacity-40'
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <button type="button" aria-label={`Less ${label}`} className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        <Minus className="size-4" />
      </button>
      <span key={value} className="w-20 animate-pop text-center font-bold tabular">
        {format(value)}
      </span>
      <button type="button" aria-label={`More ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

function GoalsSection() {
  const { profile } = useSession()
  const save = useSaveProfile()
  const toast = useToast()
  const [goals, setGoals] = useState<Goals>(profile.goals)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(goals) !== JSON.stringify(profile.goals)
  const set = (k: keyof Goals) => (v: number) => setGoals((g) => ({ ...g, [k]: v }))
  return (
    <>
      <SectionTitle>Goals</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        <Stepper label="Daily steps" value={goals.steps} step={500} min={1000} max={40000} format={formatNumber} onChange={set('steps')} />
        <Stepper label="Daily floors" value={goals.floors} step={1} min={1} max={100} format={String} onChange={set('floors')} />
        <Stepper label="Weekly intensity" value={goals.intensity_min} step={10} min={30} max={1000} format={(v) => `${v} min`} onChange={set('intensity_min')} />
        <Stepper label="Sleep" value={goals.sleep_min} step={15} min={300} max={660} format={duration} onChange={set('sleep_min')} />
        {dirty && (
          <div className="flex animate-pop gap-2 p-4">
            <Button variant="secondary" className="flex-1" onClick={() => setGoals(profile.goals)}>
              Undo
            </Button>
            <Button
              className="flex-1"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                await save({ goals })
                setBusy(false)
                toast('Goals saved')
              }}
            >
              Save goals
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}

function BodySection() {
  const { profile } = useSession()
  const maxHr = useMaxHr()
  const save = useSaveProfile()
  const toast = useToast()
  const [birth, setBirth] = useState(String(profile.birth_year))
  const [height, setHeight] = useState(String(profile.height_cm))
  const [custom, setCustom] = useState(profile.max_hr ? String(profile.max_hr) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const year = new Date().getFullYear()
  const submit = async () => {
    const b = Number(birth)
    const h = Number(height)
    const m = custom.trim() ? Number(custom) : null
    if (!Number.isInteger(b) || b < year - 110 || b > year - 8) return setError('Enter a real birth year.')
    if (!(h >= 100 && h <= 250)) return setError('Height must be between 100 and 250 cm.')
    if (m !== null && !(m >= 120 && m <= 230)) return setError('Max heart rate must be between 120 and 230.')
    setError(null)
    setBusy(true)
    await save({ birth_year: b, height_cm: h, max_hr: m })
    setBusy(false)
    toast('Saved. Heart rate zones updated.')
  }
  return (
    <>
      <SectionTitle>Body & heart rate zones</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Birth year" inputMode="numeric" value={birth} onChange={(e) => setBirth(e.target.value)} />
          <Field label="Height (cm)" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
        <Field
          className="mt-3"
          label="Max heart rate"
          inputMode="numeric"
          placeholder={`Auto: ${220 - (year - profile.birth_year)} bpm (220 − age)`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          hint="Leave empty to estimate it from your age. A lab or field test is more accurate."
        />
        {error && <p className="mt-3 animate-pop rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <Button loading={busy} onClick={() => void submit()} className="mt-4 w-full">
          Save
        </Button>
        <div className="mt-5 space-y-1.5">
          {hrZones(maxHr)
            .slice()
            .reverse()
            .map((z) => (
              <div key={z.zone} className="flex items-center gap-3 text-[13px]">
                <span className="grid size-7 place-items-center rounded-[9px] text-[12px] font-extrabold text-white" style={{ background: ZONE_COLORS[z.zone - 1] }}>
                  {z.zone}
                </span>
                <span className="h-1.5 flex-1 rounded-full" style={{ background: ZONE_COLORS[z.zone - 1], opacity: 0.25 }} />
                <span className="w-24 text-right font-semibold tabular">
                  {z.min}–{z.max} bpm
                </span>
              </div>
            ))}
        </div>
      </Card>
    </>
  )
}

function DemoTools() {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <SectionTitle>Demo</SectionTitle>
      <Card className="divide-y divide-line">
        <Row title="Reset demo" text="Deletes every demo account and setting on this device" onClick={() => setConfirm(true)} right={<RotateCcw className="size-5 text-danger" />} />
      </Card>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Reset demo?">
        <p className="text-[15px] leading-relaxed text-ink-2">All demo accounts, goals and manual weigh-ins on this device are deleted. You go back to the sign-in screen.</p>
        <Button variant="danger" className="mt-6 w-full" onClick={() => repo.demo?.reset()}>
          Reset everything
        </Button>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => setConfirm(false)}>
          Cancel
        </Button>
      </Sheet>
    </>
  )
}
