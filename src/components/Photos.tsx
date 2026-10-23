import { useRef, useState } from 'react'
import type { Photo, PhotoPose } from '../db/database'
import { addPhoto, deletePhoto } from '../db/photos'
import { dataUrlBytes, formatBytes, resizePhoto } from '../lib/image'
import { CameraIcon, CompareIcon } from './icons'
import { Sheet } from './Sheet'

export const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'face', label: 'Face' },
  { value: 'profil', label: 'Profil' },
  { value: 'dos', label: 'Dos' },
]
const POSE_LABELS = Object.fromEntries(POSES.map((p) => [p.value, p.label])) as Record<PhotoPose, string>

const toDate = (date: string) => new Date(`${date}T12:00:00`)
const dayLabel = (date: string) => toDate(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const monthTitle = (date: string) => toDate(date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

type Draft = { dataUrl: string; width: number; height: number }

/** Photos d'évolution : ajout, vignettes par mois, agrandissement et comparaison (Mon année). */
export function Photos({ photos, today }: { photos: Photo[]; today: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [viewing, setViewing] = useState<Photo | null>(null)
  const [comparing, setComparing] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(false)
    try {
      setDraft(await resizePhoto(file))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const months = new Map<string, Photo[]>()
  for (const photo of [...photos].reverse()) {
    const key = photo.date.slice(0, 7)
    months.set(key, [...(months.get(key) ?? []), photo])
  }
  const bytes = photos.reduce((sum, p) => sum + dataUrlBytes(p.dataUrl), 0)
  const canCompare = POSES.some((pose) => photos.filter((p) => p.pose === pose.value).length >= 2)

  return (
    <>
      <h2 className="section-title">Photos d’évolution</h2>
      <div className="card photos-card">
        {photos.length === 0 && (
          <p className="muted">
            Une photo par mois, de face, de profil et de dos, avec la même lumière au même endroit. Elles restent
            uniquement sur ton téléphone.
          </p>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="photos-actions">
          <button className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>
            <CameraIcon /> {busy ? 'Préparation…' : 'Ajouter une photo'}
          </button>
          {canCompare && (
            <button className="btn btn-secondary" onClick={() => setComparing(true)}>
              <CompareIcon /> Comparer
            </button>
          )}
        </div>
        {error && <p className="feedback feedback-error">Cette image n’a pas pu être lue. Essaie une autre photo.</p>}

        {[...months.entries()].map(([month, list]) => (
          <section key={month} className="photo-month">
            <h3 className="photo-month-title">{monthTitle(`${month}-01`)}</h3>
            <div className="photo-grid">
              {list.map((photo) => (
                <button
                  key={photo.id}
                  className="photo-thumb"
                  onClick={() => setViewing(photo)}
                  aria-label={`Photo ${POSE_LABELS[photo.pose]} du ${dayLabel(photo.date)}`}
                >
                  <img src={photo.dataUrl} alt="" loading="lazy" />
                  <span className="photo-pose">{POSE_LABELS[photo.pose]}</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {photos.length > 0 && (
          <p className="muted small photos-size">
            {photos.length} photo{photos.length > 1 ? 's' : ''} · {formatBytes(bytes)} · incluses dans la sauvegarde
          </p>
        )}
      </div>

      {draft && <AddPhotoSheet draft={draft} today={today} onClose={() => setDraft(null)} />}
      {viewing && <PhotoSheet photo={viewing} onClose={() => setViewing(null)} />}
      {comparing && <CompareSheet photos={photos} onClose={() => setComparing(false)} />}
    </>
  )
}

function PoseSwitch({ value, onChange, disabled }: { value: PhotoPose; onChange: (p: PhotoPose) => void; disabled?: (p: PhotoPose) => boolean }) {
  return (
    <div className="segmented segmented-3" role="group" aria-label="Pose">
      {POSES.map((p) => (
        <button key={p.value} aria-pressed={value === p.value} disabled={disabled?.(p.value)} onClick={() => onChange(p.value)}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function AddPhotoSheet({ draft, today, onClose }: { draft: Draft; today: string; onClose: () => void }) {
  const [pose, setPose] = useState<PhotoPose>('face')
  const [date, setDate] = useState(today)
  return (
    <Sheet open onClose={onClose} title="Nouvelle photo">
      <img className="photo-preview" src={draft.dataUrl} alt="Aperçu de la photo" />
      <PoseSwitch value={pose} onChange={setPose} />
      <label className="field photo-date">
        <span className="field-label">Date</span>
        <input className="text-input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="sheet-actions">
        <button
          className="btn btn-primary"
          disabled={!date}
          onClick={async () => {
            await addPhoto({ ...draft, date, pose })
            onClose()
          }}
        >
          Enregistrer la photo
        </button>
      </div>
    </Sheet>
  )
}

function PhotoSheet({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={`${POSE_LABELS[photo.pose]} · ${dayLabel(photo.date)}`}>
      <img className="photo-full" src={photo.dataUrl} alt={`Photo ${POSE_LABELS[photo.pose]} du ${dayLabel(photo.date)}`} />
      <div className="sheet-actions">
        <button
          className="btn btn-ghost btn-danger"
          onClick={async () => {
            if (!confirm('Supprimer cette photo ? Elle ne pourra pas être récupérée (sauf depuis une sauvegarde).')) return
            await deletePhoto(photo.id)
            onClose()
          }}
        >
          Supprimer la photo
        </button>
      </div>
    </Sheet>
  )
}

function CompareSheet({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const ofPose = (pose: PhotoPose) => photos.filter((p) => p.pose === pose)
  const [pose, setPoseState] = useState<PhotoPose>(() => POSES.find((p) => ofPose(p.value).length >= 2)!.value)
  const list = ofPose(pose)
  const [beforeId, setBeforeId] = useState(list[0].id)
  const [afterId, setAfterId] = useState(list.at(-1)!.id)
  const setPose = (next: PhotoPose) => {
    setPoseState(next)
    setBeforeId(ofPose(next)[0].id)
    setAfterId(ofPose(next).at(-1)!.id)
  }
  const before = list.find((p) => p.id === beforeId) ?? list[0]
  const after = list.find((p) => p.id === afterId) ?? list.at(-1)!

  const picker = (label: string, value: string, onChange: (id: string) => void) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="text-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {dayLabel(p.date)}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Sheet open onClose={onClose} title="Comparer">
      <PoseSwitch value={pose} onChange={setPose} disabled={(p) => ofPose(p).length < 2} />
      <div className="compare-grid">
        <figure>
          <img src={before.dataUrl} alt={`Avant : ${dayLabel(before.date)}`} />
          <figcaption>{dayLabel(before.date)}</figcaption>
        </figure>
        <figure>
          <img src={after.dataUrl} alt={`Après : ${dayLabel(after.date)}`} />
          <figcaption>{dayLabel(after.date)}</figcaption>
        </figure>
      </div>
      <div className="field-grid">
        {picker('Avant', before.id, setBeforeId)}
        {picker('Après', after.id, setAfterId)}
      </div>
    </Sheet>
  )
}
