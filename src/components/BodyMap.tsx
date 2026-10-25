import type { ReactElement } from 'react'
import type { MuscleGroup } from '../db/database'
import { formatNumber } from '../lib/format'
import { MUSCLE_LABELS } from '../lib/muscleVolume'

/** Niveaux de couleur : 0 série (gris), puis 1-4, 5-9, 10-14, 15 et plus (repère 10-20 par semaine). */
export const LEVELS = [
  { min: 0, label: '0' },
  { min: 0.5, label: '1-4' },
  { min: 5, label: '5-9' },
  { min: 10, label: '10-14' },
  { min: 15, label: '15+' },
]

export function levelOf(sets: number): number {
  let level = 0
  LEVELS.forEach((l, i) => {
    if (sets >= l.min) level = i
  })
  return level
}

type Zone = { muscle: MuscleGroup; shapes: ReactElement[] }

const pair = (make: (x: number, mirror: boolean) => ReactElement) => [make(0, false), make(120, true)]

/** Zones de face (coordonnées d'une silhouette de 120 × 300). */
const FRONT: Zone[] = [
  {
    muscle: 'epaules',
    shapes: [<circle key="l" cx="25" cy="58" r="10" />, <circle key="r" cx="95" cy="58" r="10" />],
  },
  {
    muscle: 'pecs',
    shapes: [
      <path key="l" d="M36 54 Q48 50 59 54 L59 80 Q47 86 36 78 Z" />,
      <path key="r" d="M84 54 Q72 50 61 54 L61 80 Q73 86 84 78 Z" />,
    ],
  },
  {
    muscle: 'biceps',
    shapes: [<rect key="l" x="13" y="70" width="13" height="38" rx="6" />, <rect key="r" x="94" y="70" width="13" height="38" rx="6" />],
  },
  { muscle: 'abdos', shapes: [<rect key="a" x="45" y="88" width="30" height="58" rx="7" />] },
  {
    muscle: 'quadriceps',
    shapes: [<rect key="l" x="35" y="178" width="22" height="64" rx="10" />, <rect key="r" x="63" y="178" width="22" height="64" rx="10" />],
  },
]

/** Zones de dos. */
const BACK: Zone[] = [
  {
    muscle: 'epaules',
    shapes: [<circle key="l" cx="25" cy="58" r="10" />, <circle key="r" cx="95" cy="58" r="10" />],
  },
  { muscle: 'dos', shapes: [<path key="d" d="M36 52 L84 52 L82 92 L72 132 L60 138 L48 132 L38 92 Z" />] },
  {
    muscle: 'triceps',
    shapes: [<rect key="l" x="13" y="70" width="13" height="38" rx="6" />, <rect key="r" x="94" y="70" width="13" height="38" rx="6" />],
  },
  {
    muscle: 'fessiers',
    shapes: [<ellipse key="l" cx="47" cy="166" rx="13" ry="12" />, <ellipse key="r" cx="73" cy="166" rx="13" ry="12" />],
  },
  {
    muscle: 'ischios',
    shapes: [<rect key="l" x="35" y="184" width="22" height="56" rx="10" />, <rect key="r" x="63" y="184" width="22" height="56" rx="10" />],
  },
  {
    muscle: 'mollets',
    shapes: [<rect key="l" x="37" y="252" width="18" height="34" rx="8" />, <rect key="r" x="65" y="252" width="18" height="34" rx="8" />],
  },
]

/** La silhouette neutre (tête, tronc, bras, jambes). */
function Silhouette() {
  return (
    <g className="body-base">
      <circle cx="60" cy="22" r="14" />
      <rect x="54" y="34" width="12" height="12" rx="3" />
      <path d="M30 48 L90 48 L98 62 L88 152 L32 152 L22 62 Z" />
      <path d="M32 150 L88 150 L91 176 L29 176 Z" />
      {pair((dx, mirror) => (
        <g key={dx} transform={mirror ? 'translate(120 0) scale(-1 1)' : undefined}>
          <rect x="12" y="60" width="15" height="58" rx="7" />
          <rect x="10" y="116" width="13" height="52" rx="6" />
          <rect x="33" y="172" width="25" height="76" rx="11" />
          <rect x="35" y="246" width="21" height="44" rx="9" />
        </g>
      ))}
    </g>
  )
}

function Figure(props: {
  title: string
  zones: Zone[]
  values: Map<MuscleGroup, number>
  onPick: (muscle: MuscleGroup) => void
}) {
  return (
    <figure className="body-figure">
      <svg viewBox="0 0 120 300" role="group" aria-label={props.title}>
        <Silhouette />
        {props.zones.map((zone) => {
          const sets = props.values.get(zone.muscle) ?? 0
          return (
            <g
              key={zone.muscle}
              className={`body-zone level-${levelOf(sets)}`}
              role="button"
              tabIndex={0}
              aria-label={`${MUSCLE_LABELS[zone.muscle]} : ${formatNumber(sets)} série${sets > 1 ? 's' : ''}`}
              onClick={() => props.onPick(zone.muscle)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && props.onPick(zone.muscle)}
            >
              {zone.shapes}
            </g>
          )
        })}
      </svg>
      <figcaption>{props.title}</figcaption>
    </figure>
  )
}

/** Carte des muscles : face et dos, chaque zone colorée selon les séries de travail directes. */
export function BodyMap(props: { values: Map<MuscleGroup, number>; onPick: (muscle: MuscleGroup) => void }) {
  return (
    <div className="body-map">
      <div className="body-figures">
        <Figure title="Face" zones={FRONT} values={props.values} onPick={props.onPick} />
        <Figure title="Dos" zones={BACK} values={props.values} onPick={props.onPick} />
      </div>
      <div className="body-legend" aria-hidden="true">
        <span className="muted small">Séries</span>
        {LEVELS.map((level, i) => (
          <span key={level.label} className="body-legend-item">
            <span className={`body-swatch level-${i}`} />
            {level.label}
          </span>
        ))}
      </div>
    </div>
  )
}
