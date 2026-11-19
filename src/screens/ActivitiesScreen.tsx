import { CalendarDays, ChevronLeft, ChevronRight, Footprints, List, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useActivities, useToday, useUnits } from '../app/hooks'
import { ActivityRow } from '../components/activity'
import { BarChart, MonthGrid } from '../components/charts'
import { Button, Card, ChipTabs, EmptyState, IconButton, PageHeader, SectionTitle, Segmented, Skeleton, TONE, cx } from '../components/ui'
import { SPORT_GROUPS, SPORTS } from '../config/sports'
import { weeklyVolume } from '../domain/stats'
import type { Activity } from '../domain/types'
import { addDays, addMonths, formatDay, formatDayShort, formatMonth, startOfMonth, startOfWeek, type ISODate } from '../lib/dates'
import { duration, formatNumber, plural } from '../lib/format'

const PAGE = 25

export default function ActivitiesScreen() {
  const today = useToday()
  const { data } = useActivities(addDays(today, -365), today)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [group, setGroup] = useState('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const sports = SPORT_GROUPS.find((g) => g.key === group)!.sports
    const q = query.trim().toLowerCase()
    return (data ?? []).filter((a) => (!sports.length || sports.includes(a.sport)) && (!q || a.name.toLowerCase().includes(q) || SPORTS[a.sport].label.toLowerCase().includes(q)))
  }, [data, group, query])

  return (
    <div className="animate-fade-in">
      <PageHeader
        subtitle="Synced from Garmin"
        title="Activities"
        actions={
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            className="w-[104px]"
            options={[
              { value: 'list', label: <><List className="size-4" /><span className="sr-only">List</span></> },
              { value: 'calendar', label: <><CalendarDays className="size-4" /><span className="sr-only">Calendar</span></> },
            ]}
          />
        }
      />
      <div className="px-4">
        <ChipTabs value={group} onChange={setGroup} options={SPORT_GROUPS.map((g) => ({ value: g.key, label: g.label }))} />
        {!data ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-[320px]" />
          </div>
        ) : view === 'list' ? (
          <ListView activities={filtered} today={today} query={query} setQuery={setQuery} />
        ) : (
          <CalendarView activities={filtered} today={today} />
        )}
      </div>
    </div>
  )
}

function Volume({ activities, today }: { activities: Activity[]; today: ISODate }) {
  const u = useUnits()
  const [metric, setMetric] = useState<'time' | 'distance'>('time')
  const weeks = weeklyVolume(activities, 12, today)
  const last4 = weeks.slice(-4)
  const totals = {
    count: last4.reduce((s, w) => s + w.count, 0),
    distance: last4.reduce((s, w) => s + w.distance_m, 0),
    time: last4.reduce((s, w) => s + w.duration_s, 0),
    elev: last4.reduce((s, w) => s + w.elevation_m, 0),
  }
  return (
    <Card className="mt-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-faint uppercase">Last 4 weeks</p>
          <p className="display mt-1.5 text-[34px]">
            {metric === 'time' ? duration(totals.time / 60) : u.distNum(totals.distance)}
            {metric === 'distance' && <span className="ml-1 text-base font-semibold tracking-normal text-muted">{u.distUnit}</span>}
          </p>
        </div>
        <Segmented
          size="sm"
          value={metric}
          onChange={setMetric}
          className="w-[150px]"
          options={[
            { value: 'time', label: 'Time' },
            { value: 'distance', label: 'Distance' },
          ]}
        />
      </div>
      <div className="mt-3 mb-5 flex gap-4 text-[13px] text-muted">
        <span>
          <b className="text-ink tabular">{totals.count}</b> activities
        </span>
        <span>
          <b className="text-ink tabular">{u.elev(totals.elev)}</b> climbed
        </span>
      </div>
      <BarChart
        key={metric}
        tone="brand"
        height={130}
        format={(v) => (metric === 'time' ? duration(v) : `${v.toFixed(1)} ${u.distUnit}`)}
        bars={weeks.map((w, i) => ({
          key: w.week,
          label: i % 4 === 0 ? formatDayShort(w.week) : '',
          value: metric === 'time' ? w.duration_s / 60 : u.toDist(w.distance_m),
          active: i === weeks.length - 1,
          level: i === weeks.length - 1 ? 'good' : 'ok',
        }))}
      />
    </Card>
  )
}

