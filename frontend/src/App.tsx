import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useEffect } from 'react'
import Home from './pages/Home'
import Gallery from './pages/Gallery'
import MessageBoard from './pages/MessageBoard'
import Admin from './pages/Admin'
import PaymentResult from './pages/PaymentResult'
import Maintenance from './pages/Maintenance'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AuthModal from './components/AuthModal'

// 辅助组件：处理旧路由的重定向并打开弹窗
function LegacyAuthRoute({ type }: { type: 'login' | 'register' }) {
  const { openAuthModal, isAuthenticated } = useAuthStore()
  
  useEffect(() => {
    if (!isAuthenticated) {
        openAuthModal(type)
    }
  }, [type, isAuthenticated, openAuthModal])

  return <Navigate to="/gallery" replace />
}

function AppContent() {
    const { isAuthenticated } = useAuthStore()
    return (
        <>
            <AuthModal />
            <Routes>
                <Route path="/maintenance" element={<Maintenance />} />
                
                {/* 将旧的 /login 和 /register 路由重定向到 /gallery 并打开弹窗 */}
                <Route path="/login" element={isAuthenticated ? <Navigate to="/gallery" /> : <LegacyAuthRoute type="login" />} />
                <Route path="/register" element={isAuthenticated ? <Navigate to="/gallery" /> : <LegacyAuthRoute type="register" />} />
                
                <Route
                path="/"
                element={
                    isAuthenticated ? (
                    <Layout>
                        <Home />
                    </Layout>
                    ) : (
                    <Navigate to="/gallery" replace />
                    )
                }
                />
                <Route
                path="/gallery"
                element={
                    <Layout>
                        <Gallery />
                    </Layout>
                }
                />
                <Route
                path="/messages"
                element={
                    <Layout>
                    <MessageBoard />
                    </Layout>
                }
                />
                <Route
                path="/payment/result"
                element={
                    <Layout>
                    <PaymentResult />
                    </Layout>
                }
                />
                <Route
                path="/admin"
                element={
                    <ProtectedRoute requireAdmin>
                    <Layout>
                        <Admin />
                    </Layout>
                    </ProtectedRoute>
                }
                />
            </Routes>
        </>
    )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App

