import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useGenerationStore } from '../store/generationStore'
import GeneratePanel from '../components/GeneratePanel'
import PreviewArea from '../components/PreviewArea'
import HistoryPanel from '../components/HistoryPanel'
import apiClient from '../api/client'
import { Edit3, Image, Clock } from 'lucide-react'

export default function Home() {
  const location = useLocation()
  const initialData = location.state?.autofill
  const { fetchUserInfo } = useAuthStore()
  const { 
    history: generationHistory, 
    setHistory: setGenerationHistory,
    isLoaded,
    setIsLoaded,
    lastFetchTime,
    setLastFetchTime
  } = useGenerationStore()
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [selectedGenerationId, setSelectedGenerationId] = useState<number | null>(null)
  
  // 移动端 Tab 状态: 'create' | 'preview' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'preview' | 'history'>('create')

  useEffect(() => {
    fetchUserInfo()
    loadHistory()
  }, [])

  const loadHistory = async (force: boolean = false) => {
    // 缓存策略：如果已加载且距离上次加载小于 10 秒，且非强制刷新，则跳过
    // 这样可以避免在 Tab 切换时频繁请求导致的闪烁
    const now = Date.now()
    if (!force && isLoaded && (now - lastFetchTime < 10000)) {
        return
    }

    try {
      const response = await apiClient.get('/generation/history?limit=20')
      setGenerationHistory(response.data.generations || [])
      setIsLoaded(true)
      setLastFetchTime(now)
      // 刷新用户信息以同步积分（特别是任务完成或失败退款后）
      fetchUserInfo()
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  const handleItemSelect = (item: any) => {
      setSelectedGenerationId(item.id)
      if (item.status === 'completed' && item.result_urls) {
          setPreviewImages(item.result_urls)
      } else {
          setPreviewImages([])
      }
  }

  const handleDelete = async () => {
      if (!selectedGenerationId) return
      if (!confirm('确定要删除这条生成记录吗？')) return
      
      try {
          await apiClient.delete(`/generation/${selectedGenerationId}`)
          // 本地移除，避免重新请求
          setGenerationHistory(prev => prev.filter(g => g.id !== selectedGenerationId))
          // 清空预览
          setPreviewImages([])
          setSelectedGenerationId(null)
          // 刷新用户信息（以防万一有状态变动）
          fetchUserInfo()
      } catch (error: any) {
          console.error('删除失败:', error)
          alert(error.response?.data?.error || '删除失败')
      }
  }

  const handleShare = async () => {
    if (!selectedGenerationId) return
    const priceStr = prompt('请输入分享价格（积分，0为免费）：', '0')
    if (priceStr === null) return // Cancelled
    
    const price = parseFloat(priceStr)
    if (isNaN(price) || price < 0) {
        alert('请输入有效的价格')
        return
    }

    try {
        await apiClient.post('/gallery/share', { 
            generationId: selectedGenerationId, 
            price 
        })
        alert('分享成功！已发布到灵感社区')
    } catch (error: any) {
        console.error('分享失败:', error)
        alert(error.response?.data?.error || '分享失败')
    }
  }

  const handleGenerate = async (generationData: any) => {
    // 乐观更新：根据数量创建多个临时项
    const quantity = generationData.quantity || 1
    const tempItems: any[] = []
    const now = Date.now()
    
    for (let i = 0; i < quantity; i++) {
        tempItems.push({
            id: now + i,
            status: 'pending',
            progress: 0,
            prompt: generationData.prompt,
            model: generationData.model,
            created_at: new Date().toISOString(),
            isTemp: true
        })
    }
    
    setGenerationHistory(prev => [...tempItems, ...prev])
    
    // 移动端：立即跳转到预览 Tab 并选中第一个临时项，以展示生图动画
    if (tempItems.length > 0) {
        setSelectedGenerationId(tempItems[0].id)
        setActiveTab('preview')
    }

    try {
      const response = await apiClient.post('/generation/create', generationData)
      
      const realIds = response.data.generationIds || []
      
      // 更新本地临时项的 ID，防止 flicker
      if (realIds.length > 0) {
           setGenerationHistory(prev => {
               const newHistory = [...prev]
               // 假设服务器返回的 ID 顺序与 tempItems 一致
               tempItems.forEach((temp, idx) => {
                   if (realIds[idx]) {
                       const index = newHistory.findIndex(h => h.id === temp.id)
                       if (index !== -1) {
                           newHistory[index] = { ...newHistory[index], id: realIds[idx] }
                       }
                   }
               })
               return newHistory
           })
           // 更新当前选中的 ID 为真实 ID
           setSelectedGenerationId(realIds[0])
      }

      // 请求成功后，刷新列表以获取真实数据
      await loadHistory(true)
      fetchUserInfo()
      
      if (realIds.length > 0) {
        // 确保移动端停留在预览 Tab (之前已经设置过，这里再次确认)
        setActiveTab('preview')
      }
    } catch (error: any) {
      // 失败时移除临时项
      setGenerationHistory(prev => prev.filter(item => !tempItems.some(t => t.id === item.id)))
      alert(error.response?.data?.error || '生成失败')
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-transparent overflow-hidden text-white relative">
      
      {/* 移动端顶部 Header (占位符，因为Header是Fixed) */}
      <div className="md:hidden h-[60px] shrink-0" />

      {/* 移动端内容区域 (带 Tab 切换) */}
      <div className="md:hidden flex-1 relative overflow-hidden bg-transparent">
        {activeTab === 'create' && (
          <div className="absolute inset-0 overflow-y-auto pb-20">
            <GeneratePanel onGenerate={handleGenerate} initialData={initialData} />
          </div>
        )}
        
        {activeTab === 'preview' && (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 relative">
                <PreviewArea 
                    images={previewImages} 
                    onDelete={selectedGenerationId ? handleDelete : undefined}
                    onShare={generationHistory.find(g => g.id === selectedGenerationId)?.status === 'completed' ? handleShare : undefined}
                    status={generationHistory.find(g => g.id === selectedGenerationId)?.status}
                    error={generationHistory.find(g => g.id === selectedGenerationId)?.error_message}
                    prompt={generationHistory.find(g => g.id === selectedGenerationId)?.prompt}
                />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="absolute inset-0 bg-[#121212]">
            <HistoryPanel 
                history={generationHistory} 
                onSelect={(item) => {
                    handleItemSelect(item)
                    // 选择后跳转预览
                    setActiveTab('preview')
                }}
                onRefresh={() => loadHistory(true)}
                viewMode="full"
            />
          </div>
        )}
      </div>

      {/* 移动端底部 Tab 栏 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-[#121212]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <button 
            onClick={() => setActiveTab('create')}
            className="flex flex-col items-center justify-center space-y-1 w-full h-full relative group"
        >
            <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'create' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
               <Edit3 size={22} />
            </div>
            <span className={`text-[10px] font-medium transition-colors ${activeTab === 'create' ? 'text-blue-400' : 'text-gray-500'}`}>创作</span>
            {activeTab === 'create' && <div className="absolute top-0 w-12 h-1 bg-blue-500 rounded-b-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />}
        </button>
        <button 
            onClick={() => setActiveTab('preview')}
            className="flex flex-col items-center justify-center space-y-1 w-full h-full relative group"
        >
            <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'preview' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
               <Image size={22} />
            </div>
            <span className={`text-[10px] font-medium transition-colors ${activeTab === 'preview' ? 'text-purple-400' : 'text-gray-500'}`}>预览</span>
            {activeTab === 'preview' && <div className="absolute top-0 w-12 h-1 bg-purple-500 rounded-b-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />}
        </button>
        <button 
            onClick={() => setActiveTab('history')}
            className="flex flex-col items-center justify-center space-y-1 w-full h-full relative group"
        >
            <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'history' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
               <Clock size={22} />
            </div>
            <span className={`text-[10px] font-medium transition-colors ${activeTab === 'history' ? 'text-green-400' : 'text-gray-500'}`}>历史</span>
            {activeTab === 'history' && <div className="absolute top-0 w-12 h-1 bg-green-500 rounded-b-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />}
        </button>
      </div>

      {/* 桌面端布局 (保持不变) */}
      {/* 左侧边栏，固定宽度 */}
      <div className="hidden md:block flex-none h-full w-[380px] relative z-30 border-r border-white/5 bg-black/40 backdrop-blur-xl pt-[60px]">
        <GeneratePanel
          onGenerate={handleGenerate}
          initialData={initialData}
        />
      </div>

      {/* 右侧主内容区 */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 h-full relative pt-[60px]">
        {/* 桌面端 Header (已改为 Fixed 全局 Header，此处只需占位或不需要) */}
        
        {/* 预览区域 */}
        <div className="flex-1 relative overflow-hidden min-h-0 flex flex-col">
            <div className="flex-1 relative min-h-0">
                <PreviewArea 
                    images={previewImages} 
                    onDelete={selectedGenerationId ? handleDelete : undefined}
                    onShare={generationHistory.find(g => g.id === selectedGenerationId)?.status === 'completed' ? handleShare : undefined}
                    status={generationHistory.find(g => g.id === selectedGenerationId)?.status}
                    error={generationHistory.find(g => g.id === selectedGenerationId)?.error_message}
                    prompt={generationHistory.find(g => g.id === selectedGenerationId)?.prompt}
                />
            </div>
            
            {/* 历史记录 - 桌面端悬浮 */}
            <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none bg-black/40 border-t border-white/10">
                <HistoryPanel 
                  history={generationHistory} 
                  onSelect={handleItemSelect}
                  onRefresh={() => loadHistory(true)} 
                />
            </div>
        </div>
      </div>
    </div>
  )
}
