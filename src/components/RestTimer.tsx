import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '../db/database'
import { formatClock, formatRange, restState } from '../lib/rest'
import { useNow } from '../lib/useNow'
import { CloseIcon } from './icons'

// Bip : l'iPhone n'autorise le son qu'après un premier toucher dans la page
let audio: AudioContext | null = null
function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

function beep() {
  if (!audio || audio.state !== 'running') return
  const start = audio.currentTime
  for (const [offset, frequency] of [
    [0, 880],
    [0.18, 1175],
  ]) {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start + offset)
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.15)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + 0.16)
  }
}

/**
 * Chronomètre de repos : part de l'heure de la dernière série validée (rien n'est enregistré en plus),
 * jauge jusqu'au repos minimum conseillé, puis « C'est reparti » (et un bip si l'appli est ouverte).
 */
export function RestTimer(props: { session: Session; exerciseName: (id: string) => string; beepEnabled: boolean }) {
  const now = useNow(1000)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const beeped = useRef<string | null>(null)
  const state = restState(props.session, now)

  useEffect(() => {
    document.addEventListener('pointerdown', unlockAudio)
    return () => document.removeEventListener('pointerdown', unlockAudio)
  }, [])

  const ready = state?.phase === 'ready'
  useEffect(() => {
    if (!state || !ready || !props.beepEnabled || beeped.current === state.lastAt) return
    // Seulement si le minimum vient d'être atteint (pas en rouvrant l'appli longtemps après)
    if (state.range && state.elapsed - state.range.min <= 5) beep()
    beeped.current = state.lastAt
  }, [state, ready, props.beepEnabled])

  if (!state || dismissed === state.lastAt) return null
  const entry = props.session.exercises[state.exerciseIndex]
  const name = props.exerciseName(entry.exerciseId)
  const progress = state.range ? Math.min(1, state.elapsed / Math.max(1, state.range.min)) : 0

  let title: string
  let detail: string
  if (state.phase === 'chain') {
    title = `Enchaîne avec ${props.exerciseName(state.nextExerciseId!)}`
    detail = `sans pause · ${formatClock(state.elapsed)}`
  } else if (state.phase === 'ready') {
    title = `C’est reparti · ${formatClock(state.elapsed)}`
    detail = `repos conseillé ${formatRange(state.range!)} · ${name}`
  } else if (state.phase === 'over') {
    title = `Repos de ${formatClock(state.elapsed)}`
    detail = `conseillé ${formatRange(state.range!)} · ${name}`
  } else {
    title = `Repos ${formatClock(state.elapsed)}`
    detail = state.range ? `conseillé ${formatRange(state.range)} · ${name}` : name
  }

  return createPortal(
    <div className={`rest-timer rest-${state.phase}`} role="timer" aria-live="off" aria-label={`${title}, ${detail}`}>
      {state.phase === 'resting' && <span className="rest-progress" style={{ width: `${progress * 100}%` }} aria-hidden="true" />}
      <span className="rest-text">
        <span className="rest-title">{title}</span>
        <span className="rest-detail">{detail}</span>
      </span>
      <button className="icon-btn icon-btn-small rest-close" onClick={() => setDismissed(state.lastAt)} aria-label="Masquer le chronomètre">
        <CloseIcon />
      </button>
    </div>,
    document.body,
  )
}
