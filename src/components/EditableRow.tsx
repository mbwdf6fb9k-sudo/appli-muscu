import { ArrowDownIcon, ArrowUpIcon, CloseIcon } from './icons'

interface EditableRowProps {
  label: string
  detail?: string
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

/** Ligne d'une liste modifiable : monter, descendre, retirer. */
export function EditableRow({ label, detail, isFirst, isLast, onMove, onRemove }: EditableRowProps) {
  return (
    <div className="editable-row">
      <span className="editable-text">
        <span className="editable-label">{label}</span>
        {detail && <span className="muted small">{detail}</span>}
      </span>
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
