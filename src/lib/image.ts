/** Côté le plus long d'une photo d'évolution après réduction (px). */
export const PHOTO_MAX_SIDE = 1280
const PHOTO_QUALITY = 0.8

/** Dimensions réduites en gardant les proportions (jamais agrandies). */
export function fitSize(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Taille approximative (octets) d'une image « data:…;base64,… ». */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

/** « 240 Ko », « 3,1 Mo » */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} Ko`
  return `${(Math.round(bytes / 100_000) / 10).toLocaleString('fr-FR')} Mo`
}

/**
 * Réduit la photo choisie (appareil photo ou photothèque) en JPEG léger.
 * Le navigateur applique déjà l'orientation de la photo en la dessinant.
 */
export async function resizePhoto(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const size = fitSize(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas indisponible')
    context.drawImage(image, 0, 0, size.width, size.height)
    return { dataUrl: canvas.toDataURL('image/jpeg', PHOTO_QUALITY), ...size }
  } finally {
    URL.revokeObjectURL(url)
  }
}
