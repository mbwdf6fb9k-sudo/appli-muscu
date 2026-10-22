import { useState } from 'react'
import { useWidth } from './chartUtils'

export interface Bar {
  label: string
  /** Libellé détaillé pour l'info-bulle et les lecteurs d'écran */
  detail: string
  value: number
}

const HEIGHT = 120
const TOP = 18 // place pour la valeur au-dessus de la barre en cours
const BOTTOM = 22 // libellés des semaines
const MAX_BAR = 24
const RADIUS = 4

/** Colonnes simples ; la dernière (période en cours) est mise en avant et étiquetée. */
export function BarChart({ bars, unit }: { bars: Bar[]; unit: (n: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const max = Math.max(1, ...bars.map((b) => b.value))
  const plotHeight = HEIGHT - TOP - BOTTOM
  const band = width / Math.max(1, bars.length)
  const barWidth = Math.min(MAX_BAR, band - 2)
  const last = bars.length - 1
  // Quelques libellés seulement : première, milieu, dernière
  const labelled = new Set([0, Math.floor(last / 2), last])

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={bars.map((b) => `${b.detail} : ${unit(b.value)}`).join(', ')}>
          <line className="chart-axis" x1={0} x2={width} y1={TOP + plotHeight + 0.5} y2={TOP + plotHeight + 0.5} />
          {bars.map((bar, i) => {
            const h = bar.value === 0 ? 0 : Math.max(3, (bar.value / max) * plotHeight)
            const x = i * band + (band - barWidth) / 2
            const y = TOP + plotHeight - h
            const r = Math.min(RADIUS, h, barWidth / 2)
            return (
              <g key={i}>
                {h > 0 && (
                  <path
                    className={i === last ? 'chart-bar current' : active === i ? 'chart-bar active' : 'chart-bar'}
                    // Coins arrondis en haut seulement, base carrée sur l'axe
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V${y + h} Z`}
                  />
                )}
                {i === last && (
                  <text className="chart-value" x={x + barWidth / 2} y={y - 6} textAnchor="middle">
                    {bar.value}
                  </text>
                )}
                {labelled.has(i) && (
                  <text
                    className="chart-tick"
                    x={i === 0 ? x : i === last ? x + barWidth : x + barWidth / 2}
                    y={HEIGHT - 6}
                    textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
                  >
                    {bar.label}
                  </text>
                )}
                {/* Zone tactile : toute la largeur de la colonne, plus grande que la barre */}
                <rect
                  className="chart-hit"
                  x={i * band}
                  y={0}
                  width={band}
                  height={TOP + plotHeight}
                  tabIndex={0}
                  aria-label={`${bar.detail} : ${unit(bar.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {active !== null && width > 0 && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(active * band + band / 2, 60), width - 60), top: 0 }}
        >
          <strong>{unit(bars[active].value)}</strong>
          <span>{bars[active].detail}</span>
        </div>
      )}
    </div>
  )
}
