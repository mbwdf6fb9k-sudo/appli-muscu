import type { Exercise, ExerciseTips, MuscleGroup, Target, Template, TemplateId } from './database'

/**
 * Le programme personnel (programme-muscu.md), écrit une seule fois.
 * applyProgram l'applique à la base : migration v5, base neuve et import d'une ancienne sauvegarde.
 */

/** Exercices existants renommés comme dans le programme (même id : l'historique suit). */
const RENAMES: Record<string, string> = {
  'tirage-horizontal-assis': 'Tirage horizontal, prise large, coudes ouverts',
  'pull-over-poulie': 'Pull-over à la poulie, bras tendus',
  'ecarte-poulie-vis-a-vis': 'Écarté poulie, du bas vers le haut',
  'extension-triceps-au-dessus-de-la-tete': 'Extension triceps au-dessus de la tête, poulie',
  'extension-triceps-poulie-haute-corde': 'Extension triceps poulie haute, barre',
  'extension-triceps-poulie': 'Extension triceps poulie, corde',
  'elevations-laterales': 'Élévations latérales haltères',
  'leg-curl': 'Leg curl assis',
  'souleve-de-terre-roumain': 'Soulevé de terre roumain haltères',
  'curl-pupitre': 'Curl pupitre machine',
  'oiseau-reverse-pec-deck': 'Oiseau à la machine (reverse pec deck)',
  'barre-au-front': 'Barre au front EZ',
  squat: 'Squat barre',
}

const NEW_EXERCISES: Exercise[] = [
  { id: 'rowing-poitrine-appuyee', name: 'Rowing poitrine appuyée, coudes serrés', type: 'weight' },
  { id: 'elevations-laterales-poulie', name: 'Élévations latérales à la poulie', type: 'weight' },
  { id: 'hack-squat', name: 'Hack squat', type: 'weight' },
  { id: 'mollets-presse', name: 'Mollets à la presse', type: 'weight' },
  { id: 'tirage-vertical-unilateral', name: 'Tirage vertical unilatéral à la poulie', type: 'weight' },
]

const t = (sets: number, min: number, max: number, rir?: string, rest?: string, superset?: string): Target => {
  const target: Target = { sets, min, max }
  if (rir) target.rir = rir
  if (rest) target.rest = rest
  if (superset) target.superset = superset
  return target
}

interface ProgramTemplate {
  id: TemplateId
  name: string
  duration?: string
  placement?: string
  advice?: string
  items: [string, Target][]
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'dos-biceps',
    name: 'Dos-Biceps',
    duration: '≈ 65 min',
    advice: 'Sangles autorisées sur les tirages lourds. « Tire avec les coudes, pas avec les mains. »',
    items: [
      ['tractions', t(3, 5, 10, '1-2', '2-3 min')],
      ['rowing-poitrine-appuyee', t(3, 8, 12, '1-2', '2 min')],
      ['tirage-horizontal-assis', t(3, 10, 12, '1', '1,5-2 min')],
      ['pull-over-poulie', t(2, 12, 15, '0-1', '1-1,5 min')],
      ['curl-incline-halteres', t(3, 8, 12, '1', '1,5 min')],
      ['curl-marteau', t(2, 10, 12, '1', '1 min')],
    ],
  },
  {
    id: 'pecs-triceps',
    name: 'Pecs-Triceps',
    duration: '≈ 65 min',
    items: [
      ['developpe-incline-halteres', t(3, 6, 10, '1-2', '2-3 min')],
      ['developpe-couche-barre', t(3, 6, 10, '2', '2-3 min')],
      ['ecarte-poulie-vis-a-vis', t(3, 10, 15, '1', '1,5 min')],
      ['elevations-laterales-poulie', t(3, 12, 20, '0-1', '1 min')],
      ['extension-triceps-au-dessus-de-la-tete', t(3, 8, 12, '1', '1,5 min')],
      ['extension-triceps-poulie-haute-corde', t(2, 10, 12, '0-1', '1 min')],
    ],
  },
  {
    id: 'jambes',
    name: 'Jambes + rappel dos et épaules',
    duration: '≈ 65 min',
    placement: 'Évite cette séance la veille du foot.',
    items: [
      ['hack-squat', t(3, 6, 10, '2', '2-3 min')],
      ['souleve-de-terre-roumain', t(3, 8, 10, '2', '2 min')],
      ['leg-curl', t(3, 10, 12, '1', '1,5 min')],
      ['leg-extension', t(3, 12, 15, '0-1', '1,5 min')],
      ['mollets-presse', t(2, 10, 15, '1', '1 min')],
      ['tirage-vertical-unilateral', t(3, 10, 12, '1', '1,5 min')],
      ['elevations-laterales-poulie', t(3, 12, 20, '0-1', '1 min')],
    ],
  },
  {
    id: 'bras',
    name: 'Bras + épaules',
    duration: '≈ 55 min',
    placement: 'Évite cette séance le lendemain de Dos-Biceps ou Pecs-Triceps.',
    items: [
      ['elevations-laterales', t(4, 12, 20, '0-1', '1 min')],
      ['curl-barre-ez', t(3, 6, 10, '1-2', undefined, 'A')],
      ['barre-au-front', t(3, 8, 12, '1-2', '1,5-2 min après la paire', 'A')],
      ['curl-pupitre', t(2, 10, 15, '0-1', undefined, 'B')],
      ['extension-triceps-poulie', t(2, 12, 15, '0-1', '1,5 min après la paire', 'B')],
      ['oiseau-reverse-pec-deck', t(3, 12, 20, '0-1', '1 min')],
    ],
  },
  {
    id: 'abdos',
    name: 'Abdos',
    advice: '2 séries en fin de séance.',
    items: [
      ['crunch-poulie', t(2, 10, 15)],
      ['releves-de-jambes-suspendu', t(2, 8, 15)],
      ['roue-abdominale', t(2, 6, 12)],
      ['gainage', t(2, 30, 60)],
    ],
  },
]

