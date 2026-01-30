import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogOut, Plus } from 'lucide-react'
import { useState } from 'react'
import RechargeModal from './RechargeModal'

export default function Header() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const [showRecharge, setShowRecharge] = useState(false)

  if (!isAuthenticated) return null

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-2xl font-bold text-gray-900">
              w8nrind
            </Link>
            <nav className="hidden md:flex space-x-6">
              <a href="#" className="text-gray-600 hover:text-gray-900">
                大模型 <span className="text-xs">▼</span>
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900">
                探索 <span className="text-xs">▼</span>
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900">
                体验场 <span className="text-xs">▼</span>
              </a>
              <a href="#" className="text-gray-600 hover:text-gray-900">
                更多 <span className="text-xs">▼</span>
              </a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">公告</span>
            <span className="text-sm text-gray-600">中文</span>
            {user && (
              <>
                <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
                  <span className="text-sm text-gray-600">
                    积分: {user.points?.toFixed(2) ?? '0.00'}
                  </span>
                  <button 
                    onClick={() => setShowRecharge(true)}
                    className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center"
                  >
                    <Plus size={14} className="mr-0.5" /> 充值
                  </button>
                </div>
                
                {user.isAdmin && (
                  <Link
                    to="/admin"
                    className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    管理面板
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="p-2 text-gray-600 hover:text-gray-900"
                  title="退出登录"
                >
                  <LogOut size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {showRecharge && <RechargeModal onClose={() => setShowRecharge(false)} />}
    </header>
  )
}

