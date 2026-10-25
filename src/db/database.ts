import Dexie, { type EntityTable, type Transaction } from 'dexie'
import { applyExerciseDefaults, applyMuscleDefaults, applyProgram } from './program'
import { DEFAULT_EXERCISES, DEFAULT_SUPPLEMENTS, DEFAULT_TEMPLATES } from './seed'
import { applyStep11 } from './step11'

export interface SettingRow {
  key: string
  value: unknown
}

/** weight = charge × reps · bodyweight = poids du corps (kg = lest) · duration = secondes */
export type ExerciseType = 'weight' | 'bodyweight' | 'duration'

export interface ExerciseTips {
  technique?: string
  errors?: string
  replacement?: string
}

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  /** Pas de charge propre à l'exercice (sinon le réglage général). */
  step?: number
  /** Exercice supprimé mais déjà utilisé : gardé pour l'historique. */
  hidden?: boolean
  /** Consignes du programme */
  tips?: ExerciseTips
  /** Polyarticulaire : série d'échauffement proposée aussi en 2e exercice */
  compound?: boolean
  /** Muscle principal : compte des séries par muscle */
  muscle?: MuscleGroup
}

export type MuscleGroup =
  | 'dos'
  | 'pecs'
  | 'epaules'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'ischios'
  | 'fessiers'
  | 'mollets'
  | 'abdos'

/** Objectif d'un exercice dans un modèle : séries × fourchette (reps, ou secondes pour la durée). */
export interface Target {
  sets: number
  min: number
  max: number
  /** « 1-2 » : reps gardées en réserve */
  rir?: string
  /** « 2-3 min » : affiché seulement, pas de minuteur */
  rest?: string
  /** Lettre du superset : les exercices de même lettre s'enchaînent sans pause */
  superset?: string
}

export type SessionTemplateId = 'dos-biceps' | 'pecs-triceps' | 'jambes' | 'bras'
export type TemplateId = SessionTemplateId | 'abdos'

export interface Template {
  id: TemplateId
  name: string
  exerciseIds: string[]
  /** Objectif par exercice (clé : id de l'exercice) */
  targets?: Record<string, Target>
  /** « ≈ 65 min » */
  duration?: string
  /** Conseil de placement dans la semaine */
  placement?: string
  /** Conseil affiché pendant la séance */
  advice?: string
}

export type DayChoice = SessionTemplateId | 'repos'

export interface Day {
  /** AAAA-MM-JJ (heure locale) */
  date: string
  choice: DayChoice
  /** « J'y vais vers… » au format HH:MM */
  plannedTime?: string
}

export interface SetEntry {
  reps?: number
  /** Charge, ou lest pour le poids du corps */
  kg?: number
  seconds?: number
  at: string
  /** Série d'échauffement : hors objectif du jour, records, volume et stagnation */
  warmup?: boolean
  /** Suite dégressive de la série d'avant : même série, compte seulement dans le volume */
  drop?: boolean
}

export interface SessionExercise {
  exerciseId: string
  /** Type au moment de la séance (l'exercice peut changer de type ensuite). */
  type: ExerciseType
  sets: SetEntry[]
  note: string
  /** Ajouté via « + Abdos » : jamais recopié dans le modèle. */
  fromAbs?: boolean
  /** Objectif au moment de la séance (recopié du modèle) */
  target?: Target
}

export interface Session {
  id: string
  templateId: SessionTemplateId
  date: string
  startedAt: string
  endedAt: string | null
  status: 'active' | 'done'
  exercises: SessionExercise[]
  /** Exercices ayant au moins une série (index pour retrouver « la dernière fois »). */
  exerciseIds: string[]
  /** Séance de semaine allégée : hors objectif du jour et stagnation */
  deload?: boolean
}

export interface WeighIn {
  /** AAAA-MM-JJ (heure locale) : une seule pesée par jour */
  date: string
  kg: number
}

export type SupplementMoment = 'breakfast' | 'lunch' | 'pre45' | 'pre20' | 'during' | 'after' | 'dinner' | 'bedtime'

export interface Supplement {
  id: string
  name: string
  /** « 3 à 5 g » */
  dose?: string
  /** Rappel affiché sous le complément */
  note?: string
  /** Moment de prise en jour d'entraînement (null = pas ce jour-là) */
  training: SupplementMoment | null
  /** Moment de prise en jour de repos (null = pas ce jour-là) */
  rest: SupplementMoment | null
  /** Avertissement si la séance est tard le soir */
  caffeine?: boolean
  order: number
}

export interface Intake {
  /** « AAAA-MM-JJ|idDuComplément » : une case par complément et par jour */
  id: string
  date: string
  supplementId: string
  at: string
}

export type ActivityType = 'foot' | 'tennis'

/** Foot ou tennis un jour donné (ne compte pas comme séance de muscu). */
export interface Activity {
  /** « AAAA-MM-JJ|foot » : une ligne par jour et par sport */
  id: string
  date: string
  type: ActivityType
}

export type MeasureKey = 'bras' | 'poitrine' | 'epaules' | 'taille' | 'cuisse'

