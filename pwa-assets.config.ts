import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Génère les icônes de l'appli (npm run icons) à partir de public/icon.svg.
// Le dessin a déjà son fond et ses marges : on n'ajoute presque rien autour
// (le préréglage ajoute 30 % de marge sur l'icône iPhone, ce qui rendait l'haltère trop petite).
const background = '#121212'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    // Android découpe l'icône en cercle : on garde une marge de sécurité
    maskable: { ...minimal2023Preset.maskable, padding: 0.12, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
