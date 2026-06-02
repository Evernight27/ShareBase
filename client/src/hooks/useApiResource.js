import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client.js'

export default function useApiResource(path, { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(enabled))

  useEffect(() => {
    let isMounted = true

    async function load() {
      if (!enabled) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError('')

      try {
        const result = await apiRequest(path)
        if (isMounted) setData(result)
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [enabled, path])

  return { data, error, isLoading }
}