/** Mensurations d'un jour (cm), chacune facultative. */
export interface Measurement extends Partial<Record<MeasureKey, number>> {
  /** AAAA-MM-JJ (heure locale) : une seule mesure par jour */
  date: string
}

export type PhotoPose = 'face' | 'profil' | 'dos'

/** Photo d'évolution, gardée uniquement sur le téléphone. */
export interface Photo {
  id: string
  /** AAAA-MM-JJ */
  date: string
  pose: PhotoPose
  /** Image JPEG réduite, en « data:image/jpeg;base64,… » (incluse telle quelle dans l'export) */
  dataUrl: string
  width: number
  height: number
}

/** Version actuelle du schéma (la plus haute déclarée ci-dessous). */
export const SCHEMA_VERSION = 8

export class MuscuDB extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>
  exercises!: EntityTable<Exercise, 'id'>
  templates!: EntityTable<Template, 'id'>
  days!: EntityTable<Day, 'date'>
  sessions!: EntityTable<Session, 'id'>
  weighIns!: EntityTable<WeighIn, 'date'>
  supplements!: EntityTable<Supplement, 'id'>
  intakes!: EntityTable<Intake, 'id'>
  activities!: EntityTable<Activity, 'id'>
  measurements!: EntityTable<Measurement, 'date'>
  photos!: EntityTable<Photo, 'id'>

  constructor(name = 'appli-muscu') {
    super(name)

    // Historique du schéma. Ne JAMAIS modifier une version déjà publiée :
    // pour faire évoluer les données, ajouter this.version(n + 1) avec un .upgrade()
    // si besoin, augmenter SCHEMA_VERSION et ajouter l'étape dans BACKUP_MIGRATIONS (backup.ts).
    this.version(1).stores({
      settings: 'key',
    })

    // Étape 2 : exercices, modèles, journées et séances
    this.version(2)
      .stores({
        exercises: 'id, name',
        templates: 'id',
        days: 'date',
        sessions: 'id, status, date, templateId, startedAt, *exerciseIds',
      })
      .upgrade(seedDefaults)

    // Étape 4 : pesées (une par jour)
    this.version(3).stores({
      weighIns: 'date',
    })

    // Étape 5 : compléments et prises cochées
    this.version(4)
      .stores({
        supplements: 'id, order',
        intakes: 'id, date, supplementId',
      })
      .upgrade(seedSupplements)

    // Étape 7 : programme personnel (objectifs, consignes, nouveaux modèles) — pas de nouvel index
    this.version(5).stores({}).upgrade(applyProgramToDb)

    // Étape 8 : foot/tennis, paliers haltères (2 kg) et exercices polyarticulaires
    this.version(6)
      .stores({
        activities: 'id, date',
      })
      .upgrade(applyExerciseDefaultsToDb)

    // Étape 9 : mensurations, photos d'évolution et muscle principal des exercices
    this.version(7)
      .stores({
        measurements: 'date',
        photos: 'id, date',
      })
      .upgrade(applyMuscleDefaultsToDb)

    // Étape 11 : groupe « fessiers », exercices renommés et classés, nouveaux modèles, séance du 24/10 corrigée
    this.version(8).stores({}).upgrade(applyStep11ToDb)

    // Base toute neuve : exercices, compléments et programme par défaut
    this.on('populate', async (tx) => {
      await seedDefaults(tx)
      await seedSupplements(tx)
      await applyProgramToDb(tx)
      await applyExerciseDefaultsToDb(tx)
      await applyMuscleDefaultsToDb(tx)
      await applyStep11ToDb(tx)
    })
  }
}

async function seedDefaults(tx: Transaction): Promise<void> {
  await tx.table('exercises').bulkPut(structuredClone(DEFAULT_EXERCISES))
  await tx.table('templates').bulkPut(structuredClone(DEFAULT_TEMPLATES))
}

async function applyProgramToDb(tx: Transaction): Promise<void> {
  const { exercises, templates } = applyProgram(await tx.table('exercises').toArray(), await tx.table('templates').toArray())
  await tx.table('exercises').bulkPut(exercises)
  await tx.table('templates').bulkPut(templates)
}

async function applyExerciseDefaultsToDb(tx: Transaction): Promise<void> {
  await tx.table('exercises').bulkPut(applyExerciseDefaults(await tx.table('exercises').toArray()))
}

async function applyMuscleDefaultsToDb(tx: Transaction): Promise<void> {
  await tx.table('exercises').bulkPut(applyMuscleDefaults(await tx.table('exercises').toArray()))
}

async function applyStep11ToDb(tx: Transaction): Promise<void> {
  const result = applyStep11({
    exercises: await tx.table('exercises').toArray(),
    templates: await tx.table('templates').toArray(),
    sessions: await tx.table('sessions').toArray(),
  })
  await tx.table('exercises').bulkPut(result.exercises)
  await tx.table('templates').bulkPut(result.templates)
  await tx.table('sessions').bulkPut(result.sessions)
}

async function seedSupplements(tx: Transaction): Promise<void> {
  await tx.table('supplements').bulkPut(structuredClone(DEFAULT_SUPPLEMENTS))
}

export const db = new MuscuDB()
