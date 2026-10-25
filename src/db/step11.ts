import type { Exercise, ExerciseTips, Session, Target, Template } from './database'

/**
 * Étape 11 (modifs-seances-2.md) : exercices renommés et classés, nouveaux modèles, correction d'une séance.
 * Tout est ciblé par identifiant et ne fait rien si l'élément n'existe pas. On peut l'appliquer plusieurs fois.
 * Utilisé par la migration v8, une base neuve et l'import d'une ancienne sauvegarde.
 */

// Exercices créés dans l'appli (identifiants de l'export du 25/10/2026)
export const PULLOVER_MACHINE = 'b1e85a69-1de7-4c7b-8250-ba1934bbb383'
export const WIDE_CHEST_PRESS = '9a2875df-d1ce-46ad-b79d-258c4f103dca'
export const LATERAL_MACHINE = '400330cb-d4e8-4b78-b78d-b063e8151afe'
export const INCLINE_BARBELL = 'developpe-incline-barre'
/** Pecs-Triceps du 24/10 : le développé incliné a été fait à la barre, pas aux haltères */
export const BARBELL_SESSION = 'dc0282ff-1eb0-46fd-a6d7-0040fe170f8b'

const t = (sets: number, min: number, max: number, rir: string, rest: string): Target => ({ sets, min, max, rir, rest })

const TIPS: Record<string, ExerciseTips> = {
  [PULLOVER_MACHINE]: {
    technique:
      'Bras ou avant-bras contre les appuis, prise légère (ce sont les coudes qui poussent), ramener les coudes vers les hanches, remonter jusqu’à l’étirement complet des dorsaux.',
    errors: 'Tirer avec les mains et les bras.',
    replacement: 'Pull-over à la poulie, bras tendus.',
  },
  [WIDE_CHEST_PRESS]: {
    technique:
      'Siège réglé pour que les poignées arrivent au niveau du bas des pecs, omoplates serrées contre le dossier, coudes à 45-60° du buste, retour contrôlé jusqu’à l’étirement des pecs, ne pas verrouiller les coudes.',
    errors: 'Siège trop haut (l’épaule prend le relais), amplitude coupée.',
    replacement: 'Développé couché barre.',
  },
  [LATERAL_MACHINE]: {
    technique:
      'Épaules alignées avec l’axe de rotation de la machine, coudes contre les coussinets, monter jusqu’à hauteur d’épaules, descente lente.',
    errors: 'Hausser les épaules, donner de l’élan.',
    replacement: 'Élévations latérales à la poulie.',
  },
  'presse-a-cuisses': {
    technique:
      'Pieds largeur d’épaules au milieu de la plateforme, descendre jusqu’à environ 90° aux genoux (ou un peu plus bas) sans que le bas du dos décolle du dossier, genoux dans l’axe des pieds, ne pas verrouiller les genoux en haut.',
    errors: 'Amplitude coupée, bassin qui décolle en bas.',
    replacement: 'Hack squat.',
  },
  'hip-thrust': {
    technique:
      'Haut du dos appuyé sur le banc (bas des omoplates), pieds largeur de hanches, tibias verticaux en haut du mouvement, menton rentré, monter en serrant les fessiers jusqu’à l’alignement épaules-hanches-genoux, 1 s en haut.',
    errors: 'Cambrer le bas du dos au lieu de serrer les fessiers, pieds trop loin ou trop près.',
    replacement: 'Soulevé de terre roumain haltères.',
  },
  [INCLINE_BARBELL]: {
    technique:
      'Note le poids total, barre comprise. Banc à 30°, pieds au sol, omoplates serrées et basses, barre qui descend en contrôle sur le haut des pecs (juste sous les clavicules), coudes à 45-60° du buste. Sans pareur : rester à 2 reps de l’échec et régler les sécurités.',
    errors: 'Banc trop incliné (au-delà de 45°, l’épaule prend le relais), rebond sur la poitrine, fesses qui décollent du banc.',
    replacement: 'Développé incliné haltères (ou Smith à 30°).',
  },
}

/** Exercices créés dans l'appli : nouveau nom, groupe, polyarticulaire, palier. */
const CUSTOM: Record<string, Pick<Exercise, 'name' | 'muscle' | 'compound' | 'step'>> = {
  [PULLOVER_MACHINE]: { name: 'Pull-over machine', muscle: 'dos', compound: false, step: 2.5 },
  [WIDE_CHEST_PRESS]: { name: 'Wide chest press', muscle: 'pecs', compound: true, step: 2.5 },
  [LATERAL_MACHINE]: { name: 'Élévations latérales machine', muscle: 'epaules', compound: false, step: 2.5 },
}

const NEW_INCLINE: Exercise = {
  id: INCLINE_BARBELL,
  name: 'Développé incliné barre',
  type: 'weight',
  muscle: 'pecs',
  compound: true,
  step: 2.5,
}

