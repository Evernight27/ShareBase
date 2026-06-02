import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContext.js'

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const { isAuthenticated, isLoadingUser } = useAuth()

  if (isLoadingUser) {
    return <p className="text-neutral-600">Checking your session...</p>
  }

  if (!isAuthenticated) {
    return <Navigate to="/accounts/login" replace state={{ from: location }} />
  }

  return children
}
