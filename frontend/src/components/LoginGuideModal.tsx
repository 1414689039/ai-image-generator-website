import { X, User, LogIn } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

interface LoginGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginGuideModal({ isOpen, onClose }: LoginGuideModalProps) {
  const { openAuthModal } = useAuthStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl transform transition-all scale-100">
        <div className="relative p-6 text-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-900/20">
            <User size={32} className="text-white" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">请先登录</h3>
          <p className="text-gray-400 mb-8">
            登录后即可使用“做同款”、查看完整提示词以及收藏您喜欢的作品。
          </p>

          <div className="space-y-3">
            <button
              onClick={() => {
                  onClose()
                  openAuthModal('login')
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              立即登录
            </button>
            <button
              onClick={() => {
                  onClose()
                  openAuthModal('register')
              }}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-medium transition-all"
            >
              注册新账号
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
