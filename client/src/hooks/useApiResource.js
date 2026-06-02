import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api/client.js'

/**
 * Small data-loader hook used by feed/explore/profile pages.
 *
 * Returns `{ data, error, isLoading, refetch }`. Invoking `refetch()`
 * bumps an internal counter that re-runs the load effect; useful
 * after mutations (follow, like, save, comment) so the page reflects
 * the new server state without a full route remount.
 *
 * `enabled = false` skips the initial load (handy when the dependent
 * params aren't ready yet) — the initial `isLoading` already reflects
 * `enabled` so we never have to setState in the effect body for that.
 */
export default function useApiResource(path, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(enabled))
  const [reloadCounter, setReloadCounter] = useState(0)

  // refetch is a regular event handler, so setting `isLoading` here
  // (not inside an effect) is fine and gives the UI an immediate
  // pending signal while the next fetch is in flight.
  const refetch = useCallback(() => {
    setIsLoading(true)
    setReloadCounter((c) => c + 1)
  }, [])

  // Effect only runs async work and only updates state after the
  // request resolves — react-hooks/set-state-in-effect is satisfied.
  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false

    async function run() {
      try {
        const result = await apiRequest(path)
        if (!cancelled) {
          setData(result)
          setError('')
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [enabled, path, reloadCounter])

  return { data, error, isLoading, refetch }
}
