import { CalendarDays, Scale } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useToday, useUnits } from '../../app/hooks'
import { useToast } from '../../components/toast'
import { Button, Field, Sheet } from '../../components/ui'
import { repo } from '../../data/repo'

/** Manual weigh-in. A manual entry replaces the scale's value for that day. */
export default function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = useToday()
  const u = useUnits()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(value.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return setError('Enter your weight as a number.')
    setError(null)
    setBusy(true)
    try {
      await repo.addWeight(date, u.toKg(n))
      toast('Weight saved')
      setValue('')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <form onSubmit={submit} className="space-y-4">
        <Field
          label={`Weight (${u.weightUnit})`}
          icon={Scale}
          inputMode="decimal"
          placeholder={u.units === 'imperial' ? 'e.g. 165.4' : 'e.g. 72.4'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <Field label="Date" icon={CalendarDays} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value || today)} />
        {error && (
          <p className="animate-pop rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">
          Save
        </Button>
      </form>
    </Sheet>
  )
}
