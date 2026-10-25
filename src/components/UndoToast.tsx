import { createPortal } from 'react-dom'
import { runUndo, useUndo } from '../lib/undo'

/** Bandeau « Série supprimée · Annuler » (environ 6 s). */
export function UndoToast({ aboveTabBar }: { aboveTabBar: boolean }) {
  const offer = useUndo()
  if (!offer) return null
  return createPortal(
    <div key={offer.id} className={aboveTabBar ? 'undo-toast above-tabbar' : 'undo-toast'} role="status" aria-live="polite">
      <span>{offer.label}</span>
      <button className="undo-button" onClick={() => void runUndo()}>
        Annuler
      </button>
    </div>,
    document.body,
  )
}
