import { useEffect, useState } from 'react'

export function useHash(): string {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.hash,
  )
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export type Route =
  | { kind: 'home' }
  | { kind: 'briefing'; date: string }

export function parseRoute(hash: string): Route {
  const m = hash.match(/^#\/briefing\/([\w-]+)/)
  if (m) return { kind: 'briefing', date: m[1] }
  return { kind: 'home' }
}
