import { useState } from 'react'
import { ALTERNATIVES, alternativeName, alternativesFor, ensureExercise } from '../db/alternatives'
import type { Session } from '../db/database'
import { useExercisesById } from '../db/exercises'
import { useDoneSessions } from '../db/sessions'
import { setSetting, useSettings } from '../db/settings'
import { swapExerciseUndoable } from '../db/undoable'
import { daysSince, formatDaysAgo } from '../lib/dates'
import { ExercisePicker } from './ExercisePicker'
import { Sheet } from './Sheet'

/** « Machine prise ? » : remplacer l'exercice pour cette séance seulement. */
export function AlternativesSheet(props: { session: Session; index: number; onClose: () => void }) {
  const { session, index } = props
  const exercisesById = useExercisesById()
  const sessions = useDoneSessions()
  const settings = useSettings()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!exercisesById || !sessions || !settings) return null

  const entry = session.exercises[index]
  if (!entry) return null
  const name = exercisesById.get(entry.exerciseId)?.name ?? 'cet exercice'
  const hidden = settings.hiddenAlternatives
  const inSession = session.exercises.map((e) => e.exerciseId)
  const options = alternativesFor(entry.exerciseId, exercisesById, sessions, hidden, inSession)
  const hiddenHere = (ALTERNATIVES[entry.exerciseId] ?? []).filter((id) => hidden.includes(id))
  const tipReplacement = exercisesById.get(entry.exerciseId)?.tips?.replacement

  async function choose(id: string) {
    setBusy(true)
    try {
      const exercise = await ensureExercise(id)
      if (exercise) await swapExerciseUndoable(session.id, index, exercise.id)
      props.onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet open={!picking} onClose={props.onClose} title={`Remplacer « ${name} »`}>
        <p className="muted small alt-intro">
          Pour cette séance seulement : ton modèle ne change pas.
          {entry.sets.length > 0 && ' Tes séries déjà faites restent, le remplaçant s’ajoute juste en dessous.'}
        </p>
        {options.length > 0 ? (
          <div className="card list-card alt-list">
            {options.map((option) => (
              <div key={option.id} className="list-row alt-row">
                <button className="alt-choose" onClick={() => choose(option.id)} disabled={busy}>
                  <span className="history-name">{option.name}</span>
                  <span className="muted small">
                    {[option.equipment, option.lastDone ? `fait ${formatDaysAgo(daysSince(option.lastDone))}` : 'jamais fait']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <button
                  className="btn btn-ghost btn-small alt-hide"
                  onClick={() => setSetting('hiddenAlternatives', [...hidden, option.id])}
                  aria-label={`${option.name} : pas dans ma salle`}
                >
                  Pas dans ma salle
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted hint">
            Aucun remplacement prévu pour cet exercice.
            {tipReplacement && ` Conseil de la fiche : ${tipReplacement}`}
          </p>
        )}
        {hiddenHere.length > 0 && (
          <button
            className="btn btn-ghost btn-small alt-unhide"
            onClick={() => setSetting('hiddenAlternatives', hidden.filter((id) => !hiddenHere.includes(id)))}
          >
            Réafficher les remplacements masqués ({hiddenHere.map((id) => alternativeName(id, exercisesById)).join(', ')})
          </button>
        )}
        <div className="sheet-actions">
          <button className="btn btn-secondary" onClick={() => setPicking(true)} disabled={busy}>
            Autre exercice…
          </button>
        </div>
      </Sheet>
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        excludeIds={inSession}
        onPick={(id) => void choose(id)}
      />
    </>
  )
}
