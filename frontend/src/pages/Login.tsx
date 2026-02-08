import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader2, User, Lock } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* 背景图片 */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105 blur-sm"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")' 
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md p-8 mx-4 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl animate-fade-in-up">
        {/* Logo区域 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-4 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg p-3">
             <img src="/mileguo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-wide">Mileguo</h2>
          <p className="text-gray-400 text-sm mt-2 font-light">释放您的 AI 创意灵感</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm flex items-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-400 transition-colors">
                <User size={18} />
              </div>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名或邮箱"
                className="block w-full pl-10 pr-3 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all hover:bg-black/30"
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-400 transition-colors">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码"
                className="block w-full pl-10 pr-3 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all hover:bg-black/30"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  登录中...
                </>
              ) : (
                '登 录'
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-400">
              还没有账号？
              <Link to="/register" className="font-medium text-blue-400 hover:text-blue-300 ml-1 transition-colors underline-offset-4 hover:underline">
                立即注册
              </Link>
            </p>
          </div>
        </form>
      </div>
      
      {/* 底部版权 */}
      <div className="absolute bottom-6 text-white/20 text-xs">
        &copy; {new Date().getFullYear()} Mileguo AI. All rights reserved.
      </div>
    </div>
  )
}

