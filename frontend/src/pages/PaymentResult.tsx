import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

export default function PaymentResult() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderNo = searchParams.get('order_no')
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('正在查询支付结果...')
  const { fetchUserInfo } = useAuthStore()

  useEffect(() => {
    if (!orderNo) {
      setStatus('failed')
      setMessage('订单号缺失')
      return
    }

    const checkStatus = async () => {
      try {
        // 尝试手动触发回调（用于本地开发或 ZPay 回调失败的情况）
        // 只有当 URL 中包含 ZPay 的签名参数时才尝试
        const tradeStatus = searchParams.get('trade_status')
        const sign = searchParams.get('sign')
        
        if ((tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'success') && sign) {
          try {
             // 构造回调参数
             const params: Record<string, string> = {}
             searchParams.forEach((value, key) => {
               params[key] = value
             })
             
             // 发送给后端 notify 接口进行验证和处理
             // 注意：这里使用的是 GET 请求或者 POST 请求，取决于 notify 接口支持
             // 之前我们已经在 worker/src/routes/payment.ts 中同时支持了 GET/POST
             await apiClient.get(`/payment/notify?${searchParams.toString()}`)
          } catch (e) {
            console.warn('Manual notify trigger failed:', e)
          }
        }

        const response = await apiClient.get(`/payment/order/${orderNo}`)
        const order = response.data

        if (order.paymentStatus === 'paid' || order.paymentStatus === 'success') {
          setStatus('success')
          setMessage('支付成功！积分已到账')
          // 刷新用户信息以更新积分
          fetchUserInfo()
          // 3秒后跳转回首页
          setTimeout(() => navigate('/'), 3000)
        } else {
          // 如果还是 pending，可能回调还没到，可以尝试再次查询或提示用户
          // 这里简单处理：如果是 pending，显示等待中，并每隔2秒重试，最多重试5次
          return 'pending'
        }
      } catch (error) {
        console.error('Check order error:', error)
        setStatus('failed')
        setMessage('查询订单状态失败')
      }
    }

    let retryCount = 0
    const maxRetries = 10
    
    const poll = async () => {
      // 每次轮询都尝试检查状态
      const result = await checkStatus()
      if (result === 'pending') {
        if (retryCount < maxRetries) {
          retryCount++
          // 每次轮询时也尝试重新触发回调，以防第一次网络请求失败
          if (searchParams.get('trade_status') === 'TRADE_SUCCESS' || searchParams.get('trade_status') === 'success') {
             try {
                 await apiClient.get(`/payment/notify?${searchParams.toString()}`)
             } catch(e) {}
          }
          setTimeout(poll, 2000)
        } else {
          // 超时后，不直接显示失败，而是再次检查一次
          // 有时候 Cloudflare D1 的写入有延迟
          try {
             const finalResponse = await apiClient.get(`/payment/order/${orderNo}`)
             if (finalResponse.data.paymentStatus === 'paid') {
                 setStatus('success')
                 setMessage('支付成功！积分已到账')
                 fetchUserInfo()
                 setTimeout(() => navigate('/'), 3000)
                 return
             }
          } catch(e) {}
          
          setStatus('failed')
          setMessage('支付结果确认超时，请稍后在订单列表中查看')
        }
      }
    }

    poll()
  }, [orderNo, navigate, fetchUserInfo])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <Loader className="w-16 h-16 text-blue-500 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">正在确认支付结果</h2>
            <p className="text-gray-500">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">支付成功</h2>
            <p className="text-gray-500 mb-6">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              返回首页
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">支付未完成</h2>
            <p className="text-gray-500 mb-6">{message}</p>
            <div className="space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                刷新重试
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                返回首页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
