import { useEffect } from 'react'
import { IconContext } from '@phosphor-icons/react'
import { useAccounts } from '../stores/accounts'
import { useSettings } from '../stores/settings'
import { applyTheme, onSystemSchemeChange } from '../theme/applyTheme'
import { Onboarding } from '../features/onboarding/Onboarding'
import { Overlay } from './Overlay'
import { Shell } from './Shell'
import { WindowControls } from './WindowControls'

/** The overlay view loads this same renderer under `#overlay` (main/browser/overlayView.ts). */
const isOverlay = location.hash === '#overlay'

export function App() {
  const { info, settings, init } = useSettings()

  const initAccounts = useAccounts((s) => s.init)

  useEffect(() => init(), [init])
  useEffect(() => (isOverlay ? undefined : initAccounts()), [initAccounts])

  useEffect(() => {
    if (!settings) return
    applyTheme(settings, info)
    return onSystemSchemeChange(() => applyTheme(settings, info))
  }, [settings, info])

  if (isOverlay) {
    return (
      <IconContext.Provider value={{ weight: 'duotone', size: 16 }}>
        <Overlay />
      </IconContext.Provider>
    )
  }

  if (!settings) return null

  return (
    <IconContext.Provider value={{ weight: 'duotone', size: 16 }}>
      {settings.onboardingDone ? (
        <Shell />
      ) : (
        <>
          <Onboarding />
          {(info?.platform === 'mac' || info?.platform === 'windows') && (
            <WindowControls platform={info.platform} floating />
          )}
        </>
      )}
    </IconContext.Provider>
  )
}
