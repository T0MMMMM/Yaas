import { useEffect } from 'react'
import { useSettings } from '../stores/settings'
import { applyTheme, onSystemSchemeChange } from '../theme/applyTheme'
import { Onboarding } from '../features/onboarding/Onboarding'
import { Shell } from './Shell'

export function App() {
  const { info, settings, init } = useSettings()

  useEffect(() => init(), [init])

  useEffect(() => {
    if (!settings) return
    applyTheme(settings, info)
    return onSystemSchemeChange(() => applyTheme(settings, info))
  }, [settings, info])

  if (!settings) return null

  return (
    <>
      {settings.onboardingDone ? <Shell /> : <Onboarding />}
      <div className="grain" aria-hidden />
    </>
  )
}
