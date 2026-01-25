import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, user, fetchUserInfo } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUserInfo()
    }
  }, [isAuthenticated, user, fetchUserInfo])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && (!user || !user.isAdmin)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

