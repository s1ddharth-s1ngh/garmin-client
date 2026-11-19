import { ArrowRight, BatteryCharging, Eye, EyeOff, Footprints, Lock, Mail, MoonStar, Sparkles, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Segmented } from '../components/ui'
import { APP } from '../config/app'
import { repo } from '../data/repo'

/** Solid brand header with the app name and what it shows. */
export function Hero({ title = APP.name, text = APP.tagline }: { title?: string; text?: string }) {
  return (
    <div className="relative overflow-hidden bg-hero px-6 pt-[max(env(safe-area-inset-top),28px)] pb-16 text-white">
      {/* Soft mountain line behind the title. */}
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-28 w-full opacity-15" aria-hidden>
        <path d="M0 120 L70 52 L118 86 L190 18 L246 74 L292 44 L400 110 L400 120 Z" fill="white" />
      </svg>
      <div className="relative mt-10 animate-pop">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-16 rounded-[20px] ring-2 ring-white/30" />
        <h1 className="mt-6 text-[38px] leading-[1.02] font-black tracking-[-0.04em]">{title}</h1>
        <p className="mt-3 max-w-[20rem] text-[15px] leading-relaxed text-white/80">{text}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { icon: Footprints, label: 'Activities' },
            { icon: MoonStar, label: 'Sleep' },
            { icon: BatteryCharging, label: 'Recovery' },
          ].map(({ icon: Icon, label }, i) => (
            <span key={label} className="inline-flex animate-rise items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15" style={{ animationDelay: `${200 + i * 80}ms` }}>
              <Icon className="size-4" /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy('form')
    try {
      await (mode === 'in' ? repo.signIn(email, password) : repo.signUp(email, password, name))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  /** One tap: a throwaway demo account already linked to (generated) Garmin data. */
  const tryDemo = async () => {
    setError(null)
    setBusy('demo')
    try {
      const id = Math.random().toString(36).slice(2, 8)
      await repo.signUp(`demo-${id}@peak.app`, crypto.randomUUID(), 'Alex Rider')
      await repo.connectGarmin(`demo-key-${id}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <Hero />
      <form onSubmit={submit} className="safe-bottom relative -mt-8 flex flex-1 animate-sheet-in flex-col rounded-t-[34px] bg-bg px-6 pt-7">
        <Segmented
          value={mode}
          onChange={(m) => (setMode(m), setError(null))}
          options={[
            { value: 'in', label: 'Sign in' },
            { value: 'up', label: 'Create account' },
          ]}
        />
        <div className="mt-6 space-y-4">
          {mode === 'up' && (
            <Field label="Your name" icon={User} autoComplete="name" placeholder="e.g. Alex" required value={name} onChange={(e) => setName(e.target.value)} className="animate-rise" />
          )}
          <Field
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            icon={Lock}
            type={show ? 'text' : 'password'}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder={mode === 'up' ? 'At least 6 characters' : 'Your password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button type="button" onClick={() => setShow(!show)} className="text-faint hover:text-ink-2" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            }
          />
        </div>
        {error && (
          <p className="mt-4 animate-pop rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy === 'form'} disabled={busy === 'demo'} className="mt-6 w-full">
          {mode === 'in' ? 'Sign in' : 'Create account'}
          <ArrowRight className="size-[18px]" />
        </Button>
        <p className="mt-4 text-center text-[13px] text-muted">
          {mode === 'in' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="font-semibold text-brand" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setError(null))}>
            {mode === 'in' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <div className="flex-1" />
        {repo.kind === 'local' && (
          <div className="mt-8 mb-2 rounded-[22px] bg-surface-2 p-4 text-center">
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-ink-2">Demo mode.</span> Accounts live on this device only and the Garmin data is generated until the server is connected.
            </p>
            <Button variant="secondary" icon={Sparkles} loading={busy === 'demo'} disabled={busy === 'form'} onClick={() => void tryDemo()} className="mt-3 h-11 w-full text-sm">
              Explore with demo data
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
