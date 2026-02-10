import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    authModalTab, 
    openAuthModal,
    login,
    register,
    fetchUserInfo 
  } = useAuthStore()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 表单状态
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')

  // 每次打开或切换Tab时重置错误和部分状态
  useEffect(() => {
    setError('')
    setIsLoading(false)
  }, [isAuthModalOpen, authModalTab])

  // 锁定背景滚动
  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isAuthModalOpen])

  if (!isAuthModalOpen) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      await login(username, password)
      await fetchUserInfo()
      closeAuthModal()
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少为 6 位')
      return
    }

    setIsLoading(true)
    try {
      await register(username, email, password)
      // 注册成功后自动切换到登录模式，并填充密码以便用户直接登录，或者直接自动登录
      // 这里为了简单和安全，我们自动执行登录
      try {
        await login(username, password)
        await fetchUserInfo()
        closeAuthModal()
      } catch (loginErr) {
        // 如果自动登录失败（极其罕见），则切换到登录页让用户手动登录
        openAuthModal('login')
        setError('注册成功，请登录')
      }
    } catch (err: any) {
      setError(err.message || '注册失败')
    } finally {
      setIsLoading(false)
    }
  }

  const isLogin = authModalTab === 'login'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md p-8 relative text-white animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full z-10"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center mb-8 pt-2 relative z-10">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
              {isLogin ? '欢迎回来' : '创建账号'}
            </h2>
            <p className="text-gray-400 text-sm">
              {isLogin ? '登录以继续您的 AI 创作之旅' : '加入我们，开启无限创意可能'}
            </p>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4 relative z-10">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-4 animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                required
              />
            </div>

            {!isLogin && (
               <div className="relative group">
                 <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                 <input
                   type="email"
                   placeholder="电子邮箱"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                   required
                 />
               </div>
            )}

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                required
              />
            </div>

            {!isLogin && (
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                <input
                  type="password"
                  placeholder="确认密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                  required
                />
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {isLogin ? '登录中...' : '注册中...'}
              </>
            ) : (
              <>
                <span>{isLogin ? '立即登录' : '创建账号'}</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400 relative z-10">
          {isLogin ? (
            <>
              还没有账号？
              <button 
                onClick={() => openAuthModal('register')}
                className="text-blue-400 hover:text-blue-300 ml-1 font-medium transition-colors"
              >
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button 
                onClick={() => openAuthModal('login')}
                className="text-blue-400 hover:text-blue-300 ml-1 font-medium transition-colors"
              >
                直接登录
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
