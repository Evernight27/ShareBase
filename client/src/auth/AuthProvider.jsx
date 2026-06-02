import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, getStoredToken, setStoredToken } from '../api/client.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState(null)
  const [isLoadingUser, setIsLoadingUser] = useState(Boolean(token))

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      if (!token) {
        setIsLoadingUser(false)
        return
      }

      setIsLoadingUser(true)

      try {
        const data = await apiRequest('/auth/me')
        if (isMounted) setUser(data.user)
      } catch {
        setStoredToken(null)
        if (isMounted) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (isMounted) setIsLoadingUser(false)
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [token])

  const login = useCallback(async (identifier, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
    setStoredToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (username, email, password) => {
    const data = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })
    setStoredToken(data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      isLoadingUser,
      login,
      logout,
      register,
      token,
      user,
    }),
    [isLoadingUser, login, logout, register, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