function ListView({ activities, today, query, setQuery }: { activities: Activity[]; today: ISODate; query: string; setQuery: (q: string) => void }) {
  const u = useUnits()
  const [shown, setShown] = useState(PAGE)
  // Group by week, newest first.
  const groups = useMemo(() => {
    const m = new Map<ISODate, Activity[]>()
    for (const a of activities.slice(0, shown)) {
      const w = startOfWeek(a.date)
      m.set(w, [...(m.get(w) ?? []), a])
    }
    return [...m.entries()]
  }, [activities, shown])
  const thisWeek = startOfWeek(today)

  return (
    <>
      <Volume activities={activities} today={today} />
      <div className="mt-4 flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-1 ring-line/60 transition focus-within:bg-surface">
        <Search className="size-[18px] shrink-0 text-faint" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search activities" aria-label="Search activities" className="h-full w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-faint hover:text-ink">
            <X className="size-4" />
          </button>
        )}
      </div>
      {activities.length === 0 ? (
        <EmptyState icon={Footprints} title="Nothing here" text={query ? 'No activity matches your search.' : 'No activities of this kind in the last year.'} />
      ) : (
        groups.map(([week, list]) => (
          <section key={week}>
            <SectionTitle
              action={
                <span className="text-[13px] font-semibold text-muted tabular">
                  {plural(list.length, 'activity', 'activities')} · {u.dist(list.reduce((s, a) => s + a.distance_m, 0))}
                </span>
              }
            >
              {week === thisWeek ? 'This week' : week === addDays(thisWeek, -7) ? 'Last week' : `Week of ${formatDayShort(week)}`}
            </SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              {list.map((a, i) => (
                <ActivityRow key={a.id} a={a} index={Math.min(i, 8)} />
              ))}
            </Card>
          </section>
        ))
      )}
      {shown < activities.length && (
        <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)} className="mt-5 w-full">
          Show more
        </Button>
      )}
    </>
  )
}

function CalendarView({ activities, today }: { activities: Activity[]; today: ISODate }) {
  const u = useUnits()
  const [month, setMonth] = useState(startOfMonth(today))
  const [picked, setPicked] = useState<ISODate>(today)
  const byDate = useMemo(() => {
    const m = new Map<ISODate, Activity[]>()
    for (const a of activities) m.set(a.date, [...(m.get(a.date) ?? []), a])
    return m
  }, [activities])
  const inMonth = activities.filter((a) => a.date.startsWith(month.slice(0, 7)))
  const dayActs = byDate.get(picked) ?? []
  return (
    <>
      <Card className="mt-4 p-4">
        <div className="mb-4 flex items-center justify-between">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => setMonth(addMonths(month, -1))} disabled={month <= startOfMonth(addDays(today, -365))} />
          <div className="text-center">
            <p className="font-bold">{formatMonth(month)}</p>
            <p className="text-[12px] text-muted tabular">
              {plural(inMonth.length, 'activity', 'activities')} · {duration(inMonth.reduce((s, a) => s + a.duration_s, 0) / 60)} · {u.dist(inMonth.reduce((s, a) => s + a.distance_m, 0))}
            </p>
          </div>
          <IconButton icon={ChevronRight} label="Next month" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= startOfMonth(today)} />
        </div>
        <MonthGrid
          key={month}
          month={month}
          today={today}
          onPick={setPicked}
          render={(d) => {
            const list = byDate.get(d) ?? []
            return (
              <span className={cx('flex h-5 items-center gap-0.5 rounded-full px-1', d === picked && 'bg-ink')}>
                {list.length === 0 ? (
                  <span className={cx('size-1.5 rounded-full', d === picked ? 'bg-bg' : 'bg-line')} />
                ) : (
                  list.slice(0, 3).map((a) => {
                    const Icon = SPORTS[a.sport].icon
                    return <Icon key={a.id} className={cx('size-3.5 animate-pop', d === picked ? 'text-bg' : TONE[SPORTS[a.sport].tone].text)} strokeWidth={2.4} />
                  })
                )}
              </span>
            )
          }}
        />
      </Card>
      <SectionTitle>{formatDay(picked)}</SectionTitle>
      {dayActs.length === 0 ? (
        <Card>
          <EmptyState title="Rest day" text="No activities recorded on this day." />
        </Card>
      ) : (
        <Card key={picked} className="divide-y divide-line overflow-hidden">
          {dayActs.map((a, i) => (
            <ActivityRow key={a.id} a={a} index={i} />
          ))}
        </Card>
      )}
      <p className="mt-6 text-center text-[12px] text-faint">
        {formatNumber(activities.length)} activities in the last 12 months
      </p>
    </>
  )
}
