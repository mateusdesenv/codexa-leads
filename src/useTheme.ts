import { useEffect, useState } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
const STORAGE_KEY = 'codexa-theme'

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved
  } catch { /* Theme switching remains available when storage is blocked. */ }
  return 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(readPreference)

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system'
        ? (system.matches ? 'dark' : 'light')
        : theme
    }
    apply()
    system.addEventListener('change', apply)
    return () => system.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setTheme(readPreference())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const selectTheme = (preference: ThemePreference) => {
    setTheme(preference)
    try { localStorage.setItem(STORAGE_KEY, preference) } catch { /* Keep the in-memory preference. */ }
  }

  return [theme, selectTheme] as const
}
