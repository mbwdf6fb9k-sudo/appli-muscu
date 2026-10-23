import type { Exercise, ExerciseType, SessionTemplateId, Supplement, Template, TemplateId } from './database'

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  'dos-biceps': 'Dos-Biceps',
  'pecs-triceps': 'Pecs-Triceps',
  jambes: 'Jambes + rappel dos et épaules',
  bras: 'Bras + épaules',
  abdos: 'Abdos',
}

/** Les séances proposées sur l'écran Aujourd'hui, dans l'ordre. */
export const SESSION_TEMPLATE_IDS: SessionTemplateId[] = ['dos-biceps', 'pecs-triceps', 'jambes', 'bras']

/** « Développé couché barre » → « developpe-couche-barre » */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const BODYWEIGHT = new Set(['Tractions', 'Dips', 'Relevés de jambes suspendu', 'Roue abdominale'])
const DURATION = new Set(['Gainage'])

const LISTS: Record<TemplateId, string[]> = {
  'dos-biceps': [
    'Tractions',
    'Tirage vertical',
    'Rowing barre',
    'Rowing haltère',
    'Tirage horizontal assis',
    'Pull-over poulie',
    'Curl barre EZ',
    'Curl incliné haltères',
    'Curl marteau',
  ],
  'pecs-triceps': [
    'Développé couché barre',
    'Développé incliné haltères',
    'Écarté poulie vis-à-vis',
    'Dips',
    'Extension triceps poulie haute (corde)',
    'Barre au front',
    'Extension triceps au-dessus de la tête',
  ],
  jambes: [
    'Squat',
    'Presse à cuisses',
    'Fentes bulgares',
    'Leg extension',
    'Leg curl',
    'Soulevé de terre roumain',
    'Hip thrust',
    'Mollets debout',
  ],
  bras: [
    'Développé militaire haltères',
    'Élévations latérales',
    'Oiseau / reverse pec deck',
    'Face pull',
    'Shrugs',
    'Curl pupitre',
    'Curl haltères',
    'Extension triceps poulie',
    'Kickback',
  ],
  abdos: ['Crunch poulie', 'Relevés de jambes suspendu', 'Roue abdominale', 'Gainage'],
}

function typeOf(name: string): ExerciseType {
  if (DURATION.has(name)) return 'duration'
  if (BODYWEIGHT.has(name)) return 'bodyweight'
  return 'weight'
}

export const DEFAULT_EXERCISES: Exercise[] = Object.values(LISTS)
  .flat()
  .map((name) => ({ id: slugify(name), name, type: typeOf(name) }))

export const DEFAULT_TEMPLATES: Template[] = (Object.keys(LISTS) as TemplateId[]).map((id) => ({
  id,
  name: TEMPLATE_NAMES[id],
  exerciseIds: LISTS[id].map(slugify),
}))

/** Compléments du cahier des charges, avec leur moment en jour d'entraînement et en jour de repos. */
export const DEFAULT_SUPPLEMENTS: Supplement[] = (
  [
    { name: 'Bion 3', training: 'breakfast', rest: 'breakfast' },
    { name: 'Vitamine D3', training: 'lunch', rest: 'lunch' },
    { name: 'Oméga 3', training: 'lunch', rest: 'lunch' },
    { name: 'Collagène + vitamine C', training: 'pre45', rest: 'breakfast' },
    { name: 'Préworkout', training: 'pre20', rest: null, caffeine: true },
    { name: 'BCAA', training: 'during', rest: null },
    {
      name: 'Créatine',
      dose: '3 à 5 g',
      note: 'Tous les jours, même au repos : c’est la régularité qui compte.',
      training: 'after',
      rest: 'lunch',
    },
    { name: 'Magnésium bisglycinate', training: 'bedtime', rest: 'bedtime' },
    { name: 'Ashwagandha KSM-66', training: 'bedtime', rest: 'bedtime' },
  ] satisfies Omit<Supplement, 'id' | 'order'>[]
).map((s, order) => ({ ...s, id: slugify(s.name), order }))