export const PROGRAM_TIPS: Record<string, ExerciseTips> = {
  tractions: {
    technique:
      'Prise un peu plus large que les épaules, partir bras tendus, tirer les coudes vers les hanches, menton au-dessus de la barre, descente contrôlée en 2 s. Lest dès 3 × 10.',
    errors: 'Demi-répétitions, balancer les jambes, épaules qui montent vers les oreilles.',
    replacement: 'Tirage vertical prise neutre.',
  },
  'rowing-poitrine-appuyee': {
    technique:
      'Poitrine collée au support, laisser les omoplates s’écarter à l’étirement, tirer les coudes le long du corps vers les hanches, 1 s de contraction.',
    errors: 'Décoller la poitrine, tirer avec les bras, hausser les épaules.',
    replacement: 'Rowing haltère unilatéral.',
  },
  'tirage-horizontal-assis': {
    technique:
      'Buste fixe, coudes écartés du corps, poignée vers le bas de la poitrine, serrer les omoplates en fin de mouvement.',
    errors: 'Se pencher en arrière pour tricher, hausser les épaules.',
    replacement: 'Rowing machine prise large.',
  },
  'pull-over-poulie': {
    technique:
      'Buste légèrement penché, coudes presque tendus et fixes, ramener la barre jusqu’aux cuisses, remonter jusqu’à l’étirement des dorsaux.',
    errors: 'Plier les coudes (ça devient un exercice de triceps).',
    replacement: 'Pull-over haltère sur banc.',
  },
  'curl-incline-halteres': {
    technique: 'Banc à 45-60°, bras pendants derrière le buste, coudes fixes, descente complète, pas d’élan.',
    replacement: 'Curl à la poulie basse, bras derrière le corps.',
  },
  'curl-marteau': {
    technique: 'Prise neutre, coudes collés au corps, pas de balancier.',
    replacement: 'Curl corde à la poulie.',
  },
  'developpe-incline-halteres': {
    technique:
      'Banc à 30°, omoplates serrées et basses, descendre jusqu’à l’étirement des pecs, coudes à 45-60° du buste.',
    errors: 'Banc trop incliné (au-delà de 45°, l’épaule prend le relais), amplitude coupée.',
    replacement: 'Développé incliné machine ou Smith à 30°.',
  },
  'developpe-couche-barre': {
    technique:
      'Pieds au sol, omoplates serrées, barre au bas des pecs en contrôle. Sans pareur : rester à 2 reps de l’échec et régler les sécurités.',
    replacement: 'Développé couché machine convergente.',
  },
  'ecarte-poulie-vis-a-vis': {
    technique:
      'Poulies en bas, ramener les mains à hauteur du menton, coudes légèrement fléchis et fixes, étirement contrôlé.',
    replacement: 'Pec deck.',
  },
  'elevations-laterales-poulie': {
    technique: 'Monter jusqu’à hauteur d’épaule en menant avec le coude, buste légèrement penché, sans élan.',
    errors: 'Hausser les épaules, balancer, monter trop haut.',
    replacement: 'Élévations latérales haltères ou machine.',
  },
  'extension-triceps-au-dessus-de-la-tete': {
    technique:
      'Dos à la poulie, corde, coudes fixes vers l’avant, descendre jusqu’à l’étirement complet derrière la tête.',
    replacement: 'Extension haltère au-dessus de la tête, assis.',
  },
  'extension-triceps-poulie-haute-corde': {
    technique: 'Coudes collés au corps, extension complète, les coudes ne bougent pas.',
    replacement: 'Dips machine assise.',
  },
  'hack-squat': {
    technique:
      'Pieds largeur d’épaules au milieu de la plateforme, descendre au moins cuisses parallèles, genoux dans l’axe des pieds.',
    errors: 'Amplitude coupée, talons qui décollent, bassin qui décolle du dossier en bas.',
    replacement: 'Presse à cuisses.',
  },
  'souleve-de-terre-roumain': {
    technique:
      'Genoux légèrement fléchis et fixes, pousser les fesses en arrière, haltères qui frôlent les cuisses, dos neutre, descendre jusqu’à l’étirement des ischios.',
    errors: 'Arrondir le dos, plier les genoux comme un squat.',
    replacement: 'Soulevé de terre roumain barre.',
  },
  'leg-curl': {
    technique: 'Bassin bien calé, buste légèrement penché en avant, flexion complète, retour lent.',
    replacement: 'Leg curl allongé.',
  },
  'leg-extension': {
    technique: 'Genou aligné avec l’axe de la machine, 1 s en haut, descente lente.',
    replacement: 'Presse à cuisses, pieds bas.',
  },
  'mollets-presse': {
    technique: 'Amplitude complète, 1 s d’étirement en bas.',
    replacement: 'Mollets debout.',
  },
  'tirage-vertical-unilateral': {
    technique:
      'Laisser le bras monter jusqu’à l’étirement complet, tirer le coude vers la hanche, enchaîner les deux bras.',
    replacement: 'Tirage vertical prise neutre.',
  },
  'elevations-laterales': {
    technique: 'Mêmes consignes qu’à la poulie : monter jusqu’à hauteur d’épaule en menant avec le coude, sans élan.',
    replacement: 'Élévations latérales machine.',
  },
  'curl-barre-ez': {
    technique: 'Coudes fixes le long du corps, pas d’élan du buste, descente complète.',
    replacement: 'Curl barre à la poulie basse.',
  },
  'barre-au-front': {
    technique: 'Allongé, barre vers le front, coudes fixes pointés vers le plafond.',
    errors: 'Si une gêne apparaît au coude (tennis) : passe au remplacement.',
    replacement: 'Extension triceps machine ou poulie.',
  },
  'curl-pupitre': {
    technique: 'Aisselles calées, extension presque complète en bas, sans rebond.',
    replacement: 'Curl pupitre haltère.',
  },
  'extension-triceps-poulie': {
    technique: 'Coudes collés, écarter la corde en bas.',
    replacement: 'Extension triceps poulie haute, barre.',
  },
  'oiseau-reverse-pec-deck': {
    technique: 'Prise neutre, bras presque tendus, ouvrir en menant avec les coudes.',
    replacement: 'Face pull.',
  },
}

