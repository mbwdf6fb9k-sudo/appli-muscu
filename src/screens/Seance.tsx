import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { EditableRow } from '../components/EditableRow'
import { ExerciseCard } from '../components/ExerciseCard'
import { ExercisePicker } from '../components/ExercisePicker'
import { ChevronLeftIcon, PlusIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import type { Session } from '../db/database'
import { setTemplateExercises, useExercisesById, useTemplate } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'
import {
  abandonSession,
  addAbs,
  addExercises,
  finishSession,
  moveExercise,
  removeExercise,
  templateListFromSession,
  useActiveSession,
} from '../db/sessions'
import { useSettings } from '../db/settings'
import { formatDuration, formatTime } from '../lib/format'
import { sessionStats } from '../lib/sessionStats'
import { useNow } from '../lib/useNow'

const OPEN_KEY = 'appli-muscu-open-exercise'

/** Exercice ouvert au lancement : celui mémorisé, sinon le premier sans série. */
function initialOpen(session: Session): string | null {
  const ids = session.exercises.map((e) => e.exerciseId)
  try {
    const saved = localStorage.getItem(OPEN_KEY)
    if (saved === '') return null
    if (saved && ids.includes(saved)) return saved
  } catch {
    // stockage indisponible : choix automatique
  }
  return session.exercises.find((e) => e.sets.length === 0)?.exerciseId ?? null
}

export function Seance() {
  const session = useActiveSession()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  if (session === null && !leaving) return <Navigate to="/" replace />
  if (!session) return null
  return <SeanceView session={session} onLeave={(to) => { setLeaving(true); navigate(to, { replace: true }) }} />
}

function SeanceView({ session, onLeave }: { session: Session; onLeave: (to: string) => void }) {
  const navigate = useNavigate()
  const exercisesById = useExercisesById()
  const template = useTemplate(session.templateId)
  const settings = useSettings()
  const now = useNow()

  // Exercice ouvert (mémorisé pour le retrouver après fermeture de l'appli)
  const [openId, setOpenIdState] = useState(() => initialOpen(session))
  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [askTemplate, setAskTemplate] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  const setOpenId = (id: string | null) => {
    setOpenIdState(id)
    try {
      localStorage.setItem(OPEN_KEY, id ?? '')
    } catch {
      // pas grave : on rouvrira le premier exercice
    }
  }

  const ids = session.exercises.map((e) => e.exerciseId)
  const currentOpen = openId

  const stats = sessionStats(session, now)
  const templateIds = (template?.exerciseIds ?? []).filter((id) => !exercisesById?.get(id)?.hidden)

  function finishEditing() {
    setEditing(false)
    const list = templateListFromSession(session)
    if (template && list.join() !== templateIds.join()) setAskTemplate(true)
  }

  function handleRemove(index: number) {
    const entry = session.exercises[index]
    const name = exercisesById?.get(entry.exerciseId)?.name ?? 'cet exercice'
    if (entry.sets.length > 0 && !confirm(`Retirer ${name} et ses ${entry.sets.length} série(s) ?`)) return
    void removeExercise(session.id, index)
  }

  async function handleFinish() {
    await finishSession(session.id)
    onLeave(`/seance/${session.id}/resume`)
  }

  async function handleAbandon() {
    await abandonSession(session.id)
    onLeave('/')
  }

  if (!exercisesById || !settings) return null

  return (
    <Screen
      title={TEMPLATE_NAMES[session.templateId]}
      subtitle={`Commencée à ${formatTime(new Date(session.startedAt))} · ${formatDuration(stats.durationMs)}`}
      leading={
        <button className="icon-btn icon-btn-back" onClick={() => navigate('/')} aria-label="Retour à l’accueil">
          <ChevronLeftIcon />
        </button>
      }
      trailing={
        <button className="btn btn-secondary btn-small" onClick={() => setFinishOpen(true)}>
          Terminer
        </button>
      }
    >
      {editing ? (
        <div className="card editable-list">
          {session.exercises.map((entry, index) => (
            <EditableRow
              key={entry.exerciseId}
              label={exercisesById.get(entry.exerciseId)?.name ?? 'Exercice supprimé'}
              detail={entry.sets.length > 0 ? `${entry.sets.length} série(s)` : entry.fromAbs ? 'Abdos' : undefined}
              isFirst={index === 0}
              isLast={index === session.exercises.length - 1}
              onMove={(direction) => moveExercise(session.id, index, direction)}
              onRemove={() => handleRemove(index)}
            />
          ))}
          {session.exercises.length === 0 && <p className="muted small hint">Aucun exercice.</p>}
        </div>
      ) : (
        <div className="exercise-list">
          {session.exercises.map((entry, index) => (
            <ExerciseCard
              key={entry.exerciseId}
              session={session}
              index={index}
              entry={entry}
              exercise={exercisesById.get(entry.exerciseId)}
              open={currentOpen === entry.exerciseId}
              onToggle={() => setOpenId(currentOpen === entry.exerciseId ? null : entry.exerciseId)}
              defaultStep={settings.weightStep}
            />
          ))}
          {session.exercises.length === 0 && (
            <p className="muted small hint">Aucun exercice : ajoutes-en avec « Modifier la liste ».</p>
          )}
        </div>
      )}

      <div className={editing ? 'session-tools session-tools-stack' : 'session-tools'}>
        {editing ? (
          <>
            <button className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
              <PlusIcon /> Ajouter un exercice
            </button>
            <button className="btn btn-primary" onClick={finishEditing}>
              Terminé
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => addAbs(session.id)}>
              <PlusIcon /> Abdos
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>
              Modifier la liste
            </button>
          </>
        )}
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={ids}
        onPick={(id) => addExercises(session.id, [id])}
      />

      <Sheet open={askTemplate} onClose={() => setAskTemplate(false)} title="Modifier aussi le modèle ?">
        <p className="muted">
          La liste d’exercices a changé. Veux-tu l’utiliser aussi pour tes prochaines séances{' '}
          {TEMPLATE_NAMES[session.templateId]} ? Les abdos ajoutés avec « + Abdos » ne sont pas recopiés.
        </p>
        <div className="sheet-actions">
          <button
            className="btn btn-primary"
            onClick={async () => {
              await setTemplateExercises(session.templateId, templateListFromSession(session))
              setAskTemplate(false)
            }}
          >
            Oui, modifier le modèle
          </button>
          <button className="btn btn-secondary" onClick={() => setAskTemplate(false)}>
            Non, juste aujourd’hui
          </button>
        </div>
      </Sheet>

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={stats.setCount > 0 ? 'Terminer la séance ?' : 'Aucune série enregistrée'}
      >
        {stats.setCount > 0 ? (
          <>
            <p className="muted">
              {stats.setCount} série{stats.setCount > 1 ? 's' : ''} · {formatDuration(stats.durationMs)}
            </p>
            <div className="sheet-actions">
              <button className="btn btn-primary" onClick={handleFinish}>
                Terminer
              </button>
              <button className="btn btn-secondary" onClick={() => setFinishOpen(false)}>
                Continuer la séance
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">Tu peux abandonner cette séance : elle ne sera pas gardée.</p>
            <div className="sheet-actions">
              <button className="btn btn-secondary btn-danger" onClick={handleAbandon}>
                Abandonner la séance
              </button>
              <button className="btn btn-primary" onClick={() => setFinishOpen(false)}>
                Continuer la séance
              </button>
            </div>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
