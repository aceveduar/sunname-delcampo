import { useState } from 'react'

type Preferences = { caja?: boolean; workspace?: boolean }
export function sidebarPreferenceKey(userId: string) {
  return (
    'sunname:sidebar:v1:' +
    (import.meta.env.VITE_SUPABASE_URL ?? 'local') +
    ':' +
    userId
  )
}
function readPreferences(key: string): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (!value || typeof value !== 'object') return {}
    const parsed = value as Record<string, unknown>
    return {
      caja: typeof parsed.caja === 'boolean' ? parsed.caja : undefined,
      workspace:
        typeof parsed.workspace === 'boolean' ? parsed.workspace : undefined,
    }
  } catch {
    return {}
  }
}
/** Separate preferences keep administrative navigation from widening the checkout. */
export function useSidebarPreference(
  userId: string,
  checkout: boolean,
  largeText: boolean,
) {
  const key = sidebarPreferenceKey(userId)
  const [preferences, setPreferences] = useState(() => readPreferences(key))
  const scope = checkout ? 'caja' : 'workspace'
  const collapsed = preferences[scope] ?? (checkout || largeText)
  const toggle = () => {
    const next = { ...preferences, [scope]: !collapsed }
    setPreferences(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // The control still works if browser storage is unavailable.
    }
  }
  return { collapsed, toggle }
}
