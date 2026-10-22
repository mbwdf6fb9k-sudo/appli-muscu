/**
 * Corrige un défaut d'iOS pour les applis lancées depuis l'écran d'accueil : avec la barre d'état
 * « black-translucent », la hauteur annoncée oublie la zone de la barre d'état alors que l'appli
 * s'affiche dessous. Résultat : un vide en bas de l'écran. On impose donc la hauteur réelle de l'écran.
 */
export function fixStandaloneHeight(): void {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    matchMedia('(display-mode: standalone)').matches
  if (!standalone) return

  const update = () => {
    // Sur iPhone, screen.width/height ne tournent pas avec l'écran : on prend le bon côté.
    const portrait = window.innerHeight >= window.innerWidth
    const screenHeight = portrait
      ? Math.max(screen.width, screen.height)
      : Math.min(screen.width, screen.height)
    const height = Math.max(screenHeight, window.innerHeight)
    document.documentElement.style.setProperty('--app-height', `${height}px`)
  }

  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
}
