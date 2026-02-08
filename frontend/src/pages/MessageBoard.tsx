import { useState, useEffect } from 'react'
import { MessageSquare, Plus, User, Trash2, X, Send, Crown, Clock } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Reply {
  id: number
  message_id: number
  user_id: number
  content: string
  is_admin_reply: number
  created_at: string
  author_name: string
}

interface Message {
  id: number
  user_id: number
  title: string
  content: string
  created_at: string
  author_name: string
  reply_count: number
  last_reply_at: string | null
}

export default function MessageBoard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Detail Modal
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyContent, setReplyContent] = useState('')
  const [loadingDetails, setLoadingDetails] = useState(false)

  const { user } = useAuthStore()

  const fetchMessages = async (pageNum = 1, append = false) => {
    try {
      setLoading(true)
      const res = await apiClient.get(`/message?page=${pageNum}`)
      const newItems = res.data.items || []
      
      if (append) {
        setMessages(prev => [...prev, ...newItems])
      } else {
        setMessages(newItems)
      }
      setHasMore(newItems.length === 20) // Assuming limit is 20
      setPage(pageNum)
    } catch (error) {
      console.error('Fetch messages error:', error)
      if (!append) setMessages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) return

    try {
      setSubmitting(true)
      await apiClient.post('/message', {
        title: newTitle,
        content: newContent
      })
      setShowCreateModal(false)
      setNewTitle('')
      setNewContent('')
      fetchMessages(1) // Refresh list
      alert('发布成功')
    } catch (error: any) {
      alert(error.response?.data?.error || '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenDetail = async (msg: Message) => {
    setSelectedMessage(msg)
    setLoadingDetails(true)
    setReplies([]) // Clear previous replies
    try {
      const res = await apiClient.get(`/message/${msg.id}`)
      setReplies(res.data.replies || [])
    } catch (error) {
      console.error('Fetch detail error:', error)
      setReplies([])
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMessage || !replyContent.trim()) return

    try {
      setSubmitting(true)
      await apiClient.post(`/message/${selectedMessage.id}/reply`, {
        content: replyContent
      })
      setReplyContent('')
      // Refresh replies
      const res = await apiClient.get(`/message/${selectedMessage.id}`)
      setReplies(res.data.replies || [])
      
      // Update list to reflect new reply count/time
      setMessages(prev => prev.map(m => {
        if (m.id === selectedMessage.id) {
            return {
                ...m,
                reply_count: m.reply_count + 1,
                last_reply_at: new Date().toISOString() // Approximate
            }
        }
        return m
      }))
    } catch (error: any) {
      alert(error.response?.data?.error || '回复失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMessage = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确定要删除这条留言吗？')) return

    try {
      await apiClient.delete(`/message/${id}`)
      setMessages(prev => prev.filter(m => m.id !== id))
      if (selectedMessage?.id === id) setSelectedMessage(null)
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败')
    }
  }

  const handleDeleteReply = async (id: number) => {
    if (!confirm('确定要删除这条回复吗？')) return

    try {
      await apiClient.delete(`/message/reply/${id}`)
      setReplies(prev => prev.filter(r => r.id !== id))
    } catch (error: any) {
      alert(error.response?.data?.error || '删除失败')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 md:px-8 pt-20 md:pt-32 pb-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 mb-2">
              留言板
            </h1>
            <p className="text-gray-400">分享你的想法，与大家交流</p>
          </div>
          <button
            onClick={() => {
                if (!user) {
                    alert('请先登录')
                    return
                }
                setShowCreateModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            <span>发布留言</span>
          </button>
        </div>

        {/* Message List */}
        <div className="space-y-4">
          {messages?.map(msg => (
            <div 
              key={msg.id}
              onClick={() => handleOpenDetail(msg)}
              className="bg-[#1e1e1e] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-medium text-white group-hover:text-blue-400 transition-colors">
                  {msg.title}
                </h3>
                {(user?.isAdmin || user?.id === msg.user_id) && (
                  <button 
                    onClick={(e) => handleDeleteMessage(e, msg.id)}
                    className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <p className="text-gray-400 line-clamp-2 mb-4 text-sm">
                {msg.content}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <User size={14} />
                    <span>{msg.author_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded">
                  <MessageSquare size={14} />
                  <span>{msg.reply_count} 回复</span>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {!loading && hasMore && (
            <div className="text-center pt-4">
              <button 
                onClick={() => fetchMessages(page + 1, true)}
                className="text-gray-400 hover:text-white text-sm"
              >
                加载更多
              </button>
            </div>
          )}

            {!loading && messages?.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>暂无留言，快来抢沙发！</p>
                </div>
            )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">发布新留言</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="标题"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                    maxLength={100}
                    required
                  />
                </div>
                <div>
                  <textarea
                    placeholder="内容..."
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 h-32 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                    maxLength={1000}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? '发布中...' : '发布'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] w-full max-w-4xl h-[85vh] rounded-2xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-start bg-[#1a1a1a]">
                <div>
                    <h2 className="text-2xl font-bold mb-2">{selectedMessage.title}</h2>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5"><User size={14}/> {selectedMessage.author_name}</span>
                        <span className="flex items-center gap-1.5"><Clock size={14}/> {new Date(selectedMessage.created_at).toLocaleString()}</span>
                    </div>
                </div>
                <button onClick={() => setSelectedMessage(null)} className="text-gray-400 hover:text-white p-2">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Main Content */}
                <div className="text-gray-200 leading-relaxed whitespace-pre-wrap text-lg">
                    {selectedMessage.content}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10 w-full"></div>

                {/* Replies */}
                <div className="space-y-6">
                    <h3 className="font-medium text-gray-400 flex items-center gap-2">
                        <MessageSquare size={16} />
                        共 {replies?.length || 0} 条回复
                    </h3>
                    
                    {loadingDetails ? (
                        <div className="text-center py-4 text-gray-500">加载中...</div>
                    ) : replies?.length === 0 ? (
                        <div className="text-center py-8 text-gray-600 bg-white/5 rounded-xl">
                            沙发空缺中，快来评论吧
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {replies?.map(reply => (
                                <div key={reply.id} className={`p-4 rounded-xl border ${reply.is_admin_reply ? 'bg-blue-500/10 border-blue-500/30' : 'bg-black/30 border-white/5'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium ${reply.is_admin_reply ? 'text-blue-400 flex items-center gap-1' : 'text-gray-300'}`}>
                                                {reply.author_name}
                                                {reply.is_admin_reply === 1 && <Crown size={12} />}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(reply.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        {(user?.isAdmin || user?.id === reply.user_id) && (
                                            <button 
                                                onClick={() => handleDeleteReply(reply.id)}
                                                className="text-gray-600 hover:text-red-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="text-gray-300 whitespace-pre-wrap">
                                        {reply.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>

              {/* Reply Input Area */}
              <div className="p-4 border-t border-white/10 bg-[#1a1a1a]">
                 {user ? (
                    <form onSubmit={handleReply} className="relative">
                        <input
                            type="text"
                            value={replyContent}
                            onChange={e => setReplyContent(e.target.value)}
                            placeholder="发表你的评论..."
                            className="w-full bg-black/30 border border-white/10 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                            disabled={submitting}
                        />
                        <button 
                            type="submit" 
                            disabled={submitting || !replyContent.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                 ) : (
                    <div className="text-center py-2 text-gray-500 text-sm">
                        请 <button onClick={() => { setSelectedMessage(null); window.location.href='/login' }} className="text-blue-400 hover:underline">登录</button> 后参与讨论
                    </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
