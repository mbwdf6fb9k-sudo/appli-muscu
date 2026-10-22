let iosSwitch: HTMLLabelElement | null = null

/**
 * Petite vibration de confirmation.
 * - Android : navigator.vibrate.
 * - iPhone : Safari n'y donne pas accès, mais depuis iOS 18, actionner un interrupteur
 *   (<input type="checkbox" switch>) déclenche un retour haptique : on en actionne un, invisible.
 * - Ailleurs : rien.
 */
export function haptic(): void {
  try {
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(30)) return
    if (!iosSwitch) {
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      input.tabIndex = -1
      iosSwitch = document.createElement('label')
      iosSwitch.setAttribute('aria-hidden', 'true')
      iosSwitch.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden'
      iosSwitch.append(input)
      document.body.append(iosSwitch)
    }
    iosSwitch.click()
  } catch {
    // Pas de vibration possible : l'animation suffit
  }
}
