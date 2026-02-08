import { Loader2, AlertCircle, RotateCw, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import apiClient from '../api/client'

interface HistoryPanelProps {
  history: any[]
  onSelect: (item: any) => void
  onRefresh?: () => void
  viewMode?: 'footer' | 'full'
}

export default function HistoryPanel({ history, onSelect, onRefresh, viewMode = 'footer' }: HistoryPanelProps) {
  const [_, setTick] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorIds, setErrorIds] = useState<Set<number>>(new Set())

  const checkStatus = async (item: any) => {
      try {
          await apiClient.get(`/generation/check/${item.id}`)
          setErrorIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(item.id)
              return newSet
          })
      } catch (error) {
          console.error(`Check status failed for ${item.id}:`, error)
          setErrorIds(prev => new Set(prev).add(item.id))
      }
  }

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
        const pendingItems = history.filter(item => item.status === 'pending')
        await Promise.all(pendingItems.map(item => checkStatus(item)))
        onRefresh?.()
    } finally {
        setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  useEffect(() => {
    // 过滤掉临时项，避免对不存在的ID发起请求
    const pendingItems = history.filter(item => item.status === 'pending' && !item.isTemp)
    if (pendingItems.length > 0) {
      const interval = setInterval(async () => {
        // 使用 Promise.all 等待所有检查请求完成
        try {
            await Promise.all(pendingItems.map(item => checkStatus(item)))
            // 检查完成后再刷新列表
            onRefresh?.()
        } catch (error) {
            console.error('Auto check status failed:', error)
        }
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [history, onRefresh])

  useEffect(() => {
    const timerInterval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timerInterval)
  }, [])

  const getStatusDisplay = (item: any) => {
      if (errorIds.has(item.id)) {
          return { text: '失联', color: 'text-red-400', icon: <WifiOff size={14} className="mb-1" /> }
      }
      if (item.status === 'failed') {
          // 如果有具体的错误信息，则显示具体错误（截断），否则显示“失败”
          const errorText = item.error_message || '失败'
          const displayError = errorText.length > 4 ? errorText.substring(0, 4) + '...' : errorText
          return { 
              text: displayError, 
              color: 'text-red-500', 
              icon: <AlertCircle size={14} className="mb-1" />,
              fullText: errorText // 用于 tooltip
          }
      }
      if (item.status === 'pending') {
          if (item.progress > 0) {
              return { text: `${item.progress}%`, color: 'text-blue-400', icon: <Loader2 className="animate-spin mb-1" size={14} /> }
          }
          return { text: '排队中', color: 'text-yellow-400', icon: <Loader2 className="animate-spin mb-1" size={14} /> }
      }
      return null
  }

  // Full Page Mode (瀑布流)
  if (viewMode === 'full') {
    return (
        <div className="w-full h-full overflow-y-auto p-3 pb-24 custom-scrollbar bg-[#121212]">
            <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-lg font-bold text-white">历史记录</h2>
                <button 
                    onClick={handleRefresh}
                    className={`p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                >
                    <RotateCw size={18} />
                </button>
            </div>
            
            {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <p>暂无历史记录</p>
                </div>
            ) : (
                <div className="columns-2 gap-3 space-y-3">
                    {history.map((item) => {
                        const statusInfo = getStatusDisplay(item)
                        return (
                            <div 
                                key={item.id}
                                className="break-inside-avoid bg-white/5 rounded-xl overflow-hidden border border-white/10 relative group cursor-pointer"
                                onClick={() => onSelect(item)}
                            >
                                {item.status === 'completed' && item.result_urls?.[0] ? (
                                    <>
                                        <img 
                                            src={item.result_urls[0]} 
                                            alt="History" 
                                            className="w-full h-auto object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    </>
                                ) : (
                                    <div className="w-full aspect-square bg-[#1e1e1e] flex flex-col items-center justify-center p-4">
                                        {statusInfo ? (
                                            <>
                                                <div className={`${statusInfo.color} mb-2 scale-150`}>{statusInfo.icon}</div>
                                                <span className={`text-xs font-medium ${statusInfo.color} text-center`}>
                                                    {statusInfo.text}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-xs text-gray-500">无图片</span>
                                        )}
                                    </div>
                                )}
                                
                                {/* 底部简要信息 */}
                                <div className="p-2 bg-black/40 backdrop-blur-sm border-t border-white/5">
                                    <p className="text-[10px] text-gray-400 line-clamp-1">{item.prompt}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{new Date(item.created_at).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
  }

  // Footer Mode (Default)
  return (
    <div className="w-full h-full flex flex-col justify-end pb-24 md:pb-6 px-2 md:px-6 pointer-events-none">
      {/* 底部浮动内容容器 */}
      <div className="relative w-full flex items-end justify-center">
        
        {/* 中间历史记录条 */}
        <div className="pointer-events-auto bg-[#121212]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 w-[95%] md:w-auto md:max-w-[70%] transition-all hover:bg-[#121212]/80 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex space-x-3 overflow-x-auto custom-scrollbar pb-1 px-1" style={{ maxHeight: '100px' }}>
            {history.length === 0 && (
                <div className="text-gray-500 text-xs w-64 py-6 text-center flex flex-col items-center justify-center">
                    <span className="mb-1">暂无历史记录</span>
                    <span className="text-[10px] opacity-60">生成的图片会显示在这里</span>
                </div>
            )}
            {history.map((item) => {
              const statusInfo = getStatusDisplay(item)
              
              return (
              <div
                key={item.id}
                className={`flex-shrink-0 w-20 h-20 relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 group ${
                    item.status === 'pending' ? 'border-blue-500/50 ring-2 ring-blue-500/20' : 
                    item.status === 'failed' || errorIds.has(item.id) ? 'border-red-500/50' : 
                    'border-white/10 hover:border-white/30'
                }`}
                title={statusInfo?.fullText} 
                onClick={() => {
                  if (item.status === 'completed' || item.status === 'failed') {
                    onSelect(item)
                  }
                }}
              >
                {item.status === 'completed' && item.result_urls?.[0] ? (
                    <div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center">
                        <img 
                            src={item.result_urls[0]} 
                            alt="thumb" 
                            className="w-full h-full object-cover" 
                        />
                    </div>
                ) : (
                    <div className="w-full h-full bg-[#1e1e1e] flex flex-col items-center justify-center p-1">
                        {statusInfo ? (
                            <>
                                <div className={statusInfo.color}>{statusInfo.icon}</div>
                                <span className={`text-[10px] font-medium ${statusInfo.color} text-center leading-tight`}>
                                    {statusInfo.text}
                                </span>
                            </>
                        ) : (
                             <span className="text-[10px] text-gray-500">No Img</span>
                        )}
                    </div>
                )}
                
                {/* 遮罩层 (仅在有图片但非completed状态时显示，实际上上面的逻辑已经互斥了，这里主要为了防止边缘情况) */}
                {item.status !== 'completed' && (
                    <div className="absolute inset-0 bg-black/10"></div>
                )}
              </div>
            )})}
          </div>
        </div>

        {/* 刷新按钮 (左侧) */}
         <div className="pointer-events-auto absolute left-0 bottom-0">
             <button 
                onClick={handleRefresh}
                className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-3 text-gray-400 hover:text-white transition-colors hover:bg-black/60 ${isRefreshing ? 'animate-spin' : ''}`}
                title="刷新历史"
            >
                <RotateCw size={18} />
            </button>
         </div>

      </div>
    </div>
  )
}

