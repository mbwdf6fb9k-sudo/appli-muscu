import { useEffect, useRef, useState } from 'react'

/** Largeur disponible d'un conteneur, mise à jour quand elle change. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Graduations « rondes » entre min et max (ex. 60, 70, 80, 90). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  // Valeurs (presque) identiques : écart minimal de 3 % (au moins 1), sinon un seul point à 74 kg
  // donnerait une échelle de 65 à 85
  const minSpan = Math.max(1, Math.abs(max) * 0.03)
  if (max - min < minSpan) {
    const pad = (minSpan - (max - min)) / 2
    min -= pad
    max += pad
  }
  const rough = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  if (ticks.at(-1)! < max) ticks.push(Math.round((ticks.at(-1)! + step) * 100) / 100)
  return ticks
}
