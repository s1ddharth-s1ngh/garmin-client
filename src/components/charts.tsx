import { useEffect, useId, useState, type PointerEvent, type ReactNode } from 'react'
import type { SleepNight, SleepStage } from '../domain/types'
import { hrZones } from '../domain/training'
import { addDays, clock, endOfMonth, startOfMonth, weekday, type ISODate } from '../lib/dates'
import { hms } from '../lib/format'
import { TONE, cx, type Tone } from './ui'

/** True one frame after mount: lets CSS transitions animate from their start value. */
function useMounted() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return ready
}

/** Index under the pointer for charts with `n` evenly spaced points. */
function useScrub(n: number) {
  const [hover, setHover] = useState<number | null>(null)
  const pick = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const p = (e.clientX - r.left) / r.width
    setHover(Math.max(0, Math.min(n - 1, Math.round(p * (n - 1)))))
  }
  return { hover, handlers: { onPointerMove: pick, onPointerDown: pick, onPointerLeave: () => setHover(null) } }
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute -top-1 z-20 -translate-x-1/2 -translate-y-full animate-pop rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold whitespace-nowrap text-bg tabular shadow-sm"
      style={{ left: `clamp(40px, ${x}%, calc(100% - 40px))` }}
    >
      {children}
    </span>
  )
}

