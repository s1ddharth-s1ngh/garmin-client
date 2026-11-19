import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChevronRight, X, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Staggered entrance: use with the `animate-rise` class. */
export const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 55}ms` })

export type Tone = 'muted' | 'brand' | 'steps' | 'sleep' | 'heart' | 'battery' | 'stress' | 'train' | 'star' | 'danger'

/** Static class names per tone (Tailwind only sees literal strings). `color` is for SVG/inline styles. */
export const TONE: Record<Tone, { bg: string; soft: string; text: string; color: string }> = {
  muted: { bg: 'bg-muted', soft: 'bg-surface-2 text-muted', text: 'text-muted', color: 'var(--muted)' },
  brand: { bg: 'bg-brand', soft: 'bg-brand-soft text-brand', text: 'text-brand', color: 'var(--brand)' },
  steps: { bg: 'bg-steps', soft: 'bg-steps-soft text-steps-strong', text: 'text-steps-strong', color: 'var(--steps)' },
  sleep: { bg: 'bg-sleep', soft: 'bg-sleep-soft text-sleep-strong', text: 'text-sleep-strong', color: 'var(--sleep)' },
  heart: { bg: 'bg-heart', soft: 'bg-heart-soft text-heart-strong', text: 'text-heart-strong', color: 'var(--heart)' },
  battery: { bg: 'bg-battery', soft: 'bg-battery-soft text-battery-strong', text: 'text-battery-strong', color: 'var(--battery)' },
  stress: { bg: 'bg-stress', soft: 'bg-stress-soft text-stress-strong', text: 'text-stress-strong', color: 'var(--stress)' },
  train: { bg: 'bg-train', soft: 'bg-train-soft text-train-strong', text: 'text-train-strong', color: 'var(--train)' },
  star: { bg: 'bg-star', soft: 'bg-star-soft text-star-strong', text: 'text-star-strong', color: 'var(--star)' },
  danger: { bg: 'bg-danger', soft: 'bg-danger-soft text-danger', text: 'text-danger', color: 'var(--danger)' },
}

export function Card({ className, children, onClick, to, style }: { className?: string; children: ReactNode; onClick?: () => void; to?: string; style?: CSSProperties }) {
  const cls = cx('surface-card rounded-[26px]', className)
  if (to)
    return (
      <Link to={to} style={style} className={cx(cls, 'block transition active:scale-[0.985]')}>
        {children}
      </Link>
    )
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className={cx(cls, 'block w-full text-left transition active:scale-[0.985]')}>
      {children}
    </button>
  ) : (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]',
  secondary: 'bg-surface-2 text-ink ring-1 ring-line hover:bg-surface-3',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-danger-soft text-danger hover:bg-[color-mix(in_oklab,var(--danger)_18%,transparent)]',
}

/** Every button is a pill. */
export function Button({
  variant = 'primary',
  icon: Icon,
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {loading ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : Icon && <Icon className="size-[18px]" strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  badge,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; badge?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'relative grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50',
        className,
      )}
    >
      <Icon className="size-[19px]" strokeWidth={2} />
      {badge && (
        <span className="absolute top-1.5 right-1.5 flex size-2.5">
          <span className="relative size-2.5 rounded-full bg-danger ring-2 ring-surface" />
        </span>
      )}
    </button>
  )
}

/** Round back button; goes back in history, or to `fallback` when the page was opened directly. */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate()
  return (
    <IconButton
      icon={ArrowLeft}
      label="Back"
      onClick={() => (history.state?.idx > 0 ? navigate(-1) : navigate(fallback, { replace: true }))}
      className="[&>svg]:transition-transform hover:[&>svg]:-translate-x-0.5"
    />
  )
}

/** Pill tabs with a sliding indicator. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  return (
    <div role="tablist" className={cx('relative flex rounded-full bg-surface-2 p-1 ring-1 ring-line/60', className)}>
      <span
        aria-hidden
        className="surface-card absolute top-1 bottom-1 left-1 rounded-full transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-10 text-sm',
            o.value === value ? 'text-ink' : 'text-muted hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Horizontal scrolling filter chips. */
export function ChipTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors',
            o.value === value ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2 ring-1 ring-line hover:bg-surface-3',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, color, size = 40, ring }: { name: string; color: string; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-bold text-white', ring && 'ring-[3px] ring-bg')}
      style={{ width: size, height: size, fontSize: size * 0.38, background: color }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}

export function Chip({ children, tone = 'muted', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', TONE[tone].soft, className)}>{children}</span>
}

/** Colored icon in a rounded square. */
export function IconTile({ icon: Icon, tone, size = 40, className }: { icon: LucideIcon; tone: Tone; size?: number; className?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-[14px] text-white', TONE[tone].bg, className)} style={{ width: size, height: size }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.1} />
    </span>
  )
}

/** "+4.2%" chip; green when the change goes in the good direction. */
export function Delta({ value, better = 'higher', suffix = '%', className }: { value: number | null; better?: 'higher' | 'lower' | 'none'; suffix?: string; className?: string }) {
  if (value == null || !Number.isFinite(value)) return null
  const up = value >= 0
  const good = better === 'none' ? null : better === 'higher' ? up : !up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular',
        good == null ? 'bg-surface-2 text-muted' : good ? 'bg-train-soft text-train-strong' : 'bg-heart-soft text-heart-strong',
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.6} />
      {Math.abs(value) < 10 ? Math.abs(value).toFixed(1) : Math.round(Math.abs(value))}
      {suffix}
    </span>
  )
}

export function Field({
  label,
  hint,
  icon: Icon,
  trailing,
  className,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; icon?: LucideIcon; trailing?: ReactNode }) {
  const id = useId()
  return (
    <div className={cx('block', className)}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <span className="flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-1 ring-line/60 transition focus-within:bg-surface focus-within:ring-brand/40">
        {Icon && <Icon className="size-[18px] shrink-0 text-faint" />}
        <input id={id} {...input} className="h-full w-full min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint" />
        {trailing}
      </span>
      {hint && <span className="mt-1.5 block px-1 text-xs text-muted">{hint}</span>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="truncate text-[17px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

/** Small "See all ›" pill used next to section titles. */
export function SeeAll({ to, children = 'See all' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-brand-soft pr-2 pl-3 text-[13px] font-bold text-brand transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_18%,transparent)]">
      {children} <ChevronRight className="size-4" />
    </Link>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <>
      {back && (
        <div className="safe-top px-4 pt-3">
          <BackButton fallback={back} />
        </div>
      )}
      <header className={cx('flex items-end justify-between gap-3 px-5 pb-5', !back && 'safe-top')}>
        <div className="min-w-0 pt-3">
          {subtitle && <div className="mb-1 text-[12px] font-semibold tracking-[0.04em] text-faint uppercase">{subtitle}</div>}
          <h1 className="truncate text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
      </header>
    </>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon?: LucideIcon; title: string; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex animate-pop flex-col items-center px-6 py-10 text-center">
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-[18px] bg-surface-2 text-faint">
          <Icon className="size-7" />
        </span>
      )}
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-shimmer rounded-[26px] bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface-3)_50%,var(--surface-2)_100%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}

/** Number that counts up to its value when it changes. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = ms ? Math.min(1, (t - start) / ms) : 1
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3))
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])
  return <>{format(shown)}</>
}

/** Thin progress bar that fills in on mount. */
export function Progress({ value, tone = 'brand', className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cx('h-full origin-left animate-grow-x rounded-full', TONE[tone].bg)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300', checked ? 'bg-brand' : 'bg-surface-3')}
    >
      <span className={cx('absolute top-0.5 left-0.5 size-6 rounded-full bg-white ring-1 ring-black/5 transition-transform duration-200 ease-out', checked && 'translate-x-5')} />
    </button>
  )
}

/** List row for settings-like cards. Clickable when `onClick` or `to` is set. */
export function Row({ title, text, icon, onClick, to, right }: { title: ReactNode; text?: ReactNode; icon?: ReactNode; onClick?: () => void; to?: string; right?: ReactNode }) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {text && <span className="block text-[13px] text-muted">{text}</span>}
      </span>
      {right ?? ((onClick || to) && <ChevronRight className="size-5 shrink-0 text-faint transition group-hover:translate-x-0.5" />)}
    </>
  )
  const cls = 'group flex w-full items-center gap-3 p-4 text-left transition-colors'
  if (to)
    return (
      <Link to={to} className={cx(cls, 'hover:bg-surface-2/60 active:bg-surface-2')}>
        {body}
      </Link>
    )
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, 'hover:bg-surface-2/60 active:bg-surface-2')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Bottom sheet modal. Closes on backdrop tap and Escape. Slides out before unmounting. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const closing = mounted && !open

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex items-end justify-center', closing && 'pointer-events-none')} role="dialog" aria-modal aria-label={title} aria-hidden={closing || undefined}>
      <div className={cx('absolute inset-0 bg-scrim backdrop-blur-[3px]', closing ? 'animate-fade-out' : 'animate-fade-in')} onClick={onClose} />
      <div
        // Children run their own animations; only the panel's own end should unmount.
        onAnimationEnd={(e) => closing && e.target === e.currentTarget && setMounted(false)}
        className={cx(
          'safe-bottom no-scrollbar relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-bg ring-1 ring-line will-change-transform',
          closing ? 'animate-sheet-out' : 'animate-sheet-in',
        )}
      >
        <div className="sticky top-0 z-10 bg-bg/90 px-5 pt-3 pb-3 backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <IconButton
              icon={X}
              label="Close"
              onClick={onClose}
              // X tilts on hover, squeezes on press, spins away while the sheet exits.
              className={cx(
                'size-9 [&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:[&>svg]:rotate-90 active:[&>svg]:scale-75',
                closing && '[&>svg]:rotate-180 [&>svg]:scale-50',
              )}
            />
          </div>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
