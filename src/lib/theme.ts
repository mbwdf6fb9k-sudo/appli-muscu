import { useEffect } from 'react'
import type { Theme } from '../db/settings'

const STORAGE_KEY = 'appli-muscu-theme'
const THEME_COLORS: Record<Theme, string> = { dark: '#0e0f11', light: '#f4f5f7' }

/** Applique le thème à la page et le mémorise pour le prochain démarrage (voir index.html). */
export function useApplyTheme(theme: Theme | undefined): void {
  useEffect(() => {
    if (!theme) return
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Stockage indisponible : le thème sera simplement réappliqué après le chargement.
    }
  }, [theme])
}
