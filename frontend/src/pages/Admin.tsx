import { useState, useEffect } from 'react'
import apiClient from '../api/client'
import { Trash2, Save, Plus, X } from 'lucide-react'

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'orders' | 'generations' | 'settings'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [generations, setGenerations] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [pointRules, setPointRules] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [config, setConfig] = useState<any>({})
  
  // 筛选状态
  const [genUserIdFilter, setGenUserIdFilter] = useState('') // 生效的筛选ID
  const [genUserIdInput, setGenUserIdInput] = useState('')   // 输入框的临时ID
  const [genPage, setGenPage] = useState(1)
  const [genTotal, setGenTotal] = useState(0)
  const GEN_LIMIT = 20

  // 弹窗状态
  const [pointsModal, setPointsModal] = useState<{ show: boolean, userId: number, username: string }>({ show: false, userId: 0, username: '' })
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsDesc, setPointsDesc] = useState('')

  useEffect(() => {
    // 切换 tab 或筛选条件变化时，重置页码为 1
    if (activeTab === 'generations') {
        setGenPage(1)
    }
    loadData()
  }, [activeTab, genUserIdFilter])

  // 监听页码变化单独加载
  useEffect(() => {
    if (activeTab === 'generations') {
        loadData()
    }
  }, [genPage])

  const loadData = async () => {
    try {
      switch (activeTab) {
        case 'users':
          const usersRes = await apiClient.get('/admin/users')
          setUsers(usersRes.data.users || [])
          break
        case 'orders':
          const ordersRes = await apiClient.get('/admin/orders')
          setOrders(ordersRes.data.orders || [])
          break
        case 'generations':
          const genRes = await apiClient.get(`/admin/generations?page=${genPage}&limit=${GEN_LIMIT}${genUserIdFilter ? `&userId=${genUserIdFilter}` : ''}`)
          setGenerations(genRes.data.generations || [])
          setGenTotal(genRes.data.total || 0)
          break
        case 'settings':
          const [keysRes, rulesRes, statsRes, configRes] = await Promise.all([
            apiClient.get('/admin/api-keys'),
            apiClient.get('/admin/point-rules'),
            apiClient.get('/admin/stats'),
            apiClient.get('/admin/config'),
          ])
          setApiKeys(keysRes.data.apiKeys || [])
          setPointRules(rulesRes.data.rules || [])
          setStats(statsRes.data || {})
          setConfig(configRes.data.config || {})
          break
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  // 用户相关操作
  const handleDeleteUser = async (id: number) => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复，将删除该用户的所有数据！')) return
    try {
        await apiClient.delete(`/admin/users/${id}`)
        setUsers(users.filter(u => u.id !== id))
        alert('删除成功')
    } catch (e) {
        alert('删除失败')
    }
  }

  const handleAdjustPoints = async () => {
    try {
        await apiClient.post(`/admin/users/${pointsModal.userId}/points`, {
            amount: parseFloat(pointsAmount),
            description: pointsDesc || undefined
        })
        setPointsModal({ ...pointsModal, show: false })
        setPointsAmount('')
        setPointsDesc('')
        loadData() // 刷新列表
        alert('积分调整成功')
    } catch (e) {
        alert('调整失败')
    }
  }

  // 生成记录操作
  const handleDeleteGeneration = async (id: number) => {
    if (!confirm('确定要删除这条记录吗？如果是分享的图片，将从社区下架。')) return
    try {
        await apiClient.delete(`/admin/generations/${id}`)
        setGenerations(generations.filter(g => g.id !== id))
    } catch (e) {
        alert('删除失败')
    }
  }

  // 配置操作
  const handleSaveConfig = async (key: string, value: string) => {
      try {
          await apiClient.post('/admin/config', { [key]: value })
          setConfig({ ...config, [key]: value })
          alert('保存成功')
      } catch (e) {
          alert('保存失败')
      }
  }

  return (
    <div className="min-h-screen bg-transparent pt-20 pb-10">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-6 text-white">管理员面板</h1>

        {/* 标签页 */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg mb-6">
          <div className="flex border-b border-white/10 overflow-x-auto">
            {[
              { key: 'users', label: '用户管理' },
              { key: 'orders', label: '订单查询' },
              { key: 'generations', label: '生成记录' },
              { key: 'settings', label: '系统配置' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-500 text-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg p-6 text-white min-h-[500px]">
          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">用户列表</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">用户名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">邮箱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">积分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{user.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-300">{user.points.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {user.isAdmin ? <span className="text-purple-400 font-bold">管理员</span> : '用户'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                          <button 
                            onClick={() => setPointsModal({ show: true, userId: user.id, username: user.username })}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            调整积分
                          </button>
                          {!user.isAdmin && (
                              <button 
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-500 hover:text-red-400 transition-colors"
                              >
                                删除
                              </button>
                          )}
                          <button 
                            onClick={() => {
                                setGenUserIdInput(user.id.toString())
                                setGenUserIdFilter(user.id.toString())
                                setActiveTab('generations')
                            }}
                            className="text-green-400 hover:text-green-300 transition-colors"
                          >
                            查看图片
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">订单列表</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">订单号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">金额</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">积分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{order.orderNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{order.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">¥{order.amount.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{order.points.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {order.paymentStatus === 'paid' ? '已支付' : '待支付'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'generations' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">生成记录</h2>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="输入用户ID筛选" 
                        className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-sm text-white"
                        value={genUserIdInput}
                        onChange={(e) => setGenUserIdInput(e.target.value)}
                      />
                      <button 
                        onClick={() => setGenUserIdFilter(genUserIdInput)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-500"
                      >
                        筛选
                      </button>
                      {genUserIdFilter && (
                          <button 
                            onClick={() => {
                                setGenUserIdInput('')
                                setGenUserIdFilter('')
                            }}
                            className="bg-white/10 text-white px-3 py-1.5 rounded text-sm hover:bg-white/20"
                          >
                            重置
                          </button>
                      )}
                  </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">预览</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">提示词</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">模型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {generations.map((gen) => (
                      <tr key={gen.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{gen.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{gen.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            {gen.result_urls && gen.result_urls.length > 0 ? (
                                <a href={gen.result_urls[0]} target="_blank" rel="noopener noreferrer" className="block w-12 h-12 rounded overflow-hidden border border-white/10 hover:border-blue-500 transition-colors">
                                    <img src={gen.result_urls[0]} alt="Thumbnail" className="w-full h-full object-cover" />
                                </a>
                            ) : (
                                <span className="text-gray-600 text-xs">无图片</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-sm max-w-xs truncate" title={gen.prompt}>{gen.prompt}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{gen.model}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${
                            gen.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                            gen.status === 'failed' ? 'bg-red-500/20 text-red-400' : 
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {gen.status === 'completed' ? '已完成' : 
                             gen.status === 'failed' ? '失败' : '处理中'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button 
                                onClick={() => handleDeleteGeneration(gen.id)}
                                className="text-red-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
                  <div>
                      共 {genTotal} 条记录，当前第 {genPage} 页
                  </div>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setGenPage(p => Math.max(1, p - 1))}
                        disabled={genPage === 1}
                        className="px-3 py-1 bg-white/5 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一页
                      </button>
                      <button 
                        onClick={() => setGenPage(p => p + 1)}
                        disabled={genPage * GEN_LIMIT >= genTotal}
                        className="px-3 py-1 bg-white/5 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页
                      </button>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              {/* 系统维护开关 */}
              <div>
                <h2 className="text-xl font-semibold mb-4">系统维护</h2>
                <div className="bg-black/20 p-6 rounded-lg border border-white/10 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-white mb-1">维护模式</h3>
                        <p className="text-sm text-gray-400">开启后，除管理员外的所有用户将无法访问网站功能（显示维护中页面）。</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm ${config.maintenance_mode === 'true' ? 'text-red-400' : 'text-green-400'}`}>
                            {config.maintenance_mode === 'true' ? '维护中' : '正常运行'}
                        </span>
                        <button 
                            onClick={() => handleSaveConfig('maintenance_mode', config.maintenance_mode === 'true' ? 'false' : 'true')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black ${
                                config.maintenance_mode === 'true' ? 'bg-red-500' : 'bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    config.maintenance_mode === 'true' ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">联系客服信息配置</h2>
                <div className="bg-black/20 p-4 rounded-lg border border-white/10">
                    <p className="text-sm text-gray-400 mb-2">这段文字将展示在用户点击“联系客服”后的弹窗中。</p>
                    <textarea 
                        className="w-full h-32 bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                        value={config.contact_us_info || ''}
                        onChange={(e) => setConfig({ ...config, contact_us_info: e.target.value })}
                        placeholder="请输入联系方式，例如：客服微信 xxx，邮箱 xxx..."
                    />
                    <div className="mt-3 flex justify-end">
                        <button 
                            onClick={() => handleSaveConfig('contact_us_info', config.contact_us_info)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors flex items-center"
                        >
                            <Save size={16} className="mr-2" />
                            保存配置
                        </button>
                    </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">系统统计 (财务看板)</h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white/5 p-4 rounded border border-white/10">
                    <p className="text-sm text-gray-400">总用户数</p>
                    <p className="text-2xl font-bold">{stats.totalUsers || 0}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded border border-white/10">
                    <p className="text-sm text-gray-400">总收入 (CNY)</p>
                    <p className="text-2xl font-bold text-green-400">¥{stats.totalRevenue?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded border border-white/10">
                    <p className="text-sm text-gray-400">总成本 (USD)</p>
                    <p className="text-2xl font-bold text-red-400">${stats.totalCost?.toFixed(4) || '0.0000'}</p>
                    <p className="text-xs text-gray-500 mt-1">≈ ¥{((stats.totalCost || 0) * 7.2).toFixed(2)}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded border border-white/10">
                    <p className="text-sm text-gray-400">毛利润 (预估)</p>
                    <p className="text-2xl font-bold text-blue-400">
                        ¥{((stats.totalRevenue || 0) - (stats.totalCost || 0) * 7.2).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">定价管理 (积分消耗)</h2>
                <div className="bg-black/20 p-6 rounded-lg border border-white/10 grid grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">1K 分辨率 (积分)</label>
                        <input 
                            type="number"
                            value={config.price_1k || ''}
                            onChange={(e) => setConfig({ ...config, price_1k: e.target.value })}
                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-white"
                        />
                        <button 
                            onClick={() => handleSaveConfig('price_1k', config.price_1k)}
                            className="mt-2 w-full bg-white/10 hover:bg-white/20 text-xs py-1.5 rounded transition-colors"
                        >
                            保存
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">2K 分辨率 (积分)</label>
                        <input 
                            type="number"
                            value={config.price_2k || ''}
                            onChange={(e) => setConfig({ ...config, price_2k: e.target.value })}
                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-white"
                        />
                        <button 
                            onClick={() => handleSaveConfig('price_2k', config.price_2k)}
                            className="mt-2 w-full bg-white/10 hover:bg-white/20 text-xs py-1.5 rounded transition-colors"
                        >
                            保存
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">4K 分辨率 (积分)</label>
                        <input 
                            type="number"
                            value={config.price_4k || ''}
                            onChange={(e) => setConfig({ ...config, price_4k: e.target.value })}
                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-white"
                        />
                        <button 
                            onClick={() => handleSaveConfig('price_4k', config.price_4k)}
                            className="mt-2 w-full bg-white/10 hover:bg-white/20 text-xs py-1.5 rounded transition-colors"
                        >
                            保存
                        </button>
                    </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">联系客服信息配置</h2>
                <div className="space-y-4">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border border-white/10 rounded bg-white/5">
                      <div>
                        <p className="font-medium">{key.provider}</p>
                        <p className="text-sm text-gray-400">{key.apiKey}</p>
                      </div>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        编辑
                      </button>
                    </div>
                  ))}
                  <button className="w-full py-2 border-2 border-dashed border-white/20 rounded hover:border-blue-500 hover:text-blue-400 transition-colors text-gray-400 flex items-center justify-center">
                    <Plus size={16} className="mr-2" />
                    添加API密钥
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">积分规则配置</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">类型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">画质</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">基础积分</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">每张积分</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {pointRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{rule.generation_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{rule.quality}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{rule.base_points.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{rule.points_per_image.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-blue-400 hover:text-blue-300">编辑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 积分调整弹窗 */}
      {pointsModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#1e1e1e] border border-white/20 rounded-xl p-6 w-full max-w-sm text-white">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold">调整积分 - {pointsModal.username}</h3>
                      <button onClick={() => setPointsModal({ ...pointsModal, show: false })}><X size={20} className="text-gray-400" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm text-gray-400 mb-1">调整数量 (+增加 / -扣除)</label>
                          <input 
                            type="number" 
                            value={pointsAmount} 
                            onChange={e => setPointsAmount(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded p-2 text-white"
                            placeholder="例如：100 或 -50"
                          />
                      </div>
                      <div>
                          <label className="block text-sm text-gray-400 mb-1">备注</label>
                          <input 
                            type="text" 
                            value={pointsDesc} 
                            onChange={e => setPointsDesc(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded p-2 text-white"
                            placeholder="管理员调整"
                          />
                      </div>
                      <button 
                        onClick={handleAdjustPoints}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition-colors"
                      >
                        确认调整
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}

