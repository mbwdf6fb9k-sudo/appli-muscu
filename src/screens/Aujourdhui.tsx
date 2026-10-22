import { BackupBanner } from '../components/BackupBanner'
import { ComingSoon } from '../components/ComingSoon'
import { DumbbellIcon } from '../components/icons'
import { Screen, SettingsLink } from '../components/Screen'
import { formatLongDate } from '../lib/dates'

export function Aujourdhui() {
  return (
    <Screen title="Aujourd’hui" subtitle={formatLongDate(new Date())} trailing={<SettingsLink />}>
      <BackupBanner />
      <ComingSoon icon={<DumbbellIcon />}>
        Ici, tu choisiras ta séance du jour (Dos-Biceps, Pecs-Triceps, Jambes, Bras ou Repos) et tu la
        lanceras.
      </ComingSoon>
    </Screen>
  )
}
