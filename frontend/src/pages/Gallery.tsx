import { useState, useEffect } from 'react'
import { Heart, Lock, Unlock, User, Sparkles, Filter, Clock, Flame, X, Zap, Trash2, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

interface GalleryItem {
  id: number
  user_id: number
  author_name: string
  type: string
  model: string
  width: number
  height: number
  price: number
  likes_count: number
  purchases_count: number
  result_urls: string[]
  shared_at: string
  is_owner: number
  is_unlocked: number
  is_liked: number
  prompt: string
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'latest' | 'popular' | 'my'>('latest')
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null)
  const { user, fetchUserInfo } = useAuthStore()
  const navigate = useNavigate()
  
  // 编辑费用状态
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null)
  const [newPrice, setNewPrice] = useState('')

  const fetchItems = async () => {
    try {
      setLoading(true)
      let url = '/gallery/list?page=1'
      
      if (activeTab === 'popular') {
        url += '&sort=popular'
      } else if (activeTab === 'my') {
        url += '&filter=my'
      }

      const res = await apiClient.get(url)
      setItems(res.data.items)
    } catch (error) {
      console.error('Fetch gallery error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [activeTab])

  const handleLike = async (e: React.MouseEvent, id: number, currentLiked: boolean) => {
    e.stopPropagation()
    try {
      // 乐观更新
      setItems(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            is_liked: currentLiked ? 0 : 1,
            likes_count: currentLiked ? item.likes_count - 1 : item.likes_count + 1
          }
        }
        return item
      }))
      
      if (selectedItem?.id === id) {
        setSelectedItem(prev => prev ? ({
            ...prev,
            is_liked: currentLiked ? 0 : 1,
            likes_count: currentLiked ? prev.likes_count - 1 : prev.likes_count + 1
        }) : null)
      }

      await apiClient.post('/gallery/like', { generationId: id })
    } catch (error) {
      console.error('Like error:', error)
      fetchItems() // 失败回滚
    }
  }

  const handleMakeSameStyle = async (item: GalleryItem) => {
    // 1. 如果是自己的作品或已解锁，直接跳转
    if (item.is_owner || item.is_unlocked || item.price === 0) {
      navigate('/', { 
        state: { 
          autofill: { 
            prompt: item.prompt, 
            model: item.model,
            width: item.width,
            height: item.height,
            type: item.type
          } 
        } 
      })
      return
    }

    // 2. 需要付费解锁
    if (item.price > (user?.points || 0)) {
      alert('积分不足，请先充值')
      return
    }

    if (!confirm(`做同款需解锁该画作提示词，确定支付 ${item.price} 积分吗？`)) {
      return
    }

    try {
      const res = await apiClient.post('/gallery/unlock', { generationId: item.id })
      if (res.data.success) {
        const fullPrompt = res.data.prompt
        
        // 更新本地状态
        const updateItem = (i: GalleryItem) => ({
            ...i,
            is_unlocked: 1,
            prompt: fullPrompt,
            purchases_count: i.purchases_count + 1
        })

        setItems(prev => prev.map(i => i.id === item.id ? updateItem(i) : i))
        if (selectedItem?.id === item.id) {
            setSelectedItem(prev => prev ? updateItem(prev) : null)
        }

        await fetchUserInfo() // 刷新积分
        
        // 跳转
        navigate('/', { 
            state: { 
              autofill: { 
                prompt: fullPrompt, 
                model: item.model,
                width: item.width,
                height: item.height,
                type: item.type
              } 
            } 
          })
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '解锁失败')
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确定要删除/取消分享这张图片吗？')) return

    try {
      await apiClient.delete(`/gallery/${id}`)
      setItems(prev => prev.filter(item => item.id !== id))
      if (selectedItem?.id === id) setSelectedItem(null)
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败')
    }
  }

  const handleUpdatePrice = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    const price = parseFloat(newPrice)
    if (isNaN(price) || price < 0) {
        alert('请输入有效的价格')
        return
    }

    try {
        await apiClient.post('/gallery/share', { 
            generationId: id, 
            price 
        })
        // 更新本地状态
        setItems(prev => prev.map(item => item.id === id ? { ...item, price } : item))
        setEditingPriceId(null)
        setNewPrice('')
        alert('价格更新成功')
    } catch (error: any) {
        alert(error.response?.data?.error || '更新失败')
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-white px-4 md:px-8 pt-20 md:pt-32 pb-24">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 sticky top-[70px] z-30 py-4 bg-gradient-to-b from-black/80 via-black/50 to-transparent backdrop-blur-sm -mx-4 px-4 md:mx-0 md:px-0 md:bg-none md:backdrop-blur-none md:static">
          <div className="pt-2">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
              灵感社区
            </h1>
            <p className="text-gray-400">探索 AI 艺术创作，获取无限灵感</p>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/5 p-1 rounded-xl backdrop-blur-sm border border-white/10">
            <button
              onClick={() => setActiveTab('latest')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'latest' 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={16} />
              <span>最新</span>
            </button>
            <button
              onClick={() => setActiveTab('popular')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'popular' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame size={16} />
              <span>热门</span>
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'my' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <User size={16} />
              <span>我的</span>
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Filter size={48} className="mx-auto mb-4 opacity-50" />
            <p>暂无内容，快去生成第一张图片并分享吧！</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
            {items.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className="break-inside-avoid bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/30 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] group cursor-pointer backdrop-blur-sm"
              >
                {/* Image */}
                <div className="relative aspect-auto">
                  <img 
                    src={item.result_urls[0]} 
                    alt="AI Generated" 
                    className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Overlay Info - Desktop only hover, Mobile always visible or specific trigger */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <User size={14} />
                        <span>{item.author_name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Prompt Preview (Truncated) */}
                  <div className="bg-black/30 rounded-lg p-3 relative group/prompt">
                    <div className="flex items-start gap-2">
                      <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
                      <p className={`text-sm line-clamp-2 ${item.is_unlocked || item.is_owner ? 'text-gray-300' : 'text-gray-500 blur-sm select-none'}`}>
                        {item.prompt}
                      </p>
                    </div>
                  </div>

                  {/* Actions - Mobile Optimized Layout */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => handleLike(e, item.id, !!item.is_liked)}
                            className={`flex items-center gap-1.5 text-xs md:text-sm transition-colors ${
                              item.is_liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-400'
                            }`}
                          >
                            <Heart size={16} fill={item.is_liked ? "currentColor" : "none"} />
                            <span>{item.likes_count}</span>
                          </button>
                          <div className="flex items-center gap-1.5 text-xs md:text-sm text-gray-500">
                            <Unlock size={14} />
                            <span>{item.purchases_count}</span>
                          </div>
                        </div>

                        {/* Quick Make Same Style Button */}
                        <div className="flex items-center gap-2">
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation()
                                  handleMakeSameStyle(item)
                              }}
                              className="text-xs flex items-center gap-1 bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-600/30 transition-colors font-medium whitespace-nowrap"
                          >
                              <Zap size={12} />
                              做同款
                          </button>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Image Detail Modal - 移动端全屏，桌面端弹窗 */}
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center md:bg-black/90 md:backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
            <div className="bg-[#121212] w-full h-full md:max-w-6xl md:h-[90vh] md:rounded-2xl border-none md:border border-white/10 overflow-hidden flex flex-col md:flex-row relative shadow-2xl">
              {/* Close Button */}
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 z-20 text-white/70 hover:text-white bg-black/50 p-2 rounded-full backdrop-blur-md transition-colors"
              >
                <X size={24} />
              </button>

              {/* Left: Image View */}
              <div className="flex-1 bg-black flex items-center justify-center p-0 md:p-4 relative group overflow-hidden">
                <img 
                  src={selectedItem.result_urls[0]} 
                  alt="Detail" 
                  className="w-full h-full object-contain md:shadow-2xl"
                />
              </div>

              {/* Right: Info & Actions */}
              <div className="w-full md:w-[400px] flex flex-col border-t md:border-t-0 md:border-l border-white/10 bg-[#1a1a1a] max-h-[50vh] md:max-h-full overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {selectedItem.author_name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{selectedItem.author_name}</h3>
                      <p className="text-xs text-gray-400">
                        发布于 {new Date(selectedItem.shared_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 text-sm text-gray-400">
                     <div className="flex flex-col">
                        <span className="text-xs opacity-50">模型</span>
                        <span className="text-white">{selectedItem.model}</span>
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs opacity-50">尺寸</span>
                        <span className="text-white">{selectedItem.width}x{selectedItem.height}</span>
                     </div>
                  </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                   <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                     <Sparkles size={16} className="text-purple-400" />
                     提示词
                   </h4>
                   <div className={`bg-black/30 p-4 rounded-xl text-sm leading-relaxed border border-white/5 ${selectedItem.is_unlocked || selectedItem.is_owner ? 'text-gray-300' : 'text-gray-500 blur-sm select-none relative overflow-hidden'}`}>
                      {selectedItem.prompt}
                      
                      {/* Unlock Overlay in Modal */}
                      {!(selectedItem.is_unlocked || selectedItem.is_owner) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/5 backdrop-blur-[2px]">
                           <Lock size={24} className="text-gray-400 mb-2" />
                           <p className="text-gray-300 font-medium mb-1">内容已隐藏</p>
                           <p className="text-xs text-gray-500">支付积分查看完整提示词并做同款</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-6 border-t border-white/10 space-y-3 bg-[#1e1e1e]">
                   {selectedItem.is_owner === 1 ? (
                       /* Owner Actions Layout */
                       <div className="flex gap-3">
                           <button 
                             onClick={() => handleMakeSameStyle(selectedItem)}
                             className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-medium shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                             <Zap size={20} />
                             去做同款
                           </button>

                           {editingPriceId === selectedItem.id ? (
                                <div className="flex-1 flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="relative flex-1">
                                        <input 
                                        type="number" 
                                        value={newPrice}
                                        onChange={e => setNewPrice(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors h-full"
                                        placeholder="价格"
                                        autoFocus
                                        />
                                    </div>
                                    <button 
                                        onClick={(e) => handleUpdatePrice(e, selectedItem.id)}
                                        className="px-3 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-600/30 transition-colors"
                                    >
                                        OK
                                    </button>
                                    <button 
                                        onClick={() => setEditingPriceId(null)}
                                        className="px-3 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
                                    >
                                        X
                                    </button>
                                </div>
                            ) : (
                               <button 
                                   onClick={() => {
                                       setEditingPriceId(selectedItem.id)
                                       setNewPrice(selectedItem.price.toString())
                                   }}
                                   className="flex-1 py-3.5 border border-white/10 hover:bg-white/5 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                               >
                                   <Settings size={20} />
                                   设价: {selectedItem.price}
                               </button>
                           )}
                       </div>
                   ) : (
                       /* Non-Owner Actions Layout */
                       <>
                           <button 
                             onClick={() => handleMakeSameStyle(selectedItem)}
                             className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-medium shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                             {selectedItem.is_unlocked || selectedItem.price === 0 ? (
                                <>
                                  <Zap size={20} />
                                  去做同款 (免费)
                                </>
                             ) : (
                                <>
                                  <Lock size={20} />
                                  支付 {selectedItem.price} 积分做同款
                                </>
                             )}
                           </button>

                           <div className="flex gap-3">
                              <button 
                                onClick={(e) => handleLike(e, selectedItem.id, !!selectedItem.is_liked)}
                                className={`flex-1 py-3 rounded-xl border font-medium flex items-center justify-center gap-2 transition-colors ${
                                  selectedItem.is_liked 
                                    ? 'border-pink-500/50 bg-pink-500/10 text-pink-500' 
                                    : 'border-white/10 hover:bg-white/5 text-gray-300'
                                }`}
                              >
                                 <Heart size={18} fill={selectedItem.is_liked ? "currentColor" : "none"} />
                                 {selectedItem.is_liked ? '已点赞' : '点赞'}
                              </button>
                           </div>
                       </>
                   )}
                   
                   {/* Owner Delete Option (Subtle) */}
                   {selectedItem.is_owner === 1 && editingPriceId !== selectedItem.id && (
                       <button 
                          onClick={(e) => handleDelete(e, selectedItem.id)}
                          className="w-full py-2 text-red-400/70 hover:text-red-400 text-xs flex items-center justify-center gap-1 transition-colors mt-2"
                       >
                          <Trash2 size={12} />
                          删除此分享
                       </button>
                   )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
