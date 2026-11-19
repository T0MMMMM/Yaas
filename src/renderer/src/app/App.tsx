import { useEffect } from 'react'
import { IconContext } from '@phosphor-icons/react'
import { useAccounts } from '../stores/accounts'
import { useSettings } from '../stores/settings'
import { applyTheme, onSystemSchemeChange } from '../theme/applyTheme'
import { Onboarding } from '../features/onboarding/Onboarding'
import { Shell } from './Shell'

export function App() {
  const { info, settings, init } = useSettings()

  const initAccounts = useAccounts((s) => s.init)

  useEffect(() => init(), [init])
  useEffect(() => initAccounts(), [initAccounts])

  useEffect(() => {
    if (!settings) return
    applyTheme(settings, info)
    return onSystemSchemeChange(() => applyTheme(settings, info))
  }, [settings, info])

  if (!settings) return null

  return (
    <IconContext.Provider value={{ weight: 'duotone', size: 16 }}>
      {settings.onboardingDone ? <Shell /> : <Onboarding />}
    </IconContext.Provider>
  )
}
