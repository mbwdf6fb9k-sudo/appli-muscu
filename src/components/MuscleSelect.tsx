import type { MuscleGroup } from '../db/database'
import { MUSCLE_LABELS, MUSCLE_ORDER } from '../lib/muscleVolume'

/** Choix du groupe musculaire (obligatoire : pas de « Autre »). */
export function MuscleSelect(props: { value: MuscleGroup | ''; onChange: (muscle: MuscleGroup) => void; id?: string }) {
  return (
    <select
      id={props.id}
      className="text-input"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as MuscleGroup)}
      aria-invalid={props.value === ''}
    >
      <option value="" disabled>
        Choisir un groupe…
      </option>
      {MUSCLE_ORDER.map((m) => (
        <option key={m} value={m}>
          {MUSCLE_LABELS[m]}
        </option>
      ))}
    </select>
  )
}
