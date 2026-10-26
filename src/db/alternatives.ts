import type { Exercise, Session } from './database'
import { db } from './database'
import { DUMBBELL_STEP } from './program'
import { INCLINE_BARBELL, LATERAL_MACHINE, PULLOVER_MACHINE, WIDE_CHEST_PRESS } from './step11'

/**
 * « Machine prise ? » : remplacements pensés pour Fitness Park (barres, haltères, poulies vis-à-vis, Smith,
 * machines guidées). Même muscle, même type de mouvement, autre matériel. Tout est hors ligne.
 */

export type Equipment = 'barre' | 'haltères' | 'poulie' | 'machine' | 'Smith' | 'poids du corps'

/** Exercice proposé qui n'existe pas encore : il n'est créé que le jour où on le choisit. */
type Spec = Omit<Exercise, 'id'>

const SMITH_NOTE = 'À la Smith, note le poids des disques sans la barre (elle n’a pas le même poids partout).'
const ONE_DUMBBELL = 'Note le poids d’un seul haltère.'

const NEW: Record<string, Spec> = {
  'tirage-vertical-prise-neutre': {
    name: 'Tirage vertical prise neutre',
    type: 'weight',
    muscle: 'dos',
    compound: true,
    tips: { technique: 'Poignée prise neutre, buste légèrement incliné, tirer les coudes vers les hanches jusqu’au haut de la poitrine, remonter en contrôle.' },
  },
  'rowing-machine-prise-neutre': {
    name: 'Rowing machine prise neutre',
    type: 'weight',
    muscle: 'dos',
    compound: true,
    tips: { technique: 'Poitrine contre l’appui, coudes serrés le long du corps, tirer vers les hanches, 1 s de contraction.' },
  },
  'rowing-machine-prise-large': {
    name: 'Rowing machine prise large',
    type: 'weight',
    muscle: 'dos',
    compound: true,
    tips: { technique: 'Poitrine contre l’appui, coudes écartés, tirer vers le bas de la poitrine en serrant les omoplates.' },
  },
  'tirage-horizontal-prise-serree': {
    name: 'Tirage horizontal prise serrée',
    type: 'weight',
    muscle: 'dos',
    compound: true,
    tips: { technique: 'Poignée triangle, buste fixe, tirer les coudes le long du corps vers le ventre, ne pas se pencher en arrière.' },
  },
  'pull-over-haltere': {
    name: 'Pull-over haltère',
    type: 'weight',
    muscle: 'dos',
    step: DUMBBELL_STEP,
    tips: { technique: `Allongé en travers ou sur le banc, bras presque tendus, descendre l’haltère derrière la tête jusqu’à l’étirement des dorsaux. ${ONE_DUMBBELL}` },
  },
  'curl-poulie-dos': {
    name: 'Curl à la poulie basse, dos à la poulie',
    type: 'weight',
    muscle: 'biceps',
    tips: { technique: 'Dos à la poulie, un pas en avant, bras tiré en arrière au départ (étirement du biceps), monter sans avancer le coude.' },
  },
  'curl-halteres-assis': {
    name: 'Curl haltères assis',
    type: 'weight',
    muscle: 'biceps',
    step: DUMBBELL_STEP,
    tips: { technique: `Assis dos calé, coudes fixes le long du corps, supination en montant, descente lente. ${ONE_DUMBBELL}` },
  },
  'curl-marteau-corde': {
    name: 'Curl marteau à la corde (poulie)',
    type: 'weight',
    muscle: 'biceps',
    tips: { technique: 'Corde à la poulie basse, prise neutre, coudes fixes, monter jusqu’à la poitrine, descente contrôlée.' },
  },
  'curl-marteau-croise': {
    name: 'Curl marteau croisé',
    type: 'weight',
    muscle: 'biceps',
    step: DUMBBELL_STEP,
    tips: { technique: `Prise neutre, monter l’haltère vers l’épaule opposée, coude fixe. ${ONE_DUMBBELL}` },
  },
  'developpe-incline-smith': {
    name: 'Développé incliné Smith',
    type: 'weight',
    muscle: 'pecs',
    compound: true,
    step: 2.5,
    tips: { technique: `Banc à 30°, barre qui descend sur le haut des pecs, omoplates serrées, coudes à 45-60°. ${SMITH_NOTE}` },
  },
  'chest-press-inclinee': {
    name: 'Chest press inclinée (machine)',
    type: 'weight',
    muscle: 'pecs',
    compound: true,
    tips: { technique: 'Siège réglé pour que les poignées arrivent au haut des pecs, omoplates serrées, ne pas verrouiller les coudes.' },
  },
  'developpe-couche-halteres': {
    name: 'Développé couché haltères',
    type: 'weight',
    muscle: 'pecs',
    compound: true,
    step: DUMBBELL_STEP,
    tips: { technique: `Omoplates serrées, descendre jusqu’à l’étirement des pecs, coudes à 45-60°. ${ONE_DUMBBELL}` },
  },
  'chest-press': {
    name: 'Chest press (machine)',
    type: 'weight',
    muscle: 'pecs',
    compound: true,
    tips: { technique: 'Poignées au niveau du bas des pecs, omoplates contre le dossier, retour contrôlé jusqu’à l’étirement.' },
  },
  'pec-deck': {
    name: 'Pec deck (butterfly)',
    type: 'weight',
    muscle: 'pecs',
    tips: { technique: 'Coudes légèrement fléchis à hauteur des pecs, rapprocher les bras en serrant les pecs, ouvrir lentement.' },
  },
  'ecarte-halteres': {
    name: 'Écarté haltères',
    type: 'weight',
    muscle: 'pecs',
    step: DUMBBELL_STEP,
    tips: { technique: `Coudes légèrement fléchis et fixes, descendre jusqu’à l’étirement, remonter en arc de cercle. ${ONE_DUMBBELL}` },
  },
  'extension-nuque-haltere': {
    name: 'Extension nuque haltère',
    type: 'weight',
    muscle: 'triceps',
    step: DUMBBELL_STEP,
    tips: { technique: 'Assis dos calé, un haltère tenu à deux mains derrière la tête, coudes vers le haut et serrés, tendre les bras.' },
  },
  'squat-smith': {
    name: 'Squat Smith',
    type: 'weight',
    muscle: 'quadriceps',
    compound: true,
    step: 2.5,
    tips: { technique: `Pieds un peu en avant de la barre, descendre au moins à 90° sans décoller les talons, dos droit. ${SMITH_NOTE}` },
  },
  'hip-thrust-smith': {
    name: 'Hip thrust Smith',
    type: 'weight',
    muscle: 'fessiers',
    compound: true,
    step: 2.5,
    tips: { technique: `Haut du dos sur le banc, barre sur le bassin (avec un coussin), monter en serrant les fessiers, 1 s en haut. ${SMITH_NOTE}` },
  },
  'glute-drive': {
    name: 'Machine fessiers (glute drive)',
    type: 'weight',
    muscle: 'fessiers',
    compound: true,
    tips: { technique: 'Ceinture sur le bassin, pieds largeur de hanches, pousser avec les talons en serrant les fessiers, 1 s en haut.' },
  },
  'leg-curl-allonge': {
    name: 'Leg curl allongé',
    type: 'weight',
    muscle: 'ischios',
    tips: { technique: 'Bassin collé au banc, ramener les talons vers les fessiers, descente lente sans verrouiller les genoux.' },
  },
  'presse-pieds-bas': {
    name: 'Presse pieds bas et serrés',
    type: 'weight',
    muscle: 'quadriceps',
    compound: true,
    tips: { technique: 'Pieds bas et rapprochés sur la plateforme pour cibler les quadriceps, genoux dans l’axe, sans décoller le bassin.' },
  },
  'curl-poulie-barre': {
    name: 'Curl poulie basse barre droite',
    type: 'weight',
    muscle: 'biceps',
    tips: { technique: 'Coudes fixes le long du corps, monter la barre jusqu’à la poitrine, descente contrôlée.' },
  },
  'curl-pupitre-ez': {
    name: 'Curl pupitre barre EZ',
    type: 'weight',
    muscle: 'biceps',
    step: 2.5,
    tips: { technique: 'Bras à plat sur le pupitre, descendre presque bras tendus, monter sans décoller les coudes.' },
  },
  'curl-concentre': {
    name: 'Curl concentré haltère',
    type: 'weight',
    muscle: 'biceps',
    step: DUMBBELL_STEP,
    tips: { technique: `Assis, coude calé contre l’intérieur de la cuisse, monter en supination, descente lente. ${ONE_DUMBBELL}` },
  },
  'oiseau-poulie': {
    name: 'Oiseau poulie croisée',
    type: 'weight',
    muscle: 'epaules',
    tips: { technique: 'Câbles croisés à hauteur d’épaules, bras presque tendus, ouvrir vers l’arrière sans hausser les épaules.' },
  },
  'oiseau-halteres': {
    name: 'Oiseau haltères buste penché',
    type: 'weight',
    muscle: 'epaules',
    step: DUMBBELL_STEP,
    tips: { technique: `Buste penché presque à l’horizontale, dos droit, ouvrir les bras sur les côtés, coudes légèrement fléchis. ${ONE_DUMBBELL}` },
  },
  'crunch-machine': {
    name: 'Crunch machine',
    type: 'weight',
    muscle: 'abdos',
    tips: { technique: 'Enrouler le buste en rapprochant les côtes du bassin, sans tirer avec les bras.' },
  },
  'releves-genoux-chaise': {
    name: 'Relevés de genoux à la chaise romaine',
    type: 'bodyweight',
    muscle: 'abdos',
    tips: { technique: 'Dos collé au dossier, monter les genoux en enroulant le bassin, descente lente sans balancer.' },
  },
}

