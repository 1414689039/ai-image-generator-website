import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogOut, Plus, User, CreditCard, RefreshCw, ChevronDown, Shield, MessageCircle, Lock, Menu, X, Home, Image } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import RechargeModal from './RechargeModal'
import ContactModal from './ContactModal'
import ChangePasswordModal from './ChangePasswordModal'

export default function Header() {
  const { user, logout, isAuthenticated, fetchUserInfo } = useAuthStore()
  const [showRecharge, setShowRecharge] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isAuthenticated) return null

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 backdrop-blur-xl bg-black/20 border-b border-white/5 transition-all duration-300">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4 md:space-x-8">
            {/* 移动端汉堡菜单按钮 */}
            <button 
              className="md:hidden text-white p-1"
              onClick={() => setShowMobileMenu(true)}
            >
              <Menu size={24} />
            </button>

            <Link to="/" className="text-xl font-bold text-white flex items-center space-x-2">
              <img src="/mileguo.png" alt="Logo" className="w-8 h-8" />
              <span>Mileguo</span>
            </Link>
            <nav className="hidden md:flex space-x-6 text-sm">
              <Link to="/gallery" className="text-gray-300 hover:text-white transition-colors">
                生图灵感
              </Link>
              <Link to="/messages" className="text-gray-300 hover:text-white transition-colors">
                留言板
              </Link>
              <button 
                onClick={() => setShowContact(true)}
                className="text-gray-300 hover:text-white transition-colors"
              >
                联系客服
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                {/* 顶部快捷积分显示 */}
                <div className="hidden md:flex items-center gap-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-md pl-4 pr-1 py-1 rounded-full border border-white/10 group hover:border-white/20 transition-all">
                  <div className="flex flex-col items-end leading-none mr-2">
                     <span className="text-[10px] text-gray-400 uppercase tracking-wider">Credits</span>
                     <span className="text-sm font-bold text-white font-mono">{user.points?.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <button 
                    onClick={() => setShowRecharge(true)}
                    className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-full text-white shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                {/* 头像及下拉菜单 */}
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center space-x-2 focus:outline-none"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg ring-2 ring-transparent hover:ring-white/20 transition-all">
                            {user.username?.[0]?.toUpperCase() || <User size={14} />}
                        </div>
                    </button>

                    {/* 下拉菜单 */}
                    {showDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-[#1e1e1e]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                            {/* 账户信息 */}
                            <div className="p-4 border-b border-white/10">
                                <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">账户信息</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">用户名</span>
                                        <span className="text-white font-medium">{user.username}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">邮箱</span>
                                        <span className="text-white/80 text-xs">{user.email}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 积分信息 */}
                            <div className="p-4 border-b border-white/10 bg-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-white">剩余积分</span>
                                    <button onClick={() => fetchUserInfo()} className="text-gray-400 hover:text-white transition-colors">
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                                <div className="flex items-baseline space-x-1">
                                    <span className="text-2xl font-bold text-blue-400 font-mono">{user.points?.toFixed(2) ?? '0.00'}</span>
                                    <span className="text-xs text-gray-500">pts</span>
                                </div>
                            </div>

                            {/* 操作菜单 */}
                            <div className="p-2 space-y-1">
                                <button 
                                    onClick={() => {
                                        setShowRecharge(true)
                                        setShowDropdown(false)
                                    }}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm"
                                >
                                    <div className="flex items-center space-x-3">
                                        <CreditCard size={16} />
                                        <span>积分充值</span>
                                    </div>
                                    <ChevronDown size={14} className="-rotate-90 text-gray-500" />
                                </button>

                                <button 
                                    onClick={() => {
                                        setShowContact(true)
                                        setShowDropdown(false)
                                    }}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm"
                                >
                                    <div className="flex items-center space-x-3">
                                        <MessageCircle size={16} />
                                        <span>联系客服</span>
                                    </div>
                                    <ChevronDown size={14} className="-rotate-90 text-gray-500" />
                                </button>

                                <button 
                                    onClick={() => {
                                        setShowChangePassword(true)
                                        setShowDropdown(false)
                                    }}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors text-sm"
                                >
                                    <div className="flex items-center space-x-3">
                                        <Lock size={16} />
                                        <span>修改密码</span>
                                    </div>
                                    <ChevronDown size={14} className="-rotate-90 text-gray-500" />
                                </button>
                                
                                {user.isAdmin && (
                                    <Link 
                                        to="/admin"
                                        onClick={() => setShowDropdown(false)}
                                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <Shield size={16} />
                                            <span>管理员面板</span>
                                        </div>
                                        <ChevronDown size={14} className="-rotate-90 text-blue-500" />
                                    </Link>
                                )}
                                
                                <button 
                                    onClick={() => {
                                        logout()
                                        setShowDropdown(false)
                                    }}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-red-500/10 text-gray-300 hover:text-red-400 transition-colors text-sm mt-1 border-t border-white/5 pt-2"
                                >
                                    <div className="flex items-center space-x-3">
                                        <LogOut size={16} />
                                        <span>退出登录</span>
                                    </div>
                                    <ChevronDown size={14} className="-rotate-90 text-gray-500" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
              </>
            )}
          </div>
      </div>
      {showRecharge && <RechargeModal onClose={() => setShowRecharge(false)} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </header>

    {/* 移动端侧边抽屉菜单 */}
    {showMobileMenu && (
      <div className="fixed inset-0 z-50 md:hidden">
        {/* 背景遮罩 */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setShowMobileMenu(false)}
        />
        
        {/* 抽屉内容 */}
        <div className="absolute top-0 left-0 bottom-0 w-[80%] max-w-sm bg-[#1e1e1e] border-r border-white/10 shadow-2xl p-6 flex flex-col animate-in slide-in-from-left duration-200">
          <div className="flex justify-between items-center mb-8">
            <Link to="/" onClick={() => setShowMobileMenu(false)} className="flex items-center space-x-2">
              <img src="/mileguo.png" alt="Logo" className="w-8 h-8" />
              <span className="text-xl font-bold text-white">Mileguo</span>
            </Link>
            <button onClick={() => setShowMobileMenu(false)} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          {/* 用户信息卡片 */}
          {user && (
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg">
                  {user.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-medium">{user.username}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                <div>
                  <div className="text-xs text-gray-400 mb-1">剩余积分</div>
                  <div className="text-xl font-bold text-blue-400 font-mono">{user.points?.toFixed(2)}</div>
                </div>
                <button 
                  onClick={() => {
                    setShowMobileMenu(false)
                    setShowRecharge(true)
                  }}
                  className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-500 transition-colors"
                >
                  充值
                </button>
              </div>
            </div>
          )}

          {/* 导航菜单 */}
          <nav className="flex-1 space-y-2">
            <Link 
              to="/" 
              onClick={() => setShowMobileMenu(false)}
              className="flex items-center space-x-3 text-gray-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl transition-colors"
            >
              <Home size={20} />
              <span>首页创作</span>
            </Link>
            <Link 
              to="/gallery" 
              onClick={() => setShowMobileMenu(false)}
              className="flex items-center space-x-3 text-gray-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl transition-colors"
            >
              <Image size={20} />
              <span>灵感社区</span>
            </Link>
            <Link 
              to="/messages" 
              onClick={() => setShowMobileMenu(false)}
              className="flex items-center space-x-3 text-gray-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl transition-colors"
            >
              <MessageCircle size={20} />
              <span>留言板</span>
            </Link>
            <button
              onClick={() => {
                setShowMobileMenu(false)
                setShowContact(true)
              }}
              className="w-full flex items-center space-x-3 text-gray-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl transition-colors"
            >
              <MessageCircle size={20} />
              <span>联系客服</span>
            </button>
            <button
              onClick={() => {
                setShowMobileMenu(false)
                setShowChangePassword(true)
              }}
              className="w-full flex items-center space-x-3 text-gray-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-xl transition-colors"
            >
              <Lock size={20} />
              <span>修改密码</span>
            </button>
            {user?.isAdmin && (
              <Link 
                to="/admin" 
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center space-x-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-4 py-3 rounded-xl transition-colors"
              >
                <Shield size={20} />
                <span>管理员面板</span>
              </Link>
            )}
          </nav>

          {/* 底部退出按钮 */}
          <div className="border-t border-white/10 pt-4 mt-4">
            <button 
              onClick={() => {
                logout()
                setShowMobileMenu(false)
              }}
              className="w-full flex items-center justify-center space-x-2 text-gray-400 hover:text-red-400 py-3 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={20} />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

