import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatRecord, RECORD_LABELS, type BrokenRecord } from '../lib/records'
import { TrophyIcon } from './icons'

export interface RecordCelebration {
  /** Change à chaque record, pour relancer l'animation */
  id: number
  exerciseName: string
  records: BrokenRecord[]
}

const DURATION_MS = 3000

/** Bandeau « Nouveau record » qui glisse depuis le haut, puis disparaît tout seul. */
export function RecordToast({ celebration, onClose }: { celebration: RecordCelebration | null; onClose: () => void }) {
  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(onClose, DURATION_MS)
    return () => clearTimeout(timer)
  }, [celebration, onClose])

  if (!celebration) return null

  return createPortal(
    <button key={celebration.id} className="record-toast" onClick={onClose} role="status" aria-live="polite">
      <span className="record-toast-icon">
        <TrophyIcon />
      </span>
      <span className="record-toast-text">
        <span className="record-toast-title">Nouveau record · {celebration.exerciseName}</span>
        {celebration.records.map((r) => (
          <span key={r.kind} className="record-toast-line">
            {RECORD_LABELS[r.kind]} : <strong>{formatRecord(r).value}</strong> (avant {formatRecord(r).previous})
          </span>
        ))}
      </span>
    </button>,
    document.body,
  )
}
