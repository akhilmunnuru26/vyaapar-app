import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { IconCalendar, IconCheck, IconChevronDown } from '@tabler/icons-react'

export type PeriodValue = { label: string; range?: { start: string; end: string } | null }

const PRESETS = [
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last 30 days',
  'This month',
  'Last month',
  'This year',
] as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`
}

export function ReportingPeriod({
  value,
  onChange,
}: {
  value: PeriodValue
  onChange: (next: PeriodValue) => void
}) {
  const [open, setOpen] = useState(false)
  const [align, setAlign] = useState<'left' | 'right'>('left')
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  const [start, setStart] = useState(value.range?.start ?? '')
  const [end, setEnd] = useState(value.range?.end ?? '')

  useLayoutEffect(() => {
    if (!open) return
    const popover = rootRef.current?.querySelector<HTMLElement>('.date-popover')
    if (!popover) return
    const rect = popover.getBoundingClientRect()
    setAlign(rect.right > window.innerWidth - 8 ? 'right' : 'left')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const openCustom = () => {
    setStart(value.range?.start ?? '')
    setEnd(value.range?.end ?? '')
  }

  const rangeInvalid = Boolean(start && end && start > end)
  const canApply = Boolean(start && end && !rangeInvalid)

  const applyCustom = () => {
    if (!canApply) return
    onChange({ label: 'Custom range', range: { start, end } })
    setOpen(false)
  }

  const triggerLabel =
    value.label === 'Custom range' && value.range
      ? `${fmtShort(value.range.start)} – ${fmtShort(value.range.end)}`
      : value.label

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        type="button"
        className={`date-trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          if (!open) openCustom()
          setOpen((o) => !o)
        }}
      >
        <span className="date-trigger-icon"><IconCalendar size={16} /></span>
        <span className="date-trigger-label">{triggerLabel}</span>
        <IconChevronDown size={15} className="date-trigger-caret" />
      </button>

      {open && (
        <div className={`date-popover align-${align}`} id={popoverId} role="listbox" aria-label="Reporting period">
          <p className="date-popover-title">Reporting period</p>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="option"
              aria-selected={value.label === preset}
              className={`date-option ${value.label === preset ? 'is-selected' : ''}`}
              onClick={() => {
                onChange({ label: preset, range: null })
                setOpen(false)
              }}
            >
              <span>{preset}</span>
              {value.label === preset && <IconCheck size={15} />}
            </button>
          ))}
          <div className="date-custom">
            <p className="date-popover-title">Custom range</p>
            <div className="date-range-inputs">
              <label>
                Start date
                <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label>
                End date
                <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            {rangeInvalid && <p className="date-range-error">End date can&apos;t be earlier than the start date.</p>}
            <div className="date-custom-actions">
              <button
                type="button"
                className="date-btn-secondary"
                onClick={() => {
                  setStart('')
                  setEnd('')
                }}
              >
                Cancel
              </button>
              <button type="button" className="date-btn-primary" disabled={!canApply} onClick={applyCustom}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
