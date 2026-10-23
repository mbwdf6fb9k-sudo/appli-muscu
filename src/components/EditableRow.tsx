import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from './icons'

interface EditableRowProps {
  label: string
  detail?: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  /** Toucher le libellé ouvre un panneau (ex. objectifs de l'exercice) */
  onOpen?: () => void
}

/** Ligne d'une liste modifiable : monter, descendre, retirer. */
export function EditableRow({ label, detail, isFirst, isLast, onMove, onRemove, onOpen }: EditableRowProps) {
  const text = (
    <>
      <span className="editable-label">{label}</span>
      {detail && <span className="muted small">{detail}</span>}
    </>
  )
  return (
    <div className="editable-row">
      {onOpen ? (
        <button className="editable-text editable-open" onClick={onOpen}>
          {text}
        </button>
      ) : (
        <span className="editable-text">{text}</span>
      )}
      <button className="icon-btn" aria-label={`Monter ${label}`} disabled={isFirst} onClick={() => onMove(-1)}>
        <ArrowUpIcon />
      </button>
      <button className="icon-btn" aria-label={`Descendre ${label}`} disabled={isLast} onClick={() => onMove(1)}>
        <ArrowDownIcon />
      </button>
      <button className="icon-btn icon-btn-danger" aria-label={`Retirer ${label}`} onClick={onRemove}>
        <CloseIcon />
      </button>
    </div>
  )
}
