import { ComingSoon } from '../components/ComingSoon'
import { PillIcon } from '../components/icons'
import { Screen, SettingsLink } from '../components/Screen'

export function Complements() {
  return (
    <Screen title="Compléments" trailing={<SettingsLink />}>
      <ComingSoon icon={<PillIcon />}>
        Ton planning de compléments du jour, adapté à l’entraînement ou au repos, avec des cases à cocher.
      </ComingSoon>
    </Screen>
  )
}
