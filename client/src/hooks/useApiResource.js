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
 * params aren't ready yet). The initial `isLoading` already reflects
 * `enabled`, so the steady-state path avoids setting state inside the
 * effect body.
 *
 * Path changes reset `data` to `null` and `isLoading` to `true` so
 * the page shows a loading state instead of the previous path's
 * stale data while the new request is in flight.
 */
export default function useApiResource(path, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(enabled))
  const [reloadCounter, setReloadCounter] = useState(0)
  // Track the path that produced the current state. When `path`
  // changes, the compare-and-set below resets data/isLoading
  // synchronously during render — see "Storing information from
  // previous renders" in the React docs. React will rerun the render
  // immediately with the reset state before painting, so the user
  // never sees a stale-data frame.
  const [trackedPath, setTrackedPath] = useState(path)

  if (path !== trackedPath) {
    setTrackedPath(path)
    setData(null)
    setError('')
    if (enabled) setIsLoading(true)
  }

  // refetch is a regular event handler, so setting `isLoading` here
  // (not inside an effect) is fine and gives the UI an immediate
  // pending signal while the next fetch is in flight.
  const refetch = useCallback(() => {
    setIsLoading(true)
    setReloadCounter((c) => c + 1)
  }, [])

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
