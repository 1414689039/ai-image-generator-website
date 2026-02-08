import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

interface RechargeModalProps {
  onClose: () => void
}

const AMOUNTS = [
  { value: 6, label: '6元 (60积分)' },
  { value: 10, label: '10元 (100积分)' },
  { value: 30, label: '30元 (330积分)', bonus: '赠30' },
  { value: 50, label: '50元 (600积分)', bonus: '赠100' },
  { value: 100, label: '100元 (1200积分)', bonus: '赠200' },
]

export default function RechargeModal({ onClose }: RechargeModalProps) {
  const [amount, setAmount] = useState(6)
  // 移除自定义金额
  // const [customAmount, setCustomAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'alipay' | 'wxpay'>('alipay')
  const [loading, setLoading] = useState(false)
  const [pollingOrderNo, setPollingOrderNo] = useState<string | null>(null)
  const { fetchUserInfo } = useAuthStore()

  // 轮询订单状态
  useEffect(() => {
    if (!pollingOrderNo) return

    let isMounted = true
    const checkStatus = async () => {
      try {
        const res = await apiClient.get(`/payment/order/${pollingOrderNo}`)
        if (res.data.status === 'paid' && isMounted) {
          setPollingOrderNo(null) // 停止轮询
          await fetchUserInfo() // 刷新积分
          alert('充值成功！')
          onClose()
        }
      } catch (e) {
        console.error('Check status error', e)
      }
    }

    // 立即检查一次
    checkStatus()
    
    // 每3秒检查一次
    const interval = setInterval(checkStatus, 3000)

    // 5分钟后超时停止
    const timeout = setTimeout(() => {
      if (isMounted) {
        setPollingOrderNo(null)
        alert('支付检测超时，请在"我的订单"中查看状态')
      }
    }, 300000)

    return () => {
      isMounted = false
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pollingOrderNo, onClose, fetchUserInfo])

  const handlePay = async () => {
    let newWindow: Window | null = null
    try {
      setLoading(true)
      const finalAmount = amount
      
      if (isNaN(finalAmount) || finalAmount <= 0) {
        alert('请输入有效的金额')
        return
      }

      // 预先打开新窗口以避免浏览器拦截
      newWindow = window.open('about:blank', '_blank')
      if (newWindow) {
        newWindow.document.write('<div style="text-align:center;padding:20px;">正在创建支付订单...</div>')
      }

      const response = await apiClient.post('/payment/create-order', {
        amount: finalAmount,
        paymentMethod
      })

      const { paymentUrl, orderNo } = response.data
      
      if (paymentUrl) {
        if (newWindow) {
          newWindow.location.href = paymentUrl
        } else {
          // 如果预打开失败（极少见），尝试直接打开
          window.open(paymentUrl, '_blank')
        }
        // 开始轮询
        setPollingOrderNo(orderNo)
      } else {
        if (newWindow) newWindow.close()
        alert('创建订单失败：未获取到支付链接')
      }
    } catch (error: any) {
      console.error('Recharge error:', error)
      if (newWindow) newWindow.close()
      alert(error.response?.data?.error || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md p-6 relative text-white animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">积分充值</h2>

        <div className="space-y-6">
          {/* 金额选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              充值金额
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AMOUNTS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setAmount(opt.value)
                  }}
                  className={`p-3 border rounded-xl text-left transition-all relative overflow-hidden ${
                    amount === opt.value
                      ? 'border-blue-500 bg-blue-500/20 ring-1 ring-blue-500/50'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="font-medium text-white">{opt.value}元</div>
                  <div className="text-xs text-gray-400">{opt.label.split(' (')[1].replace(')', '')}</div>
                  
                  {/* 优惠标签 */}
                  {(opt as any).bonus && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-bl-lg">
                        {(opt as any).bonus}
                    </div>
                  )}
                </button>
              ))}
            </div>
            {/* 移除自定义金额输入框 */}
          </div>

          {/* 支付方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              支付方式
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('alipay')}
                className={`flex items-center justify-center p-3 border rounded-xl transition-all ${
                  paymentMethod === 'alipay'
                    ? 'border-blue-500 bg-blue-500/20 ring-1 ring-blue-500/50'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="font-medium text-blue-400">支付宝</span>
              </button>
              <button
                disabled
                className="flex items-center justify-center p-3 border border-white/5 bg-white/5 rounded-xl cursor-not-allowed opacity-50"
              >
                <span className="font-medium text-gray-500">微信支付 (暂未开通)</span>
              </button>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={loading || !!pollingOrderNo}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {pollingOrderNo ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>支付中... 请在新窗口完成支付</span>
              </>
            ) : loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>处理中...</span>
              </>
            ) : (
              `立即支付 ${amount || 0} 元`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
