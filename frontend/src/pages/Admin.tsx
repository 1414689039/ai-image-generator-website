import { useState, useEffect } from 'react'
import Header from '../components/Header'
import apiClient from '../api/client'

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'orders' | 'generations' | 'settings'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [generations, setGenerations] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [pointRules, setPointRules] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    loadData()
  }, [activeTab])

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
          const genRes = await apiClient.get('/admin/generations')
          setGenerations(genRes.data.generations || [])
          break
        case 'settings':
          const [keysRes, rulesRes, statsRes] = await Promise.all([
            apiClient.get('/admin/api-keys'),
            apiClient.get('/admin/point-rules'),
            apiClient.get('/admin/stats'),
          ])
          setApiKeys(keysRes.data.apiKeys || [])
          setPointRules(rulesRes.data.rules || [])
          setStats(statsRes.data || {})
          break
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">管理员面板</h1>

        {/* 标签页 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            {[
              { key: 'users', label: '用户管理' },
              { key: 'orders', label: '订单查询' },
              { key: 'generations', label: '生成记录' },
              { key: 'settings', label: '系统配置' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-6 py-3 font-medium ${
                  activeTab === tab.key
                    ? 'border-b-2 border-primary-600 text-primary-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">用户列表</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">积分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.points.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button className="text-primary-600 hover:text-primary-900">调整积分</button>
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
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">积分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">¥{order.amount.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.points.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded ${
                            order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
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
              <h2 className="text-xl font-semibold mb-4">生成记录</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">提示词</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">模型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">积分</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {generations.map((gen) => (
                      <tr key={gen.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{gen.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{gen.username}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{gen.prompt}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{gen.model}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{gen.points_cost.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded ${
                            gen.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            gen.status === 'failed' ? 'bg-red-100 text-red-800' : 
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {gen.status === 'completed' ? '已完成' : 
                             gen.status === 'failed' ? '失败' : '处理中'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">系统统计</h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">总用户数</p>
                    <p className="text-2xl font-bold">{stats.totalUsers || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">总订单数</p>
                    <p className="text-2xl font-bold">{stats.totalOrders || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">总生成数</p>
                    <p className="text-2xl font-bold">{stats.totalGenerations || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-600">总收入</p>
                    <p className="text-2xl font-bold">¥{stats.totalRevenue?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">API密钥配置</h2>
                <div className="space-y-4">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border rounded">
                      <div>
                        <p className="font-medium">{key.provider}</p>
                        <p className="text-sm text-gray-500">{key.apiKey}</p>
                      </div>
                      <button className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
                        编辑
                      </button>
                    </div>
                  ))}
                  <button className="w-full py-2 border-2 border-dashed border-gray-300 rounded hover:border-primary-500">
                    + 添加API密钥
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">积分规则配置</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">画质</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">基础积分</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">每张积分</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pointRules.map((rule) => (
                        <tr key={rule.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rule.generation_type}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rule.quality}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rule.base_points.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rule.points_per_image.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-primary-600 hover:text-primary-900">编辑</button>
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
    </div>
  )
}