/** Règles générales du programme (affichées dans Réglages → Exercices et modèles). */
export const PROGRAM_RULES: { title: string; text: string }[] = [
  {
    title: 'Reps qu’il doit te rester',
    text: 'À la fin d’une série, le nombre de reps que tu pourrais encore faire. « 1-2 » : arrête la série quand tu pourrais encore en faire 1 ou 2. « 0 » : va au bout.',
  },
  {
    title: 'Repos',
    text: '2-3 min sur les exercices polyarticulaires, 1-1,5 min sur l’isolation (affichés seulement, pas de minuteur).',
  },
  {
    title: 'Échauffement',
    text: '2-3 séries progressives sur le 1er exercice (≈ 50 % × 10, 70 % × 5, 85 % × 3), 1 série sur le 2e s’il est lourd. Non comptées.',
  },
  {
    title: 'Progression',
    text: 'Même charge tant que toutes les séries n’ont pas atteint le haut de la fourchette, en gardant les reps demandées ; ensuite +1 palier (barre/machine 2,5 kg, haltère suivant, 1 plaque à la poulie) et retour au bas de la fourchette.',
  },
]


/**
 * Applique le programme : renomme, ajoute, donne les consignes et remplace les modèles.
 * Les exercices perso et l'historique ne sont pas touchés. On peut l'appliquer plusieurs fois.
 */
