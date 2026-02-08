import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Lock, Loader2 } from 'lucide-react'
import apiClient from '../api/client'

interface ChangePasswordModalProps {
  onClose: () => void
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('新密码长度至少为6位')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (oldPassword === newPassword) {
      setError('新密码不能与旧密码相同')
      return
    }

    setLoading(true)
    try {
      await apiClient.put('/user/password', {
        oldPassword,
        newPassword
      })
      alert('密码修改成功，请重新登录')
      onClose()
      // 可以选择强制登出，或者让用户自己登出
      window.location.reload()
    } catch (err: any) {
      setError(err.response?.data?.error || '修改密码失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e]/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl w-full max-w-md p-6 relative text-white animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 text-purple-400">
                <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">修改密码</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm text-gray-400">当前密码</label>
                <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-white placeholder-gray-600"
                    placeholder="请输入当前密码"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm text-gray-400">新密码</label>
                <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-white placeholder-gray-600"
                    placeholder="请输入新密码（至少6位）"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm text-gray-400">确认新密码</label>
                <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-white placeholder-gray-600"
                    placeholder="请再次输入新密码"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mt-6"
            >
                {loading ? (
                    <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>正在提交...</span>
                    </>
                ) : (
                    <span>确认修改</span>
                )}
            </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