/** Remplacements, dans l'ordre proposé (identifiants existants ou de NEW). */
export const ALTERNATIVES: Record<string, string[]> = {
  tractions: ['tirage-vertical', 'tirage-vertical-prise-neutre', 'tirage-vertical-unilateral'],
  'tirage-vertical': ['tractions', 'tirage-vertical-prise-neutre', 'tirage-vertical-unilateral'],
  'tirage-vertical-unilateral': ['tirage-vertical-prise-neutre', 'tirage-vertical', 'tractions'],
  'rowing-poitrine-appuyee': ['rowing-machine-prise-neutre', 'rowing-haltere', 'tirage-horizontal-prise-serree'],
  'tirage-horizontal-assis': ['rowing-machine-prise-large', 'rowing-poitrine-appuyee', 'rowing-haltere'],
  [PULLOVER_MACHINE]: ['pull-over-poulie', 'pull-over-haltere'],
  'pull-over-poulie': [PULLOVER_MACHINE, 'pull-over-haltere'],
  'curl-incline-halteres': ['curl-poulie-dos', 'curl-halteres-assis', 'curl-pupitre'],
  'curl-marteau': ['curl-marteau-corde', 'curl-marteau-croise'],
  [INCLINE_BARBELL]: ['developpe-incline-halteres', 'developpe-incline-smith', 'chest-press-inclinee'],
  'developpe-incline-halteres': [INCLINE_BARBELL, 'developpe-incline-smith', 'chest-press-inclinee'],
  [WIDE_CHEST_PRESS]: ['developpe-couche-barre', 'developpe-couche-halteres', 'chest-press'],
  'developpe-couche-barre': ['developpe-couche-halteres', WIDE_CHEST_PRESS, 'chest-press'],
  'ecarte-poulie-vis-a-vis': ['pec-deck', 'ecarte-halteres'],
  [LATERAL_MACHINE]: ['elevations-laterales-poulie', 'elevations-laterales'],
  'elevations-laterales-poulie': [LATERAL_MACHINE, 'elevations-laterales'],
  'elevations-laterales': ['elevations-laterales-poulie', LATERAL_MACHINE],
  'extension-triceps-au-dessus-de-la-tete': ['extension-nuque-haltere', 'barre-au-front'],
  'extension-triceps-poulie-haute-corde': ['extension-triceps-poulie', 'kickback'],
  'extension-triceps-poulie': ['extension-triceps-poulie-haute-corde', 'kickback'],
  'presse-a-cuisses': ['hack-squat', 'squat-smith', 'fentes-bulgares'],
  'hack-squat': ['presse-a-cuisses', 'squat-smith', 'fentes-bulgares'],
  'hip-thrust': ['hip-thrust-smith', 'glute-drive'],
  'leg-curl': ['leg-curl-allonge', 'souleve-de-terre-roumain'],
  'leg-extension': ['presse-pieds-bas', 'hack-squat'],
  'curl-barre-ez': ['curl-halteres', 'curl-poulie-barre'],
  'barre-au-front': ['extension-triceps-poulie-haute-corde', 'extension-nuque-haltere'],
  'curl-pupitre': ['curl-pupitre-ez', 'curl-concentre'],
  'oiseau-reverse-pec-deck': ['oiseau-poulie', 'face-pull', 'oiseau-halteres'],
  'crunch-poulie': ['crunch-machine', 'releves-de-jambes-suspendu'],
  'releves-de-jambes-suspendu': ['releves-genoux-chaise', 'crunch-poulie'],
  'roue-abdominale': ['gainage', 'releves-de-jambes-suspendu'],
  gainage: ['roue-abdominale', 'releves-genoux-chaise'],
}

