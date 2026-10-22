import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Génère les icônes de l'appli (npm run icons) à partir de public/icon.svg.
// Fond sombre pour l'icône iPhone (iOS n'accepte pas la transparence).
const background = '#0e0f11'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
