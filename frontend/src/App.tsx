import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Gallery from './pages/Gallery'
import MessageBoard from './pages/MessageBoard'
import Admin from './pages/Admin'
import PaymentResult from './pages/PaymentResult'
import Maintenance from './pages/Maintenance'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/gallery" /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/gallery" /> : <Register />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Home />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/gallery"
          element={
            <ProtectedRoute>
              <Layout>
                <Gallery />
              </Layout>
            </ProtectedRoute>
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
    </BrowserRouter>
  )
}

export default App