/** Matériel affiché sous chaque proposition. */
const EQUIPMENT: Record<string, Equipment> = {
  tractions: 'poids du corps',
  'tirage-vertical': 'poulie',
  'tirage-vertical-prise-neutre': 'poulie',
  'tirage-vertical-unilateral': 'poulie',
  'rowing-machine-prise-neutre': 'machine',
  'rowing-machine-prise-large': 'machine',
  'rowing-poitrine-appuyee': 'machine',
  'rowing-haltere': 'haltères',
  'tirage-horizontal-prise-serree': 'poulie',
  'tirage-horizontal-assis': 'poulie',
  [PULLOVER_MACHINE]: 'machine',
  'pull-over-poulie': 'poulie',
  'pull-over-haltere': 'haltères',
  'curl-poulie-dos': 'poulie',
  'curl-halteres-assis': 'haltères',
  'curl-pupitre': 'machine',
  'curl-marteau-corde': 'poulie',
  'curl-marteau-croise': 'haltères',
  'curl-marteau': 'haltères',
  'curl-incline-halteres': 'haltères',
  [INCLINE_BARBELL]: 'barre',
  'developpe-incline-halteres': 'haltères',
  'developpe-incline-smith': 'Smith',
  'chest-press-inclinee': 'machine',
  [WIDE_CHEST_PRESS]: 'machine',
  'developpe-couche-barre': 'barre',
  'developpe-couche-halteres': 'haltères',
  'chest-press': 'machine',
  'ecarte-poulie-vis-a-vis': 'poulie',
  'pec-deck': 'machine',
  'ecarte-halteres': 'haltères',
  [LATERAL_MACHINE]: 'machine',
  'elevations-laterales-poulie': 'poulie',
  'elevations-laterales': 'haltères',
  'extension-triceps-au-dessus-de-la-tete': 'poulie',
  'extension-nuque-haltere': 'haltères',
  'barre-au-front': 'barre',
  'extension-triceps-poulie-haute-corde': 'poulie',
  'extension-triceps-poulie': 'poulie',
  kickback: 'haltères',
  'presse-a-cuisses': 'machine',
  'hack-squat': 'machine',
  'squat-smith': 'Smith',
  'fentes-bulgares': 'haltères',
  'hip-thrust': 'barre',
  'hip-thrust-smith': 'Smith',
  'glute-drive': 'machine',
  'leg-curl': 'machine',
  'leg-curl-allonge': 'machine',
  'souleve-de-terre-roumain': 'haltères',
  'leg-extension': 'machine',
  'presse-pieds-bas': 'machine',
  'curl-barre-ez': 'barre',
  'curl-halteres': 'haltères',
  'curl-poulie-barre': 'poulie',
  'curl-pupitre-ez': 'barre',
  'curl-concentre': 'haltères',
  'oiseau-reverse-pec-deck': 'machine',
  'oiseau-poulie': 'poulie',
  'face-pull': 'poulie',
  'oiseau-halteres': 'haltères',
  'crunch-poulie': 'poulie',
  'crunch-machine': 'machine',
  'releves-de-jambes-suspendu': 'poids du corps',
  'releves-genoux-chaise': 'poids du corps',
  'roue-abdominale': 'poids du corps',
  gainage: 'poids du corps',
}