export function applyStep11Exercises(exercises: Exercise[]): Exercise[] {
  const byId = new Map(exercises.map((e) => [e.id, { ...e }]))
  if (!byId.has(INCLINE_BARBELL)) byId.set(INCLINE_BARBELL, { ...NEW_INCLINE })

  for (const [id, values] of Object.entries(CUSTOM)) {
    const exercise = byId.get(id)
    if (!exercise) continue
    exercise.name = values.name
    exercise.muscle = values.muscle
    exercise.step = values.step
    if (values.compound) exercise.compound = true
    else delete exercise.compound
  }
  // Hip thrust : fessiers (sauf si un autre groupe a été choisi à la main)
  const hipThrust = byId.get('hip-thrust')
  if (hipThrust && (hipThrust.muscle === undefined || hipThrust.muscle === 'ischios')) hipThrust.muscle = 'fessiers'

  for (const [id, tips] of Object.entries(TIPS)) {
    const exercise = byId.get(id)
    if (exercise) exercise.tips = { ...tips }
  }
  return [...byId.values()]
}

/**
 * Remplace `from` par `to` à la même place (sans doublon), avec l'objectif donné.
 * Si ni l'un ni l'autre n'est dans le modèle, on n'y touche pas.
 */
function replaceAt(template: Template, from: string, to: string, target: Target): void {
  const ids = [...template.exerciseIds]
  const at = ids.indexOf(from)
  if (at >= 0) {
    if (ids.includes(to)) ids.splice(at, 1)
    else ids.splice(at, 1, to)
  }
  if (!ids.includes(to)) return
  template.exerciseIds = ids
  const targets = { ...template.targets }
  delete targets[from]
  targets[to] = { ...target }
  template.targets = targets
}

/** Place `id` à la position `index` (0 = premier), avec l'objectif donné. */
function placeAt(template: Template, id: string, index: number, target: Target): void {
  const ids = template.exerciseIds.filter((x) => x !== id)
  ids.splice(Math.min(index, ids.length), 0, id)
  template.exerciseIds = ids
  template.targets = { ...template.targets, [id]: { ...target } }
}

const JAMBES: [string, Target][] = [
  ['presse-a-cuisses', t(3, 8, 12, '1-2', '2-3 min')],
  ['hip-thrust', t(3, 8, 12, '1-2', '2 min')],
  ['leg-curl', t(4, 10, 12, '1', '1,5 min')],
  ['leg-extension', t(3, 12, 15, '0-1', '1,5 min')],
  ['tirage-vertical-unilateral', t(3, 10, 12, '1', '1,5 min')],
  [LATERAL_MACHINE, t(3, 12, 20, '0-1', '1 min')],
]

export function applyStep11Templates(templates: Template[], exercises: Exercise[]): Template[] {
  const exists = new Set(exercises.map((e) => e.id))
  return templates.map((original) => {
    const template: Template = { ...original, exerciseIds: [...original.exerciseIds], targets: { ...original.targets } }
    if (template.id === 'dos-biceps' && exists.has(PULLOVER_MACHINE)) {
      replaceAt(template, 'pull-over-poulie', PULLOVER_MACHINE, t(2, 12, 15, '0-1', '1-1,5 min'))
    }
    if (template.id === 'pecs-triceps') {
      replaceAt(template, 'developpe-incline-halteres', INCLINE_BARBELL, t(3, 6, 10, '2', '2-3 min'))
      if (!template.exerciseIds.includes(INCLINE_BARBELL)) placeAt(template, INCLINE_BARBELL, 0, t(3, 6, 10, '2', '2-3 min'))
      if (exists.has(WIDE_CHEST_PRESS)) placeAt(template, WIDE_CHEST_PRESS, 1, t(3, 6, 10, '1-2', '2-3 min'))
      if (exists.has(LATERAL_MACHINE)) placeAt(template, LATERAL_MACHINE, 3, t(3, 12, 20, '0-1', '1 min'))
    }
    if (template.id === 'jambes') {
      const items = JAMBES.filter(([id]) => exists.has(id))
      template.exerciseIds = items.map(([id]) => id)
      template.targets = Object.fromEntries(items.map(([id, target]) => [id, { ...target }]))
    }
    return template
  })
}

/** Exercices des nouveaux modèles : réaffichés s'ils avaient été supprimés. */
export function unhideStep11(exercises: Exercise[], templates: Template[]): Exercise[] {
  const used = new Set(templates.flatMap((tpl) => tpl.exerciseIds))
  return exercises.map((e) => {
    if (!e.hidden || !used.has(e.id)) return e
    const visible = { ...e }
    delete visible.hidden
    return visible
  })
}

/** La séance du 24/10 : les séries « développé incliné haltères » passent sur le développé incliné barre. */
export function applyStep11Session(session: Session): Session {
  if (session.id !== BARBELL_SESSION) return session
  if (session.exercises.some((e) => e.exerciseId === INCLINE_BARBELL)) return session
  const exercises = session.exercises.map((e) =>
    e.exerciseId === 'developpe-incline-halteres' ? { ...e, exerciseId: INCLINE_BARBELL } : e,
  )
  return {
    ...session,
    exercises,
    exerciseIds: [...new Set(exercises.filter((e) => e.sets.length > 0).map((e) => e.exerciseId))],
  }
}

/** Les trois réunis, sur des tableaux (base ou sauvegarde). */
export function applyStep11(tables: { exercises: Exercise[]; templates: Template[]; sessions: Session[] }) {
  const exercises = applyStep11Exercises(tables.exercises)
  const templates = applyStep11Templates(tables.templates, exercises)
  return {
    exercises: unhideStep11(exercises, templates),
    templates,
    sessions: tables.sessions.map(applyStep11Session),
  }
}
