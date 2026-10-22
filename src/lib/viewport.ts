/**
 * Défaut d'iOS : une appli installée avec l'ancienne barre d'état « black-translucent » reçoit une
 * hauteur amputée de la barre d'état, et iOS n'affiche rien en dessous. On ne peut pas dessiner dans
 * ce vide : on retire alors la marge du bas de la barre d'onglets pour qu'elle descende au plus bas.
 * Avec la barre d'état « black » (index.html), ce cas ne se produit pas et rien n'est modifié.
 */
export function detectShortViewport(): void {
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    matchMedia('(display-mode: standalone)').matches
  if (!standalone) return

  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden'
  document.body.append(probe)

  const update = () => {
    const safeTop = probe.offsetHeight
    const portrait = window.innerHeight >= window.innerWidth
    const screenHeight = portrait
      ? Math.max(screen.width, screen.height)
      : Math.min(screen.width, screen.height)
    // Appli sous la barre d'état ET hauteur trop courte d'au moins la barre d'état : c'est le défaut
    const short = safeTop > 0 && screenHeight - window.innerHeight >= safeTop - 2
    document.documentElement.classList.toggle('ios-short-viewport', short)
  }

  update()
  window.addEventListener('resize', update)
}