export interface Alternative {
  id: string
  name: string
  equipment?: Equipment
  /** Dernière séance terminée avec cet exercice (ISO), null si jamais fait */
  lastDone: string | null
  /** Pas encore dans la liste d'exercices : créé si on le choisit */
  isNew: boolean
}

function lastDoneDates(sessions: Session[]): Map<string, string> {
  const dates = new Map<string, string>()
  for (const s of sessions) {
    if (s.status !== 'done') continue
    for (const id of s.exerciseIds) if ((dates.get(id) ?? '') < s.startedAt) dates.set(id, s.startedAt)
  }
  return dates
}

/**
 * Propositions pour remplacer `exerciseId` : la table (déjà faites d'abord, puis dans l'ordre prévu), ou pour un
 * exercice hors table, les exercices du même groupe musculaire déjà faits. Sans les masqués ni ceux de la séance.
 */
export function alternativesFor(
  exerciseId: string,
  exercisesById: Map<string, Exercise>,
  sessions: Session[],
  hidden: string[],
  inSession: string[],
): Alternative[] {
  const dates = lastDoneDates(sessions)
  const excluded = new Set([exerciseId, ...hidden, ...inSession])
  const listed = ALTERNATIVES[exerciseId]
  let ids: string[]
  if (listed) {
    ids = listed
  } else {
    const muscle = exercisesById.get(exerciseId)?.muscle
    ids = muscle
      ? [...exercisesById.values()].filter((e) => !e.hidden && e.muscle === muscle && dates.has(e.id)).map((e) => e.id)
      : []
  }
  const order = new Map(ids.map((id, i) => [id, i]))
  return ids
    .filter((id) => !excluded.has(id) && (exercisesById.has(id) || NEW[id]))
    .map((id) => ({
      id,
      name: exercisesById.get(id)?.name ?? NEW[id].name,
      equipment: EQUIPMENT[id],
      lastDone: dates.get(id) ?? null,
      isNew: !exercisesById.has(id),
    }))
    .sort((a, b) => {
      if (a.lastDone && b.lastDone) return b.lastDone.localeCompare(a.lastDone)
      if (a.lastDone) return -1
      if (b.lastDone) return 1
      return order.get(a.id)! - order.get(b.id)!
    })
}

/** Nom d'un remplacement masqué (pour « Réafficher »). */
export function alternativeName(id: string, exercisesById: Map<string, Exercise>): string {
  return exercisesById.get(id)?.name ?? NEW[id]?.name ?? id
}

/** L'exercice choisi existe dans la liste (créé si besoin, réaffiché s'il avait été supprimé). */
export async function ensureExercise(id: string): Promise<Exercise | undefined> {
  return db.transaction('rw', db.exercises, async () => {
    const existing = await db.exercises.get(id)
    if (existing) {
      if (existing.hidden) {
        const visible = { ...existing }
        delete visible.hidden
        await db.exercises.put(visible)
        return visible
      }
      return existing
    }
    const spec = NEW[id]
    if (!spec) return undefined
    const created: Exercise = { id, ...structuredClone(spec) }
    await db.exercises.add(created)
    return created
  })
}

/** Pour les tests : tous les remplacements prévus, avec leur fiche (existante ou à créer). */
export const NEW_ALTERNATIVES = NEW
