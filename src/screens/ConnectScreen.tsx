import { Check, ExternalLink, Eye, EyeOff, KeyRound, Lock, LogOut, ShieldCheck, Trash2, Watch } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSession } from '../app/session'
import { Button, Card, Field, cx } from '../components/ui'
import { GARMIN_DOCS_URL } from '../config/app'
import { repo } from '../data/repo'
import { Hero } from './AuthScreen'

const STEPS = ['Checking the key with Garmin', 'Importing one year of history', 'Building your dashboard']

/** Onboarding: link Garmin Connect with a Personal API key. Shown until a key is connected. */
export default function ConnectScreen() {
  const { profile } = useSession()
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async (value: string) => {
    setError(null)
    setBusy(true)
    try {
      await repo.connectGarmin(value)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void connect(key)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <Hero title={`Hi ${profile.name.split(' ')[0]}, let's connect Garmin`} text="Paste your Garmin Connect Personal API key. Peak imports your activities, sleep, heart rate and recovery, and keeps them in sync." />
      <form onSubmit={submit} className="safe-bottom relative -mt-8 flex flex-1 animate-sheet-in flex-col rounded-t-[34px] bg-bg px-6 pt-7">
        {busy ? (
          <Progress />
        ) : (
          <>
            <ol className="space-y-3">
              {[
                <>
                  Open the{' '}
                  <a href={GARMIN_DOCS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-brand">
                    Garmin Personal API <ExternalLink className="size-3.5" />
                  </a>{' '}
                  page and sign in with your Garmin account.
                </>,
                'Create a key and choose how long it lasts (30 days to 1 year).',
                'Copy the key and paste it below.',
              ].map((t, i) => (
                <li key={i} className="flex animate-rise gap-3" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-extrabold text-brand">{i + 1}</span>
                  <span className="pt-0.5 text-[14px] leading-snug text-ink-2">{t}</span>
                </li>
              ))}
            </ol>

            <Field
              label="Personal API key"
              icon={KeyRound}
              type={show ? 'text' : 'password'}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Paste your key"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="mt-7"
              trailing={
                <button type="button" onClick={() => setShow(!show)} className="text-faint hover:text-ink-2" aria-label={show ? 'Hide key' : 'Show key'}>
                  {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              }
            />
            {error && (
              <p className="mt-4 animate-pop rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" icon={Watch} className="mt-5 w-full">
              Connect Garmin
            </Button>
            {repo.kind === 'local' && (
              <button type="button" onClick={() => void connect(`demo-key-${profile.id.slice(0, 6)}`)} className="mt-3 text-center text-[13px] font-semibold text-brand">
                No key at hand? Use a demo key
              </button>
            )}

            <Card className="mt-7 divide-y divide-line">
              {[
                { icon: Lock, title: 'Encrypted on the server', text: 'The key never stays on this device. Only its last 4 characters are shown.' },
                { icon: ShieldCheck, title: 'Read-only, just for you', text: 'Peak reads your own data and never writes to Garmin Connect.' },
                { icon: Trash2, title: 'Revoke anytime', text: 'Disconnect in Settings, or delete the key in Garmin Connect.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3 p-4">
                  <Icon className="mt-0.5 size-5 shrink-0 text-train" />
                  <span>
                    <span className="block text-[14px] font-semibold">{title}</span>
                    <span className="block text-[13px] text-muted">{text}</span>
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}
        <div className="flex-1" />
        <button type="button" onClick={() => void repo.signOut()} className="mx-auto mt-8 mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </div>
  )
}

/** Fake-but-honest stepper while the server checks the key and imports (the step timing is cosmetic). */
function Progress() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 520)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex animate-pop flex-col items-center pt-6 text-center">
      <span className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
        <span className="relative grid size-24 place-items-center rounded-full bg-brand text-white">
          <Watch className="size-10 animate-pulse" />
        </span>
      </span>
      <h2 className="mt-6 text-xl font-bold tracking-tight">Connecting to Garmin…</h2>
      <ul className="mt-6 w-full space-y-3 text-left">
        {STEPS.map((s, i) => (
          <li key={s} className={cx('flex items-center gap-3 rounded-[18px] px-4 py-3 transition-colors duration-500', i <= step ? 'surface-card' : 'opacity-40')}>
            <span className={cx('grid size-6 place-items-center rounded-full transition-colors duration-500', i < step ? 'bg-train text-white' : i === step ? 'bg-brand-soft' : 'bg-surface-2')}>
              {i < step ? <Check className="size-3.5 animate-pop" strokeWidth={3} /> : i === step ? <span className="size-3 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : null}
            </span>
            <span className="text-[14px] font-semibold">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
