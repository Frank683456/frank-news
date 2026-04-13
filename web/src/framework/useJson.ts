import { useEffect, useState } from 'react'

type State<T> =
  | { status: 'loading'; data: null; error: null; updatedAt: null }
  | { status: 'ready'; data: T; error: null; updatedAt: string | null }
  | { status: 'error'; data: null; error: string; updatedAt: null }

const STALE_MS = 30 * 60 * 1000

export function useJson<T = unknown>(url: string, refreshMs = 60_000) {
  const [state, setState] = useState<State<T>>({
    status: 'loading',
    data: null,
    error: null,
    updatedAt: null,
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as T & { updatedAt?: string }
        if (cancelled) return
        setState({
          status: 'ready',
          data: data as T,
          error: null,
          updatedAt: (data as { updatedAt?: string }).updatedAt ?? null,
        })
      } catch (e) {
        if (cancelled) return
        setState({
          status: 'error',
          data: null,
          error: e instanceof Error ? e.message : 'failed',
          updatedAt: null,
        })
      }
    }

    load()
    const t = setInterval(load, refreshMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [url, refreshMs])

  const stale =
    state.status === 'ready' && state.updatedAt
      ? Date.now() - new Date(state.updatedAt).getTime() > STALE_MS
      : false

  return { ...state, stale }
}
