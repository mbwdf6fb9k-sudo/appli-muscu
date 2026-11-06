import { useEffect } from 'react'

interface WakeLockHost {
  wakeLock?: Pick<WakeLock, 'request'>
}

/**
 * Garde l'écran allumé, et redemande quand on revient dans l'appli (l'iPhone libère le verrou dès qu'on la quitte).
 * Sans effet si le téléphone ne le permet pas. Renvoie la fonction qui rend la main.
 */
export function startWakeLock(host: WakeLockHost, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>): () => void {
  const wakeLock = host.wakeLock
  if (!wakeLock) return () => {}
  let sentinel: WakeLockSentinel | null = null
  let stopped = false

  const request = async () => {
    if (stopped || sentinel || doc.visibilityState !== 'visible') return
    try {
      const obtained = await wakeLock.request('screen')
      if (stopped) {
        void obtained.release()
        return
      }
      sentinel = obtained
      obtained.addEventListener('release', () => {
        if (sentinel === obtained) sentinel = null
      })
    } catch {
      // Refusé (batterie faible, version d'iOS) : l'écran se verrouille comme d'habitude
    }
  }
  const onVisibility = () => void request()

  doc.addEventListener('visibilitychange', onVisibility)
  void request()
  return () => {
    stopped = true
    doc.removeEventListener('visibilitychange', onVisibility)
    void sentinel?.release()
    sentinel = null
  }
}

export function useWakeLock(enabled: boolean): void {
  useEffect(() => (enabled ? startWakeLock(navigator, document) : undefined), [enabled])
}
