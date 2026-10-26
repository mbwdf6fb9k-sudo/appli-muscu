import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ALTERNATIVES, NEW_ALTERNATIVES, alternativesFor, ensureExercise } from '../db/alternatives'
import { db, type Exercise, type Session } from '../db/database'
import { applyExerciseDefaults, applyMuscleDefaults, applyProgram } from '../db/program'
import { DEFAULT_EXERCISES, DEFAULT_TEMPLATES } from '../db/seed'
import { swapExercise } from '../db/sessions'
import { applyStep11, LATERAL_MACHINE, PULLOVER_MACHINE, WIDE_CHEST_PRESS } from '../db/step11'
import { swapExerciseUndoable } from '../db/undoable'
import { runUndo } from './undo'

/** Exercices et modèles comme sur le téléphone (programme + 3 exercices créés + étape 11). */
function library() {
  const program = applyProgram(structuredClone(DEFAULT_EXERCISES), structuredClone(DEFAULT_TEMPLATES))
  const custom: Exercise[] = [
    { id: PULLOVER_MACHINE, name: 'pull-over machine', type: 'weight' },
    { id: WIDE_CHEST_PRESS, name: 'wide chest press', type: 'weight' },
    { id: LATERAL_MACHINE, name: 'élévation latérale machine', type: 'weight' },
  ]
  return applyStep11({
    exercises: [...applyMuscleDefaults(applyExerciseDefaults(program.exercises)), ...custom],
    templates: program.templates,
    sessions: [],
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('table des remplacements', () => {
  it('chaque exercice des modèles a au moins 2 remplacements, du même groupe musculaire', () => {
    const { exercises, templates } = library()
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const muscleOf = (id: string) => byId.get(id)?.muscle ?? NEW_ALTERNATIVES[id]?.muscle
    for (const template of templates) {
      for (const id of template.exerciseIds) {
        const options = alternativesFor(id, byId, [], [], [id])
        expect(options.length, `${template.id} / ${id}`).toBeGreaterThanOrEqual(2)
        for (const option of options) expect(muscleOf(option.id), `${id} → ${option.id}`).toBe(muscleOf(id))
      }
    }
  })

  it('chaque remplacement existe déjà ou a une fiche complète (groupe, type, consigne)', () => {
    const { exercises } = library()
    const ids = new Set(exercises.map((e) => e.id))
    for (const id of new Set(Object.values(ALTERNATIVES).flat())) {
      if (ids.has(id)) continue
      const spec = NEW_ALTERNATIVES[id]
      expect(spec, id).toBeDefined()
      expect(spec.muscle, id).toBeDefined()
      expect(spec.tips?.technique, id).toBeTruthy()
    }
    // Smith : poids sans la barre ; haltères : un seul haltère, palier 2 kg
    expect(NEW_ALTERNATIVES['developpe-incline-smith'].tips?.technique).toMatch(/sans la barre/)
    expect(NEW_ALTERNATIVES['developpe-couche-halteres'].step).toBe(2)
    expect(NEW_ALTERNATIVES['developpe-couche-halteres'].tips?.technique).toMatch(/un seul haltère/)
  })

  it('déjà faits d’abord, sans les masqués ni ceux déjà dans la séance ; exercice perso : même groupe déjà fait', () => {
    const { exercises } = library()
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const done: Session = {
      id: 'd',
      templateId: 'pecs-triceps',
      date: '2026-10-20',
      startedAt: '2026-10-20T16:00:00.000Z',
      endedAt: null,
      status: 'done',
      exercises: [],
      exerciseIds: ['chest-press-inclinee', 'developpe-couche-barre'],
    }
    const options = alternativesFor('developpe-incline-barre', byId, [done], [], [])
    // Déjà fait (chest press inclinée) d'abord, puis l'ordre prévu
    expect(options.map((o) => o.id)).toEqual(['chest-press-inclinee', 'developpe-incline-halteres', 'developpe-incline-smith'])
    expect(options.find((o) => o.id === 'developpe-incline-smith')).toMatchObject({ equipment: 'Smith', isNew: true, lastDone: null })
    const masked = alternativesFor('developpe-incline-barre', byId, [done], ['developpe-incline-smith'], ['developpe-incline-halteres'])
    expect(masked.map((o) => o.id)).toEqual(['chest-press-inclinee'])
    byId.set('perso', { id: 'perso', name: 'Ma machine pecs', type: 'weight', muscle: 'pecs' })
    expect(alternativesFor('perso', byId, [done], [], []).map((o) => o.id)).toEqual(['developpe-couche-barre'])
  })
})

describe('remplacer pendant la séance', () => {
  const session = (sets = false): Session => ({
    id: 's',
    templateId: 'pecs-triceps',
    date: '2026-10-26',
    startedAt: '2026-10-26T16:00:00.000Z',
    endedAt: null,
    status: 'active',
    exercises: [
      {
        exerciseId: 'developpe-incline-barre',
        type: 'weight',
        sets: sets ? [{ reps: 8, kg: 50, at: '1' }] : [],
        note: '',
        target: { sets: 3, min: 6, max: 10, rir: '2', rest: '2-3 min' },
      },
      { exerciseId: 'roue-abdominale', type: 'bodyweight', sets: [], note: '', fromAbs: true, target: { sets: 2, min: 6, max: 12 } },
    ],
    exerciseIds: sets ? ['developpe-incline-barre'] : [],
  })

  it('création à la demande sans doublon ; un exercice supprimé est réaffiché', async () => {
    const first = await ensureExercise('developpe-incline-smith')
    const again = await ensureExercise('developpe-incline-smith')
    expect(first).toEqual(again)
    expect(await db.exercises.where('name').equals('Développé incliné Smith').count()).toBe(1)
    await db.exercises.put({ id: 'rowing-haltere', name: 'Rowing haltère', type: 'weight', hidden: true })
    expect((await ensureExercise('rowing-haltere'))?.hidden).toBeUndefined()
  })

  it('sans séries : remplacé sur place, avec l’objectif repris ; le modèle ne change pas', async () => {
    const before = await db.templates.get('pecs-triceps')
    await db.sessions.put(session())
    await ensureExercise('developpe-incline-smith')
    await swapExercise('s', 0, 'developpe-incline-smith')
    const s = (await db.sessions.get('s'))!
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['developpe-incline-smith', 'roue-abdominale'])
    expect(s.exercises[0].target).toEqual({ sets: 3, min: 6, max: 10, rir: '2', rest: '2-3 min' })
    expect(await db.templates.get('pecs-triceps')).toEqual(before)
  })

  it('avec des séries faites : elles restent, le remplaçant s’ajoute juste après', async () => {
    await db.sessions.put(session(true))
    await swapExercise('s', 0, 'developpe-incline-halteres')
    const s = (await db.sessions.get('s'))!
    expect(s.exercises.map((e) => e.exerciseId)).toEqual(['developpe-incline-barre', 'developpe-incline-halteres', 'roue-abdominale'])
    expect(s.exercises[0].sets).toHaveLength(1)
    expect(s.exercises[1].target?.sets).toBe(3)
  })

  it('reps ↔ durée : l’objectif vient du modèle de l’exercice choisi', async () => {
    await db.sessions.put(session())
    await swapExercise('s', 1, 'gainage')
    const s = (await db.sessions.get('s'))!
    expect(s.exercises[1]).toMatchObject({ exerciseId: 'gainage', type: 'duration', fromAbs: true, target: { sets: 2, min: 30, max: 60 } })
  })

  it('« Annuler » remet l’exercice d’origine', async () => {
    await db.sessions.put(session())
    await swapExerciseUndoable('s', 0, 'developpe-incline-halteres')
    expect((await db.sessions.get('s'))!.exercises[0].exerciseId).toBe('developpe-incline-halteres')
    await runUndo()
    expect(await db.sessions.get('s')).toEqual(session())
  })
})
