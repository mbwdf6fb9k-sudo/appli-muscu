import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks, useWidth } from './chartUtils'

export interface Point {
  date: Date
  value: number
  /** Valeur d'une seconde série, dessinée en points de fond (ex. la pesée brute sous la moyenne) */
  secondary?: number
}

export interface Reference {
  value: number
  label: string
}

interface LineChartProps {
  points: Point[]
  format: (value: number) => string
  formatDate: (date: Date) => string
  /** Index du point à mettre en avant (le record) */
  highlight?: number
  /** Un point sur chaque valeur (sinon seulement le dernier, pour les séries denses) */
  markers?: boolean
  /** Noms des séries : affiche une légende et les deux valeurs dans l'info-bulle */
  valueLabel?: string
  secondaryLabel?: string
  /** Traits horizontaux de repère (départ, objectif…) */
  references?: Reference[]
}

const HEIGHT = 190
const PAD = { top: 16, right: 14, bottom: 24, left: 40 }

/** Courbe dans le temps, avec repère vertical au toucher. */
export function LineChart(props: LineChartProps) {
  const { points, format, formatDate, highlight, markers = true, valueLabel, secondaryLabel, references = [] } = props
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const values = [
    ...points.map((p) => p.value),
    ...points.flatMap((p) => (p.secondary === undefined ? [] : [p.secondary])),
    ...references.map((r) => r.value),
  ]
  const ticks = niceTicks(Math.min(...values), Math.max(...values))
  const yMin = ticks[0]
  const yMax = ticks.at(-1)!
  const times = points.map((p) => p.date.getTime())
  const tMin = Math.min(...times)
  const tMax = Math.max(...times)

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + (tMax === tMin ? plotW / 2 : ((t - tMin) / (tMax - tMin)) * plotW)
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH
  const coords = points.map((p) => ({ x: x(p.date.getTime()), y: y(p.value) }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  const area = coords.length > 1 ? `${line} L${coords.at(-1)!.x},${PAD.top + plotH} L${coords[0].x},${PAD.top + plotH} Z` : ''

  // Le repère se cale sur le point le plus proche du doigt, en X
  const nearest = (clientX: number, target: Element) => {
    const left = target.getBoundingClientRect().left
    let best = 0
    coords.forEach((c, i) => {
      if (Math.abs(c.x - (clientX - left)) < Math.abs(coords[best].x - (clientX - left))) best = i
    })
    setActive(best)
  }
  const onPointer = (e: PointerEvent<SVGRectElement>) => nearest(e.clientX, e.currentTarget.ownerSVGElement!)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1))
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? points.length) - 1))
  }

  const last = coords.length - 1
  const showDot = (i: number) => markers || i === last || i === highlight || i === active

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setActive(null)}>
      {secondaryLabel && (
        <div className="chart-legend" aria-hidden="true">
          <span>
            <span className="legend-line" /> {valueLabel}
          </span>
          <span>
            <span className="legend-dot" /> {secondaryLabel}
          </span>
        </div>
      )}
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={points.map((p) => `${formatDate(p.date)} : ${format(p.value)}`).join(', ')}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
              <text className="chart-tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
                {format(t).replace(/\s?(kg|reps)$/, '')}
              </text>
            </g>
          ))}
          {references.map((r) => (
            <line key={r.label} className="chart-ref" x1={PAD.left} x2={width - PAD.right} y1={Math.round(y(r.value)) + 0.5} y2={Math.round(y(r.value)) + 0.5} />
          ))}
          {points.length > 1 && (
            <>
              <text className="chart-tick" x={coords[0].x} y={HEIGHT - 6} textAnchor="start">
                {formatDate(points[0].date)}
              </text>
              <text className="chart-tick" x={coords[last].x} y={HEIGHT - 6} textAnchor="end">
                {formatDate(points[last].date)}
              </text>
            </>
          )}
          {area && <path className="chart-area" d={area} />}
          {points.map((p, i) =>
            p.secondary === undefined ? null : (
              <circle key={`s${i}`} className="chart-dot-secondary" cx={coords[i].x} cy={y(p.secondary)} r={3.5} />
            ),
          )}
          {/* pathLength 1 : permet d'animer le tracé de la courbe à l'ouverture */}
          {coords.length > 1 && <path className="chart-line" d={line} pathLength={1} />}
          {active !== null && (
            <line className="chart-crosshair" x1={coords[active].x} x2={coords[active].x} y1={PAD.top} y2={PAD.top + plotH} />
          )}
          {coords.map((c, i) =>
            showDot(i) ? (
              <circle
                key={i}
                className={i === highlight ? 'chart-dot record' : 'chart-dot'}
                cx={c.x}
                cy={c.y}
                r={i === highlight || i === active ? 6 : 4}
              />
            ) : null,
          )}
          {/* Libellés des repères par-dessus les données, détourés pour rester lisibles */}
          {references.map((r) => (
            <text key={r.label} className="chart-ref-label" x={width - PAD.right} y={y(r.value) - 5} textAnchor="end">
              {r.label}
            </text>
          ))}
          {/* Zone tactile : toute la surface du graphique */}
          <rect
            className="chart-hit"
            x={0}
            y={0}
            width={width}
            height={HEIGHT}
            tabIndex={0}
            aria-label="Parcourir les points avec les flèches"
            onPointerDown={onPointer}
            onPointerMove={onPointer}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
          />
        </svg>
      )}
      {active !== null && width > 0 && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(coords[active].x, 72), width - 72),
            top: Math.max(secondaryLabel ? 28 : 0, coords[active].y - (secondaryLabel ? 80 : 62)),
          }}
        >
          <strong>{format(points[active].value)}</strong>
          {valueLabel && <span>{valueLabel}</span>}
          {points[active].secondary !== undefined && (
            <span>
              {secondaryLabel} : {format(points[active].secondary!)}
            </span>
          )}
          <span>{formatDate(points[active].date)}</span>
        </div>
      )}
    </div>
  )
}
