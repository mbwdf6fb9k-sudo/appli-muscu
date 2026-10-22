import Dexie, { type EntityTable, type Transaction } from 'dexie'
import { DEFAULT_EXERCISES, DEFAULT_SUPPLEMENTS, DEFAULT_TEMPLATES } from './seed'

export interface SettingRow {
  key: string
  value: unknown
}

/** weight = charge × reps · bodyweight = poids du corps (kg = lest) · duration = secondes */
export type ExerciseType = 'weight' | 'bodyweight' | 'duration'

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  /** Pas de charge propre à l'exercice (sinon le réglage général). */
  step?: number
  /** Exercice supprimé mais déjà utilisé : gardé pour l'historique. */
  hidden?: boolean
}

export type SessionTemplateId = 'dos-biceps' | 'pecs-triceps' | 'jambes' | 'bras'
export type TemplateId = SessionTemplateId | 'abdos'

export interface Template {
  id: TemplateId
  name: string
  exerciseIds: string[]
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
}

export interface SessionExercise {
  exerciseId: string
  /** Type au moment de la séance (l'exercice peut changer de type ensuite). */
  type: ExerciseType
  sets: SetEntry[]
  note: string
  /** Ajouté via « + Abdos » : jamais recopié dans le modèle. */
  fromAbs?: boolean
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

/** Version actuelle du schéma (la plus haute déclarée ci-dessous). */
export const SCHEMA_VERSION = 4

export class MuscuDB extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>
  exercises!: EntityTable<Exercise, 'id'>
  templates!: EntityTable<Template, 'id'>
  days!: EntityTable<Day, 'date'>
  sessions!: EntityTable<Session, 'id'>
  weighIns!: EntityTable<WeighIn, 'date'>
  supplements!: EntityTable<Supplement, 'id'>
  intakes!: EntityTable<Intake, 'id'>

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

    // Base toute neuve : on la remplit directement avec les exercices et compléments par défaut
    this.on('populate', async (tx) => {
      await seedDefaults(tx)
      await seedSupplements(tx)
    })
  }
}

async function seedDefaults(tx: Transaction): Promise<void> {
  await tx.table('exercises').bulkPut(structuredClone(DEFAULT_EXERCISES))
  await tx.table('templates').bulkPut(structuredClone(DEFAULT_TEMPLATES))
}

async function seedSupplements(tx: Transaction): Promise<void> {
  await tx.table('supplements').bulkPut(structuredClone(DEFAULT_SUPPLEMENTS))
}

export const db = new MuscuDB()
