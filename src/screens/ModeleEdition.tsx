import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { EditableRow } from '../components/EditableRow'
import { ExercisePicker, TYPE_LABELS } from '../components/ExercisePicker'
import { ChevronLeftIcon, PlusIcon } from '../components/icons'
import { Screen } from '../components/Screen'
import type { TemplateId } from '../db/database'
import { setTemplateExercises, useExercisesById, useTemplate } from '../db/exercises'
import { TEMPLATE_NAMES } from '../db/seed'

export function ModeleEdition() {
  const { id } = useParams()
  const navigate = useNavigate()
  const templateId = id && id in TEMPLATE_NAMES ? (id as TemplateId) : undefined
  const template = useTemplate(templateId)
  const exercisesById = useExercisesById()
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!templateId || template === null) return <Navigate to="/reglages/exercices" replace />
  if (!template || !exercisesById) return null

  const list = template.exerciseIds.filter((x) => exercisesById.has(x) && !exercisesById.get(x)?.hidden)
  const save = (ids: string[]) => setTemplateExercises(templateId, ids)

  const move = (index: number, direction: -1 | 1) => {
    const next = [...list]
    const [moved] = next.splice(index, 1)
    next.splice(index + direction, 0, moved)
    void save(next)
  }

  return (
    <Screen
      title={TEMPLATE_NAMES[templateId]}
      subtitle="Exercices proposés au début de la séance"
      leading={
        <button className="icon-btn icon-btn-back" onClick={() => navigate('/reglages/exercices')} aria-label="Retour">
          <ChevronLeftIcon />
        </button>
      }
    >
      <div className="card editable-list">
        {list.map((exerciseId, index) => {
          const exercise = exercisesById.get(exerciseId)!
          return (
            <EditableRow
              key={exerciseId}
              label={exercise.name}
              detail={TYPE_LABELS[exercise.type]}
              isFirst={index === 0}
              isLast={index === list.length - 1}
              onMove={(direction) => move(index, direction)}
              onRemove={() => save(list.filter((x) => x !== exerciseId))}
            />
          )
        })}
        {list.length === 0 && <p className="muted small hint">Aucun exercice dans ce modèle.</p>}
      </div>
      <div className="session-tools session-tools-stack">
        <button className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
          <PlusIcon /> Ajouter un exercice
        </button>
      </div>
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={list}
        onPick={(exerciseId) => save([...list, exerciseId])}
      />
    </Screen>
  )
}
