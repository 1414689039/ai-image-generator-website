import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import Header from '../components/Header'
import GeneratePanel from '../components/GeneratePanel'
import PreviewArea from '../components/PreviewArea'
import HistoryPanel from '../components/HistoryPanel'
import apiClient from '../api/client'

export default function Home() {
  const { user, fetchUserInfo } = useAuthStore()
  const [selectedTab, setSelectedTab] = useState<'image' | 'video'>('image')
  const [generationHistory, setGenerationHistory] = useState<any[]>([])
  const [previewImages, setPreviewImages] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      fetchUserInfo()
      loadHistory()
    }
  }, [])

  const loadHistory = async () => {
    try {
      const response = await apiClient.get('/generation/history?limit=10')
      setGenerationHistory(response.data.generations || [])
    } catch (error) {
      console.error('加载历史记录失败:', error)
    }
  }

  const handleGenerate = async (generationData: any) => {
    try {
      const response = await apiClient.post('/generation/create', generationData)
      if (response.data.images) {
        setPreviewImages(response.data.images)
        loadHistory() // 刷新历史记录
        fetchUserInfo() // 刷新用户信息（积分余额）
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '生成失败')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧生成面板 */}
          <div className="lg:col-span-1">
            <GeneratePanel
              selectedTab={selectedTab}
              onTabChange={setSelectedTab}
              onGenerate={handleGenerate}
            />
          </div>

          {/* 右侧预览和历史 */}
          <div className="lg:col-span-2 space-y-6">
            <PreviewArea images={previewImages} />
            <HistoryPanel history={generationHistory} onImageClick={setPreviewImages} />
          </div>
        </div>
      </div>
    </div>
  )
}

