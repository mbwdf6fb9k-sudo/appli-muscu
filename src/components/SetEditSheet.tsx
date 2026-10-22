import { useState } from 'react'
import type { ExerciseType, SetEntry } from '../db/database'
import type { SetValues } from '../lib/prefill'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

export function withoutTime(set: SetEntry): SetValues {
  const { at: _at, ...values } = set
  return values
}

/** Les champs d'une série selon le type d'exercice. */
export function SetInputs(props: { type: ExerciseType; values: SetValues; onChange: (v: SetValues) => void; step: number }) {
  const { type, values, onChange, step } = props
  if (type === 'duration') {
    return (
      <div className="set-inputs">
        <Stepper
          label="Secondes"
          value={values.seconds ?? 0}
          step={5}
          integer
          onChange={(seconds) => onChange({ ...values, seconds })}
        />
      </div>
    )
  }
  return (
    <div className="set-inputs set-inputs-2">
      <Stepper label="Reps" value={values.reps ?? 0} step={1} integer onChange={(reps) => onChange({ ...values, reps })} />
      <Stepper
        label={type === 'bodyweight' ? 'Lest (kg)' : 'Kg'}
        value={values.kg ?? 0}
        step={step}
        onChange={(kg) => onChange({ ...values, kg })}
      />
    </div>
  )
}

interface SetEditSheetProps {
  type: ExerciseType
  title: string
  initial: SetValues
  step: number
  onClose: () => void
  onSave: (values: SetValues) => void
  /** Absent pour l'ajout d'une nouvelle série */
  onDelete?: () => void
}

/** Corriger (ou ajouter) une série. */
export function SetEditSheet(props: SetEditSheetProps) {
  const [values, setValues] = useState<SetValues>(props.initial)
  return (
    <Sheet open onClose={props.onClose} title={props.title}>
      <SetInputs type={props.type} values={values} onChange={setValues} step={props.step} />
      <div className="sheet-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            props.onSave(values)
            props.onClose()
          }}
        >
          Enregistrer
        </button>
        {props.onDelete && (
          <button
            className="btn btn-ghost btn-danger"
            onClick={() => {
              props.onDelete!()
              props.onClose()
            }}
          >
            Supprimer la série
          </button>
        )}
      </div>
    </Sheet>
  )
}