/** Circular progress ring with content in the middle. Fills in on mount, with a soft glow. */
export function Ring({
  value,
  size = 180,
  stroke = 16,
  color,
  track = 'var(--surface-2)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color: string
  track?: string
  children?: ReactNode
}) {
  const id = useId()
  const ready = useMounted()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = ready ? Math.max(0, Math.min(1, value)) : 0
  const arc = {
    cx: size / 2,
    cy: size / 2,
    r,
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeDasharray: c,
    strokeDashoffset: c * (1 - p),
    style: { transition: 'stroke-dashoffset 1100ms cubic-bezier(.2,.8,.2,1)' },
  }
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={stroke * 0.55} />
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle {...arc} filter={`url(#${id}-glow)`} opacity={value <= 0 ? 0 : 0.45} />
        <circle {...arc} opacity={value <= 0 ? 0 : 1} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/** Concentric rings (Apple-style) for up to three goals. */
export function RingStack({ rings, size = 120, stroke = 12 }: { rings: { value: number; color: string }[]; size?: number; stroke?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {rings.map((r, i) => {
        const s = size - i * (stroke + 4) * 2
        return (
          <div key={i} className="absolute" style={{ left: (size - s) / 2, top: (size - s) / 2 }}>
            <Ring value={r.value} size={s} stroke={stroke} color={r.color} />
          </div>
        )
      })}
    </div>
  )
}

/** Half-circle gauge with colored bands and a marker that swings to the value. */
export function Gauge({
  value,
  max = 100,
  size = 240,
  stroke = 18,
  bands,
  children,
}: {
  value: number
  max?: number
  size?: number
  stroke?: number
  /** Band ends as fractions of max with their color, in order. */
  bands: { to: number; color: string }[]
  children?: ReactNode
}) {
  const ready = useMounted()
  const r = (size - stroke) / 2
  const c = size / 2
  const pt = (f: number) => {
    const a = Math.PI * (1 - f)
    return `${c + r * Math.cos(a)},${c - r * Math.sin(a)}`
  }
  const f = Math.max(0, Math.min(1, value / max))
  return (
    <div className="relative mx-auto" style={{ width: size, height: size / 2 + stroke / 2 }}>
      <svg width={size} height={size / 2 + stroke / 2} className="overflow-visible" aria-hidden>
        {bands.map((b, i) => {
          // Small gap between bands.
          const a = (i ? bands[i - 1].to : 0) + (i ? 0.012 : 0)
          const e = b.to - (i < bands.length - 1 ? 0.012 : 0)
          return <path key={i} d={`M${pt(a)} A${r},${r} 0 0 1 ${pt(e)}`} fill="none" stroke={b.color} strokeWidth={stroke} strokeLinecap="round" />
        })}
      </svg>
      {/* Marker: a rotating arm from the center; transitions in HTML are smoother than SVG transforms. */}
      <div
        className="absolute"
        style={{ left: c, top: c, transform: `rotate(${-90 + 180 * (ready ? f : 0)}deg)`, transition: 'transform 1300ms cubic-bezier(.2,.8,.2,1.05)' }}
      >
        <span className="absolute block rounded-full bg-surface ring-[5px] ring-ink" style={{ width: stroke + 6, height: stroke + 6, left: -(stroke + 6) / 2, top: -r - (stroke + 6) / 2 }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center">{children}</div>
    </div>
  )
}

export interface Bar {
  key: string
  label: string
  value: number | null
  /** Strength of the color: reached the goal, close, far. */
  level?: 'good' | 'ok' | 'low'
  active?: boolean
}

const LEVEL_OPACITY = { good: 1, ok: 0.5, low: 0.22 }

/** Vertical bar chart with an optional dashed goal line. Bars grow in, staggered. */
export function BarChart({
  bars,
  goal,
  goalLabel,
  height = 168,
  tone = 'steps',
  format = String,
}: {
  bars: Bar[]
  goal?: number
  goalLabel?: string
  height?: number
  tone?: Tone
  format?: (v: number) => string
}) {
  const max = Math.max(goal ?? 0, ...bars.map((b) => b.value ?? 0)) * 1.12 || 1
  const dense = bars.length > 14
  const { hover, handlers } = useScrub(bars.length)
  const shown = hover ?? bars.findIndex((b) => b.active)
  return (
    <div>
      <div className="relative touch-pan-y select-none" style={{ height }} {...handlers}>
        {goal != null && (
          <div className="absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-ink/20" style={{ bottom: `${(goal / max) * 100}%` }}>
            {goalLabel && <span className="absolute -top-5 right-0 rounded bg-surface px-1 text-[10px] font-semibold text-muted">{goalLabel}</span>}
          </div>
        )}
        {hover != null && bars[hover] && (
          <Tooltip x={((hover + 0.5) / bars.length) * 100}>
            {bars[hover].label} · {bars[hover].value != null ? format(bars[hover].value!) : 'no data'}
          </Tooltip>
        )}
        <div className={cx('absolute inset-0 flex items-end border-b border-line', dense ? 'gap-[3px]' : 'gap-2')}>
          {bars.map((b, i) => (
            <div key={b.key} className="relative flex h-full flex-1 flex-col items-center justify-end">
              {i === shown && b.value != null && !dense && hover == null && <span className="mb-1 animate-pop text-center text-[11px] font-bold text-ink tabular">{format(b.value)}</span>}
              {b.value == null ? (
                <div className="mb-1 h-1 w-1/3 max-w-3 rounded-full bg-line" />
              ) : (
                <div
                  className={cx('w-full max-w-7 origin-bottom animate-grow rounded-t-[6px] rounded-b-[2px] transition-[height,filter]', i === hover && 'brightness-110')}
                  style={{
                    height: `max(4px, ${(b.value / max) * 100}%)`,
                    background: TONE[tone].color,
                    opacity: LEVEL_OPACITY[b.level ?? 'good'],
                    animationDelay: `${i * (dense ? 12 : 40)}ms`,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={cx('mt-2 flex', dense ? 'gap-[3px]' : 'gap-2')}>
        {bars.map((b, i) => (
          <span key={b.key} className={cx('flex-1 text-center text-[11px] font-medium', i === shown ? 'text-ink' : 'text-faint')}>
            {dense ? (i % Math.ceil(bars.length / 6) === 0 || b.active ? b.label : '') : b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export interface StackColumn {
  key: string
  label: string
  parts: { value: number; color: string }[]
  active?: boolean
}

/** Stacked vertical bars (e.g. sleep stages per night). */
export function StackedBars({ columns, height = 168, goal, format = String }: { columns: StackColumn[]; height?: number; goal?: number; format?: (v: number) => string }) {
  const totals = columns.map((c) => c.parts.reduce((s, p) => s + p.value, 0))
  const max = Math.max(goal ?? 0, ...totals) * 1.1 || 1
  const { hover, handlers } = useScrub(columns.length)
  return (
    <div>
      <div className="relative touch-pan-y select-none" style={{ height }} {...handlers}>
        {goal != null && <div className="absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-ink/20" style={{ bottom: `${(goal / max) * 100}%` }} />}
        {hover != null && (
          <Tooltip x={((hover + 0.5) / columns.length) * 100}>
            {columns[hover].label} · {totals[hover] ? format(totals[hover]) : 'no data'}
          </Tooltip>
        )}
        <div className="absolute inset-0 flex items-end gap-2 border-b border-line">
          {columns.map((c, i) => (
            <div key={c.key} className="flex h-full flex-1 flex-col items-center justify-end">
              {totals[i] === 0 ? (
                <div className="mb-1 h-1 w-1/3 max-w-3 rounded-full bg-line" />
              ) : (
                <div
                  className={cx('flex w-full max-w-7 origin-bottom animate-grow flex-col-reverse overflow-hidden rounded-t-[7px] rounded-b-[3px]', c.active && 'ring-2 ring-ink/70 ring-offset-2 ring-offset-surface')}
                  style={{ height: `${(totals[i] / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                >
                  {c.parts.map((p, j) => (
                    <div key={j} style={{ height: `${(p.value / totals[i]) * 100}%`, background: p.color }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {columns.map((c) => (
          <span key={c.key} className={cx('flex-1 text-center text-[11px] font-medium', c.active ? 'text-ink' : 'text-faint')}>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Smooth path through points (horizontal tangents: never overshoots). */
function curve(pts: { x: number; y: number }[], smooth: boolean) {
  return pts.reduce((p, pt, i) => {
    if (i === 0) return `M${pt.x},${pt.y}`
    if (!smooth) return `${p} L${pt.x},${pt.y}`
    const prev = pts[i - 1]
    const mid = (prev.x + pt.x) / 2
    return `${p} C${mid},${prev.y} ${mid},${pt.y} ${pt.x},${pt.y}`
  }, '')
}

/**
 * Line chart over evenly spaced values (nulls make gaps). Drag/hover to read values.
 * `invert` puts low values on top (pace: faster is better).
 */
export function LineChart({
  values,
  labels = [],
  tone = 'brand',
  height = 160,
  area = true,
  band,
  format = (v) => String(Math.round(v)),
  tip,
  invert,
  min,
  max,
  pulse,
}: {
  values: (number | null)[]
  /** X-axis labels at given indices. */
  labels?: { i: number; text: string }[]
  tone?: Tone
  height?: number
  area?: boolean
  /** Shaded normal range, e.g. HRV baseline. */
  band?: [number, number]
  format?: (v: number) => string
  /** Extra text in the tooltip, e.g. the date of index i. */
  tip?: (i: number) => string
  invert?: boolean
  min?: number
  max?: number
  /** Pulsing dot on the last known value. */
  pulse?: boolean
}) {
  const id = useId()
  const color = TONE[tone].color
  const n = values.length
  const { hover, handlers } = useScrub(n)
  const known = values.filter((v): v is number => v != null)
  if (!known.length)
    return (
      <div style={{ height }} className="grid place-items-center text-sm text-faint">
        No data yet
      </div>
    )
  let lo = min ?? Math.min(...known, ...(band ?? []))
  let hi = max ?? Math.max(...known, ...(band ?? []))
  if (hi === lo) {
    hi += 1
    lo -= 1
  }
  const pad = (hi - lo) * 0.12
  if (min == null) lo -= pad
  if (max == null) hi += pad
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const y = (v: number) => {
    const p = (v - lo) / (hi - lo)
    return invert ? 6 + p * 86 : 92 - p * 86
  }
  const segs: { x: number; y: number }[][] = []
  let cur: { x: number; y: number }[] = []
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur)
      cur = []
    } else cur.push({ x: x(i), y: y(v) })
  })
  if (cur.length) segs.push(cur)
  const smooth = n <= 90
  const lastI = values.findLastIndex((v) => v != null)
  const at = hover ?? null
  const grid = [6, 49, 92]
  const valueAtY = (gy: number) => (invert ? lo + ((gy - 6) / 86) * (hi - lo) : lo + ((92 - gy) / 86) * (hi - lo))
  return (
    <div>
      {/* Y labels get their own gutter on the right so they never cover the latest point. */}
      <div className="relative" style={{ height }}>
        {grid.map((gy) => (
          <span key={gy} className="absolute right-0 w-11 -translate-y-1/2 text-right text-[10px] font-semibold whitespace-nowrap text-faint tabular" style={{ top: `${gy}%` }}>
            {format(valueAtY(gy)).replace(/ (bpm|ms|brpm)$/, '')}
          </span>
        ))}
        <div className="absolute inset-y-0 right-12 left-0 touch-pan-y select-none" {...handlers}>
        <div className="absolute inset-0 animate-reveal">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={invert ? 0 : 0.28} />
                <stop offset="1" stopColor={color} stopOpacity={invert ? 0.28 : 0} />
              </linearGradient>
            </defs>
            {grid.map((gy) => (
              <line key={gy} x1="0" x2="100" y1={gy} y2={gy} stroke="var(--line)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
            ))}
            {band && (
              <rect x="0" width="100" y={Math.min(y(band[0]), y(band[1]))} height={Math.abs(y(band[1]) - y(band[0]))} fill={color} opacity="0.1" />
            )}
            {area &&
              segs.map((s, i) =>
                s.length > 1 ? <path key={i} d={`${curve(s, smooth)} L${s[s.length - 1].x},${invert ? 0 : 100} L${s[0].x},${invert ? 0 : 100} Z`} fill={`url(#${id}-a)`} /> : null,
              )}
            {segs.map((s, i) => (
              <path key={i} d={curve(s, smooth)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))}
            {at != null && <line x1={x(at)} x2={x(at)} y1="0" y2="100" stroke="var(--ink)" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
        {/* Dots are HTML so they stay round while the SVG stretches. */}
        {segs
          .filter((s) => s.length === 1)
          .map((s) => (
            <span key={s[0].x} className="absolute size-2 -translate-1/2 rounded-full" style={{ left: `${s[0].x}%`, top: `${s[0].y}%`, background: color }} />
          ))}
        {lastI >= 0 && at == null && (
          <>
            {pulse && <span className="absolute size-7 -translate-1/2 animate-ping rounded-full opacity-30 motion-reduce:hidden" style={{ left: `${x(lastI)}%`, top: `${y(values[lastI]!)}%`, background: color }} />}
            <span className="absolute size-3 -translate-1/2 rounded-full ring-4 ring-surface" style={{ left: `${x(lastI)}%`, top: `${y(values[lastI]!)}%`, background: color }} />
          </>
        )}
        {at != null && (
          <>
            {values[at] != null && (
              <span className="absolute z-10 size-3.5 -translate-1/2 rounded-full ring-4 ring-surface" style={{ left: `${x(at)}%`, top: `${y(values[at]!)}%`, background: color }} />
            )}
            <Tooltip x={x(at)}>
              {values[at] != null ? format(values[at]!) : 'No data'}
              {tip && <span className="ml-1.5 font-semibold opacity-60">{tip(at)}</span>}
            </Tooltip>
          </>
        )}
        </div>
      </div>
      {labels.length > 0 && (
        <div className="relative mt-2 mr-12 h-4">
          {labels.map((l) => (
            <span
              key={l.i}
              className={cx('absolute text-[11px] font-medium whitespace-nowrap text-faint', l.i === 0 ? '' : l.i === n - 1 ? '-translate-x-full' : '-translate-x-1/2')}
              style={{ left: `${x(l.i)}%` }}
            >
              {l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tiny trend line for tiles. */
export function Sparkline({ values, tone = 'brand', height = 36 }: { values: (number | null)[]; tone?: Tone; height?: number }) {
  const known = values.filter((v): v is number => v != null)
  if (known.length < 2) return <div style={{ height }} />
  const lo = Math.min(...known)
  const hi = Math.max(...known) || 1
  const pts = values.flatMap((v, i) => (v == null ? [] : [{ x: (i / (values.length - 1)) * 100, y: 90 - ((v - lo) / (hi - lo || 1)) * 80 }]))
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full animate-reveal overflow-visible" style={{ height }} aria-hidden>
      <path d={curve(pts, true)} fill="none" stroke={TONE[tone].color} strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * 24-hour chart from 15-minute samples (96 values). Bars for stress, area for Body Battery, line for heart rate.
 * `colorFor` colors each bar by value.
 */
export function IntradayChart({
  values,
  mode,
  tone = 'brand',
  max,
  min = 0,
  height = 120,
  colorFor,
  format = (v) => String(Math.round(v)),
}: {
  values: (number | null)[]
  mode: 'bars' | 'area' | 'line'
  tone?: Tone
  max?: number
  min?: number
  height?: number
  colorFor?: (v: number) => string
  format?: (v: number) => string
}) {
  const id = useId()
  const n = values.length
  const { hover, handlers } = useScrub(n)
  const known = values.filter((v): v is number => v != null)
  const hi = max ?? (Math.max(...known, min + 1) * 1.08)
  const lo = mode === 'line' && known.length ? Math.min(...known) * 0.9 : min
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100
  const color = TONE[tone].color
  const segs: { x: number; y: number }[][] = []
  let cur: { x: number; y: number }[] = []
  values.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur)
      cur = []
    } else cur.push({ x: i + 0.5, y: y(v) })
  })
  if (cur.length) segs.push(cur)
  return (
    <div>
      <div className="relative touch-pan-y select-none" style={{ height }} {...handlers}>
        <div className="absolute inset-0 animate-reveal">
          <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity="0.45" />
                <stop offset="1" stopColor={color} stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {[0, 24, 48, 72, 96].map((g) => (
              <line key={g} x1={g * (n / 96)} x2={g * (n / 96)} y1="0" y2="100" stroke="var(--line)" vectorEffect="non-scaling-stroke" />
            ))}
            {mode === 'bars' &&
              values.map((v, i) =>
                v == null ? null : <rect key={i} x={i + 0.12} width={0.76} y={y(v)} height={100 - y(v)} rx="0.3" fill={colorFor ? colorFor(v) : color} opacity={hover == null || hover === i ? 1 : 0.55} />,
              )}
            {mode === 'area' &&
              segs.map((s, i) => (s.length > 1 ? <path key={i} d={`${curve(s, false)} L${s[s.length - 1].x},100 L${s[0].x},100 Z`} fill={`url(#${id}-a)`} /> : null))}
            {mode !== 'bars' &&
              segs.map((s, i) => <path key={i} d={curve(s, false)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            {hover != null && <line x1={hover + 0.5} x2={hover + 0.5} y1="0" y2="100" stroke="var(--ink)" strokeOpacity="0.3" vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
        {hover != null && (
          <Tooltip x={((hover + 0.5) / n) * 100}>
            {clock(hover * (1440 / n))} · {values[hover] != null ? format(values[hover]!) : '–'}
          </Tooltip>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] font-medium text-faint tabular">
        {['00', '06', '12', '18', '24'].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
    </div>
  )
}

/** Garmin-like stress colors: rest in blue, then lighter to darker orange. */
export const stressColor = (v: number) =>
  v <= 25 ? 'var(--battery)' : v <= 50 ? 'color-mix(in oklab, var(--stress) 50%, var(--surface))' : v <= 75 ? 'var(--stress)' : 'var(--stress-strong)'

export const STAGES: Record<SleepStage, { label: string; color: string; row: number }> = {
  awake: { label: 'Awake', color: 'var(--star)', row: 0 },
  rem: { label: 'REM', color: 'var(--battery)', row: 1 },
  light: { label: 'Light', color: 'color-mix(in oklab, var(--sleep) 50%, var(--surface))', row: 2 },
  deep: { label: 'Deep', color: 'var(--sleep)', row: 3 },
}

/** Sleep stages over the night, one row per stage. */
export function Hypnogram({ night, startClock, height = 150 }: { night: SleepNight; startClock: number; height?: number }) {
  const total = night.stages.at(-1)?.to ?? 1
  const first = Math.ceil(startClock / 60) * 60
  const ticks: number[] = []
  for (let t = first - startClock; t < total; t += 120) ticks.push(t)
  return (
    <div className="flex gap-2">
      <div className="relative w-11 shrink-0" style={{ height }}>
        {(Object.keys(STAGES) as SleepStage[]).map((s) => (
          <span key={s} className="absolute right-0 -translate-y-1/2 text-[10.5px] font-semibold text-faint" style={{ top: `${STAGES[s].row * 25 + 12.5}%` }}>
            {STAGES[s].label}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${r * 25 + 12.5}%` }} />
          ))}
          {night.stages.map((s, i) => (
            <div
              key={i}
              className="absolute animate-pop rounded-[4px]"
              title={`${STAGES[s.stage].label} ${clock(startClock + s.from)}–${clock(startClock + s.to)}`}
              style={{
                left: `${(s.from / total) * 100}%`,
                width: `max(2px, ${((s.to - s.from) / total) * 100}%)`,
                top: `${STAGES[s.stage].row * 25 + 3}%`,
                height: '19%',
                background: STAGES[s.stage].color,
                animationDelay: `${i * 18}ms`,
              }}
            />
          ))}
        </div>
        <div className="relative mt-2 h-4">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 text-[10.5px] font-medium text-faint tabular" style={{ left: `${(t / total) * 100}%` }}>
              {clock(startClock + t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Horizontal bar split into parts (sleep stages, sports…). */
export function SplitBar({ parts, className }: { parts: { value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1
  return (
    <div className={cx('flex h-3 origin-left animate-grow-x gap-1 overflow-hidden rounded-full', className)}>
      {parts
        .filter((p) => p.value > 0)
        .map((p, i) => (
          <div key={i} className="h-full rounded-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
    </div>
  )
}

/** GPS track drawn into its box, animated like a pen stroke. */
export function RouteMap({ route, height = 230, tone = 'brand' }: { route: [number, number][]; height?: number; tone?: Tone }) {
  const W = 400
  const H = 260
  const P = 26
  const lat0 = (route.reduce((s, p) => s + p[0], 0) / route.length) * (Math.PI / 180)
  const xs = route.map((p) => p[1] * Math.cos(lat0))
  const ys = route.map((p) => -p[0])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const k = Math.min((W - 2 * P) / (maxX - minX || 1), (H - 2 * P) / (maxY - minY || 1))
  const ox = (W - (maxX - minX) * k) / 2
  const oy = (H - (maxY - minY) * k) / 2
  const pts = xs.map((x, i) => [ox + (x - minX) * k, oy + (ys[i] - minY) * k] as const)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const color = TONE[tone].color
  const [sx, sy] = pts[0]
  const [ex, ey] = pts[pts.length - 1]
  return (
    <div
      className="relative overflow-hidden rounded-[22px] bg-surface-2"
      style={{
        height,
        backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--ink) 12%, transparent) 1px, transparent 0)',
        backgroundSize: '18px 18px',
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-label="Route map">
        <path d={d} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} pathLength={1} strokeDasharray="1" className="animate-draw" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={ex} cy={ey} r="8" fill="var(--ink)" stroke="var(--surface)" strokeWidth="3" className="animate-pop" style={{ animationDelay: '1.4s', transformOrigin: `${ex}px ${ey}px` }} />
        <circle cx={sx} cy={sy} r="8" fill="var(--train)" stroke="var(--surface)" strokeWidth="3" />
      </svg>
      <span className="absolute bottom-3 left-3 flex items-center gap-3 rounded-full bg-surface/85 px-3 py-1 text-[11px] font-semibold text-ink-2 backdrop-blur">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-train" /> Start
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-ink" /> Finish
        </span>
      </span>
    </div>
  )
}

/** Garmin's zone colors: grey, blue, green, orange, red. */
export const ZONE_COLORS = ['var(--muted)', 'var(--battery)', 'var(--train)', 'var(--stress)', 'var(--heart)']
const ZONE_NAMES = ['Warm up', 'Easy', 'Aerobic', 'Threshold', 'Maximum']

/** Time in heart-rate zones, zone 5 on top. */
export function ZoneBars({ zones, maxHr }: { zones: number[]; maxHr: number }) {
  const total = zones.reduce((s, z) => s + z, 0) || 1
  const top = Math.max(...zones) || 1
  const ranges = hrZones(maxHr)
  return (
    <div className="space-y-2.5">
      {[4, 3, 2, 1, 0].map((z, i) => (
        <div key={z} className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[12px] font-extrabold text-white" style={{ background: ZONE_COLORS[z] }}>
            {z + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="truncate font-semibold">
                {ZONE_NAMES[z]} <span className="font-medium text-faint tabular">{ranges[z].min}–{ranges[z].max}</span>
              </span>
              <span className="shrink-0 font-bold tabular">
                {hms(zones[z])} <span className="font-semibold text-faint">{Math.round((zones[z] / total) * 100)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full origin-left animate-grow-x rounded-full" style={{ width: `${(zones[z] / top) * 100}%`, background: ZONE_COLORS[z], animationDelay: `${i * 70}ms` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Month grid (Mon-first) with a custom renderer per day. */
export function MonthGrid({ month, today, render, onPick }: { month: ISODate; today: ISODate; render: (date: ISODate) => ReactNode; onPick?: (date: ISODate) => void }) {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const lead = weekday(first)
  const cells: (ISODate | null)[] = Array.from({ length: lead }, () => null)
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d)
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-faint">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) =>
          d ? (
            <button
              type="button"
              key={d}
              disabled={d > today || !onPick}
              onClick={() => onPick?.(d)}
              className={cx(
                'flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors enabled:hover:bg-surface-2',
                d === today && 'bg-brand-soft ring-1 ring-brand/30',
                d > today && 'opacity-35',
              )}
            >
              {render(d)}
              <span className="text-[10px] font-medium text-faint tabular">{Number(d.slice(8))}</span>
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  )
}
