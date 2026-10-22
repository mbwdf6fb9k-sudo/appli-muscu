import { ComingSoon } from '../components/ComingSoon'
import { ProgressIcon } from '../components/icons'
import { Screen, SettingsLink } from '../components/Screen'

export function Progres() {
  return (
    <Screen title="Progrès" trailing={<SettingsLink />}>
      <ComingSoon icon={<ProgressIcon />}>
        L’historique de tes séances, tes records et tes courbes de progression par exercice.
      </ComingSoon>
    </Screen>
  )
}