export function applyProgram(exercises: Exercise[], templates: Template[]): { exercises: Exercise[]; templates: Template[] } {
  const byId = new Map(exercises.map((e) => [e.id, { ...e }]))
  for (const [id, name] of Object.entries(RENAMES)) {
    const exercise = byId.get(id)
    if (exercise) exercise.name = name
  }
  for (const exercise of NEW_EXERCISES) {
    if (!byId.has(exercise.id)) byId.set(exercise.id, { ...exercise })
  }
  for (const program of PROGRAM_TEMPLATES) {
    for (const [id] of program.items) {
      const exercise = byId.get(id)
      // Le programme en a besoin : on le réaffiche s'il avait été supprimé
      if (exercise?.hidden) delete exercise.hidden
    }
  }
  for (const [id, tips] of Object.entries(PROGRAM_TIPS)) {
    const exercise = byId.get(id)
    if (exercise) exercise.tips = { ...tips }
  }

  const programIds = new Set(PROGRAM_TEMPLATES.map((p) => p.id))
  const nextTemplates: Template[] = templates.filter((tpl) => !programIds.has(tpl.id))
  for (const program of PROGRAM_TEMPLATES) {
    const template: Template = {
      id: program.id,
      name: program.name,
      exerciseIds: program.items.map(([id]) => id).filter((id) => byId.has(id)),
      targets: Object.fromEntries(program.items.map(([id, target]) => [id, { ...target }])),
    }
    if (program.duration) template.duration = program.duration
    if (program.placement) template.placement = program.placement
    if (program.advice) template.advice = program.advice
    nextTemplates.push(template)
  }
  return { exercises: [...byId.values()], templates: nextTemplates }
}

/** Exercices aux haltères : palier par défaut de 2 kg (« haltère suivant »). */
const DUMBBELL_IDS = [
  'developpe-incline-halteres',
  'curl-incline-halteres',
  'curl-marteau',
  'elevations-laterales',
  'souleve-de-terre-roumain',
  'rowing-haltere',
  'curl-halteres',
  'kickback',
  'developpe-militaire-halteres',
  'fentes-bulgares',
]

/** Exercices polyarticulaires : échauffement proposé aussi quand ils sont en 2e position. */
const COMPOUND_IDS = [
  'tractions',
  'rowing-poitrine-appuyee',
  'tirage-horizontal-assis',
  'tirage-vertical',
  'tirage-vertical-unilateral',
  'rowing-barre',
  'rowing-haltere',
  'developpe-incline-halteres',
  'developpe-couche-barre',
  'developpe-militaire-halteres',
  'hack-squat',
  'squat',
  'presse-a-cuisses',
  'souleve-de-terre-roumain',
  'fentes-bulgares',
  'hip-thrust',
  'dips',
]

export const DUMBBELL_STEP = 2

/**
 * Valeurs par défaut de l'étape 8 : palier 2 kg aux haltères et case « polyarticulaire ».
 * Ne remplace jamais un réglage déjà fait (pas de charge ou case déjà définis).
 */
export function applyExerciseDefaults(exercises: Exercise[]): Exercise[] {
  return exercises.map((exercise) => {
    const next = { ...exercise }
    if (DUMBBELL_IDS.includes(next.id) && next.step === undefined) next.step = DUMBBELL_STEP
    if (COMPOUND_IDS.includes(next.id) && next.compound === undefined) next.compound = true
    return next
  })
}

/** Muscle principal de chaque exercice du programme (compte des séries par muscle). */
const MUSCLES: Record<MuscleGroup, string[]> = {
  dos: [
    'tractions',
    'tirage-vertical',
    'tirage-vertical-unilateral',
    'rowing-barre',
    'rowing-haltere',
    'rowing-poitrine-appuyee',
    'tirage-horizontal-assis',
    'pull-over-poulie',
    'shrugs',
  ],
  pecs: ['developpe-couche-barre', 'developpe-incline-halteres', 'ecarte-poulie-vis-a-vis', 'dips'],
  epaules: [
    'developpe-militaire-halteres',
    'elevations-laterales',
    'elevations-laterales-poulie',
    'oiseau-reverse-pec-deck',
    'face-pull',
  ],
  biceps: ['curl-barre-ez', 'curl-incline-halteres', 'curl-marteau', 'curl-pupitre', 'curl-halteres'],
  triceps: [
    'extension-triceps-poulie-haute-corde',
    'barre-au-front',
    'extension-triceps-au-dessus-de-la-tete',
    'extension-triceps-poulie',
    'kickback',
  ],
  quadriceps: ['squat', 'hack-squat', 'presse-a-cuisses', 'fentes-bulgares', 'leg-extension'],
  ischios: ['leg-curl', 'souleve-de-terre-roumain'],
  fessiers: ['hip-thrust'],
  mollets: ['mollets-debout', 'mollets-presse'],
  abdos: ['crunch-poulie', 'releves-de-jambes-suspendu', 'roue-abdominale', 'gainage'],
}

export const DEFAULT_MUSCLE: Record<string, MuscleGroup> = Object.fromEntries(
  (Object.entries(MUSCLES) as [MuscleGroup, string[]][]).flatMap(([muscle, ids]) => ids.map((id) => [id, muscle])),
)

/** Étape 9 : muscle principal par défaut. Ne remplace jamais un muscle déjà choisi. */
export function applyMuscleDefaults(exercises: Exercise[]): Exercise[] {
  return exercises.map((exercise) => {
    const muscle = DEFAULT_MUSCLE[exercise.id]
    return muscle && exercise.muscle === undefined ? { ...exercise, muscle } : exercise
  })
}
