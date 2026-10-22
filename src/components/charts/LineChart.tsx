import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks, useWidth } from './chartUtils'

export interface Point {
  date: Date
  value: number
}

interface LineChartProps {
  points: Point[]
  format: (value: number) => string
  formatDate: (date: Date) => string
  /** Index du point à mettre en avant (le record) */
  highlight?: number
}

const HEIGHT = 190
const PAD = { top: 16, right: 14, bottom: 24, left: 40 }

/** Courbe d'une seule série dans le temps, avec repère vertical au toucher. */
export function LineChart({ points, format, formatDate, highlight }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const values = points.map((p) => p.value)
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
  const shown = active ?? null

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setActive(null)}>
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
          {coords.length > 1 && <path className="chart-line" d={line} />}
          {shown !== null && (
            <line className="chart-crosshair" x1={coords[shown].x} x2={coords[shown].x} y1={PAD.top} y2={PAD.top + plotH} />
          )}
          {coords.map((c, i) => (
            <circle
              key={i}
              className={i === highlight ? 'chart-dot record' : 'chart-dot'}
              cx={c.x}
              cy={c.y}
              r={i === highlight || i === shown ? 6 : 4}
            />
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
      {shown !== null && width > 0 && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(coords[shown].x, 64), width - 64), top: Math.max(0, coords[shown].y - 62) }}
        >
          <strong>{format(points[shown].value)}</strong>
          <span>{formatDate(points[shown].date)}</span>
        </div>
      )}
    </div>
  )
}
