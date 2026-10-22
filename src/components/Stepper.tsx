import { useEffect, useState } from 'react'
import { formatNumber, parseNumber } from '../lib/format'
import { MinusIcon, PlusIcon } from './icons'

interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step: number
  min?: number
  /** Nombre entier uniquement (reps, secondes) */
  integer?: boolean
}

const round = (value: number) => Math.round(value * 100) / 100

/** Valeur avec boutons − / + ; on peut aussi toucher le nombre pour le taper. */
export function Stepper({ label, value, onChange, step, min = 0, integer = false }: StepperProps) {
  const [text, setText] = useState(formatNumber(value))

  useEffect(() => setText(formatNumber(value)), [value])

  const commit = (raw: string) => {
    const parsed = parseNumber(raw)
    if (parsed === undefined) return setText(formatNumber(value))
    const next = Math.max(min, integer ? Math.round(parsed) : round(parsed))
    onChange(next)
    setText(formatNumber(next))
  }

  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`${label} moins ${formatNumber(step)}`}
          onClick={() => onChange(Math.max(min, round(value - step)))}
          disabled={value <= min}
        >
          <MinusIcon />
        </button>
        <input
          className={text.length >= 5 ? 'stepper-value xlong' : text.length === 4 ? 'stepper-value long' : 'stepper-value'}
          inputMode={integer ? 'numeric' : 'decimal'}
          aria-label={label}
          value={text}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={`${label} plus ${formatNumber(step)}`}
          onClick={() => onChange(round(value + step))}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}
