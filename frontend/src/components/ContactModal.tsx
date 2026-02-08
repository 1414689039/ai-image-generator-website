import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, MessageCircle } from 'lucide-react'
import apiClient from '../api/client'

interface ContactModalProps {
  onClose: () => void
}

export default function ContactModal({ onClose }: ContactModalProps) {
  const [content, setContent] = useState('正在加载...')

  useEffect(() => {
    // 获取公开配置
    apiClient.get('/config?key=contact_us_info')
      .then(res => {
        setContent(res.data.config?.contact_us_info || '暂无联系方式，请稍后再试。')
      })
      .catch(() => {
        setContent('获取联系方式失败，请稍后再试。')
      })
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md p-6 relative text-white animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center mb-6 pt-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-4 text-blue-400 ring-1 ring-white/10 shadow-lg">
                <MessageCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">联系客服</h2>
            <p className="text-gray-400 text-sm mt-1">遇到问题？我们随时为您服务</p>
        </div>

        <div className="bg-white/5 p-6 rounded-xl border border-white/5 text-gray-300 leading-relaxed whitespace-pre-wrap min-h-[100px] text-sm text-center select-text">
            {content}
        </div>
        
        <button
            onClick={onClose}
            className="w-full mt-6 py-3.5 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-colors shadow-lg shadow-white/10"
        >
            知道了
        </button>
      </div>
    </div>,
    document.body
  )
}
