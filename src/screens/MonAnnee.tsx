import { ComingSoon } from '../components/ComingSoon'
import { CalendarIcon } from '../components/icons'
import { Screen, SettingsLink } from '../components/Screen'

export function MonAnnee() {
  return (
    <Screen title="Mon année" trailing={<SettingsLink />}>
      <ComingSoon icon={<CalendarIcon />}>
        Ton profil, ton objectif, tes pesées rapides et la courbe de ton poids sur l’année.
      </ComingSoon>
    </Screen>
  )
}
